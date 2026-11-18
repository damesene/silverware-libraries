// What every plugin's interaction tests (each plugin's ui-tests/helpers.ts) share: kept here once, re-exported by
// each helpers file so a test imports it from its own.
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Where an element is once laid out: waited for (a write, a hover or a save may render it anew meanwhile, and
 * SilverBullet draws a widget's element anew with any change of its editor: a box read at once may be none). For a
 * single read; inside an `expect.poll` read `boundingBox()` itself, a null only polled again
 */
export async function boxOf(target: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect.poll(async () => (box = await target.boundingBox()) !== null).toBe(true);
  return box!;
}

type Commands = { clientSystem?: { commandHook?: { buildAllCommands(): Map<string, unknown> } } };

/**
 * Waits until Space Lua has defined a command (it loads after the page): its plugin started. Asked of a client that may
 * still be starting (a page loaded again: its client there, its system not yet), as not yet defined, not as an error
 */
export async function commandDefined(page: Page, name: string): Promise<void> {
  await page.waitForFunction((command) => !!(window as unknown as { client?: Commands }).client?.clientSystem?.commandHook?.buildAllCommands().has(command), name);
}
