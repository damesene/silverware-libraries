// What every plugin's interaction tests (each plugin's ui-tests/helpers.ts) share: kept here once, re-exported by
// each helpers file so a test imports it from its own.
import { expect, type Locator } from "@playwright/test";

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
