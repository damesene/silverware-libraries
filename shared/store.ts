// What the plugins' stores (Silverware Table's tables, Silverware Database's
// items) and the page writer (pages/writer.ts) say alike of a change they
// leave alone: why, as a code to act on and in words. What each leaves (a
// page, a table's whole transaction, an item) is its own.

/**
 * Why a change is left alone: `changed` since it was read (an undo: since it
 * was written), `missing` (not there, or not read), `refused` (it cannot be
 * made there: a name taken, a form not read, a store read only), `version`
 * (kept in another version than the store writes: older, migrate it first;
 * newer, read only)
 */
export type SkipCause = "changed" | "missing" | "refused" | "version";

/** Why a change is left alone, as a code and in words */
export type Skip = { readonly cause: SkipCause; readonly reason: string };
