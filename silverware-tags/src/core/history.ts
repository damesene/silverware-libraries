// The changes applied in this session (this window), the last undone first.
import type { Applied } from "./plan.ts";

// At most this many kept: each holds every page's text before and after (a change of hundreds of pages, megabytes)
const KEPT = 10;

export class History {
  private readonly applied: Applied[] = [];

  push(applied: Applied): void {
    if (!applied.written.length) return;
    this.applied.push(applied);
    if (this.applied.length > KEPT) this.applied.shift();
  }

  /** The last change, still to undo */
  get last(): Applied | undefined {
    return this.applied[this.applied.length - 1];
  }

  /** A change taken off the list (it is undone) */
  remove(applied: object): void {
    const at = this.applied.indexOf(applied as Applied);
    if (at >= 0) this.applied.splice(at, 1);
  }
}
