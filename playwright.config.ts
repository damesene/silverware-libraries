// Interaction tests in a real browser (npm run test:ui): what needs layout,
// pointers, touch and tables rendered anew, which jsdom (npm test) has not.
// Playwright's own Chromium (npm run test:ui:install, once): the version
// Playwright pins, the same on every machine and in CI, nothing installed by hand.
//
// Two targets, the same tests (SW_TARGET; silverware-table/ui-tests/helpers.ts
// holds what differs):
// - playground (npm run test:ui, the default): the page that mocks SilverBullet.
//   It bundles silverware-table/src, so the tests run the sources, not the
//   committed silverware-table.js (npm run verify checks that one matches them).
// - silverbullet (npm run test:ui:sb): a real SilverBullet in Docker, the version
//   scripts/silverbullet/Dockerfile names (scripts/silverbullet.mjs), the committed silverware-table.js
//   deployed into its space, as a user installs it. One server per worker, each
//   with a space of its own, as settings are a space's (scripts/silverbullet-servers.ts;
//   SW_SB_WORKERS how many, else up to 4 by the machine's cores). Tests tagged
//   @playground are skipped.
import { existsSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices, type ReporterDescription } from "@playwright/test";
import { silverbulletServer } from "./scripts/silverbullet-servers.ts";

// This machine's settings of the tests (SW_SB_WORKERS, SB_IMAGE, SB_BIN…), not committed:
// .env.local, KEY=value lines; a variable already set (CI, the command line) is kept
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const target = process.env.SW_TARGET ?? "playground";
if (target !== "playground" && target !== "silverbullet") throw new Error(`SW_TARGET is "${target}": playground or silverbullet`);
const silverbullet = target === "silverbullet";

// The folder of the spaces SilverBullet serves, one per worker; the tests write their pages into them (set here, so the test workers have it too)
process.env.SW_SB_SPACE ??= join(tmpdir(), "silverware-ui-tests-space");
const workers = silverbullet ? Number(process.env.SW_SB_WORKERS) || Math.min(4, availableParallelism()) : undefined;
const servers = Array.from({ length: workers ?? 0 }, (_, index) => silverbulletServer(index, process.env.SW_SB_SPACE!));

// Each target's results and report in a folder of its own: a run against the playground and one against SilverBullet at
// once do not write over each other's (two runs of one target at once still would, their servers' ports too)
const html: ReporterDescription = ["html", { open: "never", outputFolder: `playwright-report/${target}` }];
// (The summary reporter locally too: its warnings in the console)
const reporter: ReporterDescription[] = process.env.CI ? [["list"], ["github"], html, ["./scripts/ui-tests-summary.ts"]] : [["list"], html, ["./scripts/ui-tests-summary.ts"]];

export default defineConfig({
  // Each plugin's interaction tests, in its own folder (<plugin>/ui-tests/)
  testMatch: "*/ui-tests/**/*.spec.ts",
  outputDir: `test-results/${target}`,
  // Every test in parallel with the others. One that cannot be (a `lock` of Playwright's, `-exclusive-` alone with
  // nothing else running) only where the user allowed it, said by its comment (root CLAUDE.md, *Interaction tests run
  // in parallel*; scripts/ui-test-locks.test.ts checks it)
  fullyParallel: true,
  workers,
  grepInvert: silverbullet ? /@playground/ : undefined,
  forbidOnly: !!process.env.CI,
  // A flaky interaction shows as flaky (retried once), not as a pass; retried at the end, alone in one worker, so a
  // test the load of the run made fail is told apart from one that fails by itself
  retries: 1,
  retryStrategy: "isolated",
  // SilverBullet indexes the space and loads Space Lua when a page opens: more time to start than the playground
  timeout: silverbullet ? 60_000 : 30_000,
  expect: { timeout: silverbullet ? 15_000 : 5_000 },
  reporter,
  use: {
    // (Against SilverBullet each test's is its worker's server: helpers.ts)
    baseURL: silverbullet ? undefined : "http://127.0.0.1:8010/",
    viewport: { width: 1200, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mouse", testIgnore: /touch\.spec\.ts/ },
    { name: "touch", testMatch: /touch\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: silverbullet
    ? {
        // One command for them all, which starts them at once (Playwright starts its web servers one after another)
        command: "node scripts/silverbullet.mjs",
        env: { SW_SB_SERVERS: JSON.stringify(servers) },
        wait: { stdout: /SilverBullet servers ready/ },
        // Pulling the image the first time takes a while
        timeout: 180_000,
        stdout: "pipe",
        gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
      }
    : {
        command: "node scripts/playground.mjs",
        env: { PORT: "8010" },
        url: "http://127.0.0.1:8010/",
        reuseExistingServer: !process.env.CI,
      },
});
