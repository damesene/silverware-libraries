// The changes applied in this session (this window), the last undone first.
import type { Applied } from "./plan.ts";

// At most this many kept: each holds every page's text before and after
const KEPT = 20;

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

  /** The last change taken off the list (it is being undone) */
  pop(): Applied | undefined {
    return this.applied.pop();
  }
}
