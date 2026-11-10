/**
 * A list as configured: an array, or a Lua table handed over as an object
 * with its items under 1, 2, … (not verified how SilverBullet's config.get
 * gives a list from Space Lua to JS: both are taken); else undefined
 */
export function listOf(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([key], i) => key === String(i + 1))) return undefined;
  return entries.map(([, item]) => item);
}
