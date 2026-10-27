// Serves real SilverBullets for the interaction tests (npm run test:ui:sb),
// started by playwright.config.ts: one per worker, all at once, each a fresh
// space with the libraries deployed (npm run deploy), served by SilverBullet in
// Docker, the version scripts/silverbullet/Dockerfile names. Once every one
// answers, it prints READY, which Playwright waits for.
//   SB_IMAGE  another image, e.g. ghcr.io/silverbulletmd/silverbullet:latest-slim
//   SB_BIN    a silverbullet binary to run instead of Docker
//   SW_SB_SERVERS  the servers, a JSON list of { port, space } (set by playwright.config.ts
//             from scripts/silverbullet-servers.ts)
//   SW_SB_LOGS  a folder each server's output is written to as well, server-<port>.log
// Stopped (Ctrl+C, or Playwright when the tests end), it stops them and
// removes their spaces.
import { execFile, execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

// (playwright.config.ts waits for this line)
const READY = "SilverBullet servers ready";

const servers = JSON.parse(process.env.SW_SB_SERVERS ?? "[]");
const image = process.env.SB_IMAGE || readFileSync(join(import.meta.dirname, "silverbullet", "Dockerfile"), "utf8").match(/^FROM\s+(\S+)/m)[1];
const binary = process.env.SB_BIN;
const logs = process.env.SW_SB_LOGS;
if (!servers.length) {
  console.error("SW_SB_SERVERS is not set: the servers to start, a JSON list of { port, space }");
  process.exit(1);
}
if (logs) mkdirSync(logs, { recursive: true });

out(
  binary
    ? `SilverBullet: ${execFileSync(binary, ["--version"], { encoding: "utf8" }).trim()}\n`
    : `SilverBullet: ${image}, ${execFileSync("docker", ["run", "--rm", "--entrypoint", "/silverbullet", image, "--version"], { encoding: "utf8" }).trim()}\n`,
);

// The service worker off: no sync, every load and save goes straight to the
// server, so each test's browser starts from the space as it is on disk.
// The runtime API off: it needs a Chromium in the server, which the tests do not use.
const env = { SB_DISABLE_SERVICE_WORKER: "1", SB_RUNTIME_API: "0" };
const container = (port) => `silverware-ui-tests-${port}`;

let stopping = false;
const running = servers.map(start);
await Promise.all(servers.map(({ port }) => answering(port)));
out(`${READY}\n`);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

/** Writes to the output Playwright shows */
function out(text) {
  process.stdout.write(text);
}

/** One server: its space made, SilverBullet started on it; its output marked with its port */
function start({ port, space }) {
  rmSync(space, { recursive: true, force: true });
  mkdirSync(space, { recursive: true });
  execFileSync(process.execPath, [join(import.meta.dirname, "deploy.mjs"), space], { stdio: "ignore" });
  // SilverBullet loads CONFIG when it boots: missing, it is answered 404, which the page logs as an error
  if (!existsSync(join(space, "CONFIG.md"))) writeFileSync(join(space, "CONFIG.md"), "");
  let server;
  if (binary) {
    // --single: one folder as one space, without the setup wizard a fresh folder gets
    server = spawn(binary, [space, "-p", String(port), "-L", "127.0.0.1", "--single"], { env: { ...process.env, ...env } });
  } else {
    execFileSync("docker", ["rm", "-f", container(port)], { stdio: "ignore" });
    const user = process.getuid ? ["-e", `PUID=${process.getuid()}`, "-e", `PGID=${process.getgid()}`] : [];
    // On Linux in the host's network: a container of its own network adds an interface to the host as it
    // starts, and Chromium drops the loads it has under way on a change of the network (ERR_NETWORK_CHANGED),
    // which servers started at once kept doing while the first tests loaded their pages
    const network = process.platform === "linux" ? ["--network", "host"] : ["-p", `127.0.0.1:${port}:3000`];
    const listen = process.platform === "linux" ? ["-p", String(port), "-L", "127.0.0.1"] : [];
    server = spawn("docker", [
      "run", "--rm", "--name", container(port),
      ...network,
      "-v", `${space}:/data`,
      ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
      ...user,
      image, "--single", ...listen,
    ]);
  }
  const log = logs ? createWriteStream(join(logs, `server-${port}.log`)) : undefined;
  const write = (chunk) => {
    out(String(chunk).replace(/^(?=.)/gm, `[${port}] `));
    log?.write(chunk);
  };
  server.stdout.on("data", write);
  server.stderr.on("data", write);
  const exited = new Promise((resolve) =>
    server.on("exit", (code) => {
      rmSync(space, { recursive: true, force: true });
      log?.end();
      resolve(code);
    }),
  );
  // One gone by itself: the others go too, the run fails
  void exited.then((code) => {
    if (stopping) return;
    out(`[${port}] SilverBullet exited (${code})\n`);
    void stop().then(() => process.exit(code || 1));
  });
  return { port, server, exited };
}

/** Waits for a server to answer its ping */
async function answering(port) {
  for (;;) {
    try {
      // Each try in a time of its own: a port forwarded before SilverBullet listens may take the
      // connection and never answer it (Podman on Windows did), which would wait forever
      if ((await fetch(`http://127.0.0.1:${port}/.ping`, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {
      // Not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Stops every server, at once, and ends once they are gone */
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.all(
    running.map(async ({ port, server, exited }) => {
      if (binary) server.kill("SIGTERM");
      else await promisify(execFile)("docker", ["stop", "-t", "5", container(port)]).catch(() => {});
      await exited;
    }),
  );
  process.exit(0);
}
