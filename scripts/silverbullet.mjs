// Serves real SilverBullets for the interaction tests (npm run test:ui:sb),
// started by playwright.config.ts: one per worker, all at once, each a fresh
// space with the libraries deployed (npm run deploy), served by SilverBullet in
// Docker, the version scripts/silverbullet/Dockerfile names. Once every one
// answers, it prints READY, which Playwright waits for.
//   SB_IMAGE  another image, e.g. ghcr.io/silverbulletmd/silverbullet:latest-slim
//   SB_BIN    a silverbullet binary to run instead of Docker
// On Windows without SB_BIN: SilverBullet's own release of the image's version
// for Windows instead of Docker (none needed, nothing installed): downloaded
// once into .cache/silverbullet/<version>/ (git ignores it), run from there;
// the edge image's (npm run test:ui:sb:edge) the release `edge`, downloaded
// again whenever it was rebuilt.
//   SW_SB_SERVERS  the servers, a JSON list of { port, space } (set by playwright.config.ts
//             from scripts/silverbullet-servers.ts)
//   SW_SB_LOGS  a folder each server's output is written to as well, server-<port>.log
// Stopped (Ctrl+C, or Playwright when the tests end), it stops them and
// removes their spaces.
// A SilverBullet that serves one folder as one space (`--single`, 2.12.1) is
// started on the space; one that serves spaces of a data folder alone (after
// 2.12.1) on a data folder beside it naming the space, at the root, written to,
// no accounts (as SilverBullet's own `make edit-docs` does).
import { execFile, execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

// (playwright.config.ts waits for this line)
const READY = "SilverBullet servers ready";

const servers = JSON.parse(process.env.SW_SB_SERVERS ?? "[]");
const image = process.env.SB_IMAGE || readFileSync(join(import.meta.dirname, "silverbullet", "Dockerfile"), "utf8").match(/^FROM\s+(\S+)/m)[1];
const logs = process.env.SW_SB_LOGS;
if (!servers.length) {
  console.error("SW_SB_SERVERS is not set: the servers to start, a JSON list of { port, space }");
  process.exit(1);
}
const binary = process.env.SB_BIN || (process.platform === "win32" ? await releaseBinary(image) : undefined);
if (logs) mkdirSync(logs, { recursive: true });
// Edge's tag moves as it is rebuilt, and Docker runs the build it pulled first: pulled each time (a version's tag
// stays). Not pulled (offline): the one there, or docker run's pull fails as it would
if (!binary && /:edge(-|$)/.test(image)) {
  try {
    execFileSync("docker", ["pull", "--quiet", image], { stdio: "ignore" });
  } catch {
    out(`SilverBullet ${image}: not pulled, the image there is taken\n`);
  }
}

/** What the SilverBullet run answers to these arguments */
function silverbullet(args) {
  return binary
    ? execFileSync(binary, args, { encoding: "utf8" })
    : execFileSync("docker", ["run", "--rm", "--entrypoint", "/silverbullet", image, ...args], { encoding: "utf8" });
}
out(`SilverBullet: ${binary ? "" : `${image}, `}${silverbullet(["--version"]).trim()}\n`);
// SB-2.12-COMPAT: whether it serves one folder as one space (`--single`, 2.12.1: its help names it); after it, spaces of a
// data folder alone. Once 2.12.1 is dropped: a data folder always, `single` and its branches go
const single = /--single\b/.test(silverbullet(["--help"]));

// The service worker off: no sync, every load and save goes straight to the
// server, so each test's browser starts from the space as it is on disk.
// The runtime API off: it needs a Chromium in the server, which the tests do not use (a server of a data folder
// takes it from its server.json alone, off where it finds no Chromium, and warns of the variable: not given it).
const env = { SB_DISABLE_SERVICE_WORKER: "1", ...(single ? { SB_RUNTIME_API: "0" } : {}) };
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
  // SilverBullet loads CONFIG when it boots: missing, it is answered 404, which the page logs as an error.
  // SB-2.12-COMPAT: CONFIG.md for SilverBullet 2.12.1; its edge (3.0) renames it to Library/Config.md as it starts (which
  // configFile in silverbullet-servers.ts tells by). Once 2.12.1 is dropped: Library/Config.md written here
  if (!existsSync(join(space, "CONFIG.md"))) writeFileSync(join(space, "CONFIG.md"), "");
  // A data folder beside the space naming it, where SilverBullet serves spaces of one alone (the space's folder as the
  // server sees it: in Docker, mounted at /space)
  const root = `${space}.data`;
  rmSync(root, { recursive: true, force: true });
  if (!single) dataFolder(root, binary ? space : "/space");
  let server;
  if (binary) {
    // --single: one folder as one space, without the setup wizard a fresh folder gets
    const served = single ? [space, "--single"] : [root];
    server = spawn(binary, [...served, "-p", String(port), "-L", "127.0.0.1"], { env: { ...process.env, ...env } });
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
      ...(single ? ["-v", `${space}:/data`] : ["-v", `${root}:/data`, "-v", `${space}:/space`]),
      ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
      ...user,
      image, ...(single ? ["--single"] : []), ...listen,
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
      rmSync(root, { recursive: true, force: true });
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

/**
 * SilverBullet's release for Windows of the image's version (its tag, `2.12.1-slim` → 2.12.1; `edge-slim` → the release
 * `edge`), the same SilverBullet as the tests run in Docker elsewhere: downloaded from its GitHub release into
 * .cache/silverbullet/<release>/, then taken from there. A version's once; edge's again whenever its release was rebuilt
 * since (its file's time, kept beside it), else the one there (offline too). Windows' own tar (System32) reads the zip;
 * Git's on the PATH would not
 */
async function releaseBinary(of) {
  const tag = /:([^:@/]+)(?:@|$)/.exec(of)?.[1] ?? "";
  const release = /^\d+\.\d+\.\d+/.exec(tag)?.[0] ?? (/^edge(-|$)/.test(tag) ? "edge" : undefined);
  if (!release) throw new Error(`No release of SilverBullet for the image ${of} (its tag is no version, nor edge): set SB_BIN to a binary`);
  const folder = join(import.meta.dirname, "..", ".cache", "silverbullet", release);
  const exe = join(folder, "silverbullet.exe");
  const asset = "silverbullet-server-windows-x86_64.zip";
  const built = release === "edge" ? await edgeBuilt(asset) : undefined;
  const builtFile = join(folder, "built");
  const had = existsSync(exe);
  if (had && (!built || (existsSync(builtFile) && readFileSync(builtFile, "utf8") === built))) return exe;
  mkdirSync(folder, { recursive: true });
  const url = `https://github.com/silverbulletmd/silverbullet/releases/download/${release}/${asset}`;
  out(`SilverBullet ${release}${built ? ` (built ${built})` : ""}: downloading ${url}\n`);
  const zip = join(folder, "server.zip");
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`SilverBullet ${release} could not be downloaded (${response.status})`);
    writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
    execFileSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-xf", zip, "-C", folder]);
  } catch (error) {
    // An edge rebuilt that could not be had (its file being uploaded again, say): the build there before
    if (!had) throw new Error(`${error.message}: set SB_BIN to a binary`);
    out(`SilverBullet ${release}: not updated (${error.message}), the build downloaded before is taken\n`);
    return exe;
  } finally {
    rmSync(zip, { force: true });
  }
  if (!existsSync(exe)) throw new Error(`SilverBullet ${release}'s release holds no silverbullet.exe: set SB_BIN to a binary`);
  if (built) writeFileSync(builtFile, built);
  return exe;
}

/**
 * When the release `edge`'s file was last built (GitHub's time of the asset), or undefined where GitHub does not
 * answer: then the build already downloaded is taken, if there is one
 */
async function edgeBuilt(asset) {
  try {
    const response = await fetch("https://api.github.com/repos/silverbulletmd/silverbullet/releases/tags/edge", {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const { assets } = await response.json();
    return assets.find(({ name }) => name === asset)?.updated_at;
  } catch (error) {
    out(`SilverBullet edge: GitHub did not say whether it was rebuilt (${error.message}), the build downloaded before is taken\n`);
    return undefined;
  }
}

/**
 * A data folder of SilverBullet's serving one space: the folder given at the root, written to by anyone (no accounts),
 * as its own `make edit-docs` makes one (its spaces.json and users.json, readable by the owner alone)
 */
function dataFolder(root, folder) {
  mkdirSync(root, { recursive: true });
  const spaces = { ui: { name: "Silverware UI tests", folder, binding: { prefix: "/" }, access: "write" } };
  writeFileSync(join(root, "spaces.json"), `${JSON.stringify(spaces)}\n`, { mode: 0o600 });
  writeFileSync(join(root, "users.json"), "{}\n", { mode: 0o600 });
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
