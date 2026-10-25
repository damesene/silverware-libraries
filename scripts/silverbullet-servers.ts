// The SilverBullet servers the interaction tests run against (npm run test:ui:sb),
// one per Playwright worker, each serving a space of its own: settings are a
// space's, so tests that run at once must not share one. playwright.config.ts
// starts them; a test finds its worker's by its parallelIndex (helpers.ts).
import { join } from "node:path";

const FIRST_PORT = 3010;

/** Worker `index`'s server: its port, and its space, a folder in `spaces` */
export function silverbulletServer(index: number, spaces: string): { readonly port: number; readonly space: string } {
  return { port: FIRST_PORT + index, space: join(spaces, String(index)) };
}
