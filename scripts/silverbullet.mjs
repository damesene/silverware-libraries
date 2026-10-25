// Serves a real SilverBullet for the interaction tests (npm run test:ui:sb),
// started by playwright.config.ts: a fresh space with the libraries deployed
// (npm run deploy), served by SilverBullet's latest release in Docker.
//   SB_IMAGE  another image (default ghcr.io/silverbulletmd/silverbullet:latest-slim),
//             e.g. a version: ghcr.io/silverbulletmd/silverbullet:2.12.1-slim
//   SB_BIN    a silverbullet binary to run instead of Docker
//   SW_SB_SPACE, PORT  the space folder and the port (set by playwright.config.ts, one
//              server per worker: scripts/silverbullet-servers.ts)
//   SW_SB_LOG  a file the server's output is written to as well (playwright.config.ts
//              sets one per server in the folder SW_SB_LOGS)
// Stopped (Ctrl+C, or Playwright when the tests end), it stops SilverBullet
// and removes the space.
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const space = process.env.SW_SB_SPACE;
const port = process.env.PORT ?? "3010";
const image = process.env.SB_IMAGE ?? "ghcr.io/silverbulletmd/silverbullet:latest-slim";
const binary = process.env.SB_BIN;
const container = `silverware-ui-tests-${port}`;
if (!space) {
  console.error("SW_SB_SPACE is not set: the space folder to serve");
  process.exit(1);
}

const log = process.env.SW_SB_LOG ? (mkdirSync(dirname(process.env.SW_SB_LOG), { recursive: true }), createWriteStream(process.env.SW_SB_LOG)) : undefined;
const out = (chunk) => {
  process.stdout.write(chunk);
  log?.write(chunk);
};

rmSync(space, { recursive: true, force: true });
mkdirSync(space, { recursive: true });
execFileSync(process.execPath, [join(import.meta.dirname, "deploy.mjs"), space], { stdio: "inherit" });
// SilverBullet loads CONFIG when it boots: missing, it is answered 404, which the page logs as an error
if (!existsSync(join(space, "CONFIG.md"))) writeFileSync(join(space, "CONFIG.md"), "");

// The service worker off: no sync, every load and save goes straight to the
// server, so each test's browser starts from the space as it is on disk.
// The runtime API off: it needs a Chromium in the server, which the tests do not use.
const env = { SB_DISABLE_SERVICE_WORKER: "1", SB_RUNTIME_API: "0" };
let server;
if (binary) {
  out(`SilverBullet: ${execFileSync(binary, ["--version"], { encoding: "utf8" }).trim()}\n`);
  // --single: one folder as one space, without the setup wizard a fresh folder gets
  server = spawn(binary, [space, "-p", port, "-L", "127.0.0.1", "--single"], { env: { ...process.env, ...env } });
} else {
  execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  out(`SilverBullet: ${image}, ${execFileSync("docker", ["run", "--rm", "--entrypoint", "/silverbullet", image, "--version"], { encoding: "utf8" }).trim()}\n`);
  const user = process.getuid ? ["-e", `PUID=${process.getuid()}`, "-e", `PGID=${process.getgid()}`] : [];
  server = spawn("docker", [
    "run", "--rm", "--name", container,
    "-p", `127.0.0.1:${port}:3000`,
    "-v", `${space}:/data`,
    ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    ...user,
    image, "--single",
  ]);
}
server.stdout.on("data", out);
server.stderr.on("data", out);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (binary) server.kill("SIGTERM");
  else {
    try {
      execFileSync("docker", ["stop", "-t", "5", container], { stdio: "ignore" });
    } catch {
      // Already gone
    }
  }
}
server.on("exit", (code) => {
  rmSync(space, { recursive: true, force: true });
  log?.end();
  process.exit(stopping ? 0 : (code ?? 1));
});
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
