// The SilverBullet servers the interaction tests run against (npm run test:ui:sb),
// one per Playwright worker, each serving a space of its own: settings are a
// space's, so tests that run at once must not share one. playwright.config.ts
// starts them; a test finds its worker's by its parallelIndex (helpers.ts).
import { existsSync } from "node:fs";
import { join } from "node:path";

// SW_SB_FIRST_PORT moves them where a machine reserves these (Windows keeps ranges of ports for itself:
// `netsh interface ipv4 show excludedportrange protocol=tcp`)
const FIRST_PORT = Number(process.env.SW_SB_FIRST_PORT) || 3010;

/** Worker `index`'s server: its port, and its space, a folder in `spaces` */
export function silverbulletServer(index: number, spaces: string): { readonly port: number; readonly space: string } {
  return { port: FIRST_PORT + index, space: join(spaces, String(index)) };
}

// SB-2.12-COMPAT: the configuration page's file, CONFIG.md in SilverBullet 2.12.1 and older; its edge (3.0) renames it to
// Library/Config.md as it starts (scripts/silverbullet.mjs writes CONFIG.md before), so the file there tells which.
// Once 2.12.1 is dropped: Library/Config.md alone.
/** The file of a space's configuration page, as the server keeps it */
export function configFile(space: string): string {
  const library = join(space, "Library", "Config.md");
  return existsSync(library) ? library : join(space, "CONFIG.md");
}
