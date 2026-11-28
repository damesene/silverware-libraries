/// <reference types="node" />
// What Silverware Core's interaction tests share: against a real SilverBullet only (the core is SilverBullet's: its
// pages and its gate in each plugin's API page run in Space Lua), every plugin deployed in the test servers' spaces. A
// test's pages are written into its worker's space (UiCore/<test>/<name>), the first opened, and removed after; the
// core's files a test changes (`coreAs`) are put back as they were, as the test ends.
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";
import { pageErrors, type Space, withSpace } from "../../scripts/ui-test-helpers.ts";

export { expect, type Space };

export const onSilverBullet = process.env.SW_TARGET === "silverbullet";

/** The core's files as a space has them installed (its library page's `files:` and the page itself) */
const CORE_FILES = ["silverware-core.md", "silverware-core-api.md", "silverware-core-style.md", "silverware-core.js"];

/**
 * Tests get `page`, `space` (a test's pages opened, no plugin's command waited for: a test refusing the core starts
 * none, and waits for what it shows) `coreAs` and `libraryFiles`; an error in the page fails the test
 */
export const test = base.extend<{
  space: Space;
  coreAs: (version: string | undefined) => Promise<void>;
  libraryFiles: (name: string, change: (text: string) => string | undefined) => Promise<void>;
}>({
  // (On `libraryFiles`: its files put back once the page is closed, never while a client has the space open)
  page: async ({ page, libraryFiles }, use) => {
    void libraryFiles;
    test.skip(!onSilverBullet, "the core's gate is SilverBullet's: tested against SilverBullet only");
    const errors = pageErrors(page);
    try {
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      await page.close();
    }
  },
  space: async ({ page }, use) => withSpace(page, "UiCore", [], use),
  /**
   * The core as a space would have it for the rest of the test: not installed (`undefined`: its files gone), or its
   * bundle saying another version (`"0.9.0"`)
   */
  coreAs: async ({ libraryFiles }, use) =>
    use(async (version) => {
      if (version === undefined) for (const name of CORE_FILES) await libraryFiles(name, () => undefined);
      else await libraryFiles("silverware-core.js", (text) => text.replace(/"\d+\.\d+\.\d+"/, JSON.stringify(version)));
    }),
  /**
   * A file of the worker's space's `Library/damesene/` changed for the rest of the test (`change` given its text, giving
   * the new, `undefined` to remove it); put back as the test ends, on a timeout too. Called before the test's page is
   * opened: written on disk, which no client has open then (CLAUDE.md: a space's pages are not written while SilverBullet
   * has them open). The worker's server is this test's alone meanwhile (each worker has its own), and each test's
   * browser starts without the files of before
   */
  libraryFiles: async ({}, use, info) => {
    const folder = join(silverbulletServer(info.parallelIndex, process.env.SW_SB_SPACE ?? "").space, "Library", "damesene");
    const kept = new Map<string, string>();
    try {
      await use(async (name, change) => {
        if (!kept.has(name)) kept.set(name, await readFile(join(folder, name), "utf8"));
        const text = change(kept.get(name)!);
        if (text === undefined) await rm(join(folder, name), { force: true });
        else await writeFile(join(folder, name), text);
      });
    } finally {
      for (const [name, text] of kept) await writeFile(join(folder, name), text);
    }
  },
});
