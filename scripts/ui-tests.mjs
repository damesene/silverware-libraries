// Runs the interaction tests against a target (on any OS, which an npm
// script's VAR=value does not):
//   node scripts/ui-tests.mjs <playground|silverbullet> [playwright test options]
// npm run test:ui:sb is the one against SilverBullet; options after -- pass on
// (npm run test:ui:sb -- --ui, npm run test:ui:sb -- -g "AutoFill").
import { spawnSync } from "node:child_process";

const [target, ...args] = process.argv.slice(2);
if (target !== "playground" && target !== "silverbullet") {
  console.error("Usage: node scripts/ui-tests.mjs <playground|silverbullet> [playwright test options]");
  process.exit(1);
}
const { status } = spawnSync("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, SW_TARGET: target },
});
process.exit(status ?? 1);
