// Runs the interaction tests against a target (on any OS, which an npm
// script's VAR=value does not):
//   node scripts/ui-tests.mjs <playground|silverbullet|edge> [playwright test options]
// npm run test:ui:sb is the one against SilverBullet; options after -- pass on
// (npm run test:ui:sb -- --ui, npm run test:ui:sb -- -g "AutoFill").
// edge (npm run test:ui:sb:edge): SilverBullet's edge build (scripts/silverbullet/edge.mjs),
// whatever SB_IMAGE or SB_BIN .env.local sets (a variable set, though empty, is kept from it);
// an SB_BIN of the command line still runs (a SilverBullet built locally, say).
import { spawnSync } from "node:child_process";
import { EDGE_IMAGE } from "./silverbullet/edge.mjs";

const [target, ...args] = process.argv.slice(2);
if (target !== "playground" && target !== "silverbullet" && target !== "edge") {
  console.error("Usage: node scripts/ui-tests.mjs <playground|silverbullet|edge> [playwright test options]");
  process.exit(1);
}
const edge = target === "edge";
const { status } = spawnSync("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    ...(edge ? { SB_IMAGE: EDGE_IMAGE, SB_BIN: process.env.SB_BIN ?? "" } : {}),
    SW_TARGET: edge ? "silverbullet" : target,
  },
});
process.exit(status ?? 1);
