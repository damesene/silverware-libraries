// A place's state in memory (the tests, the playground): what SilverBullet's
// binding keeps in a code block's text.
import type { ViewStateStore } from "../core/store.ts";

export class MemoryViewState implements ViewStateStore {
  private readonly values = new Map<string, unknown>();
  /** How many writes were made (a test tells a write from none) */
  writes = 0;

  constructor(values: Readonly<Record<string, unknown>> = {}) {
    for (const [key, value] of Object.entries(values)) this.values.set(key, value);
  }

  get(key: string): unknown {
    return this.values.get(key);
  }

  keys(): readonly string[] {
    return [...this.values.keys()];
  }

  async set(values: Readonly<Record<string, unknown>>): Promise<void> {
    this.writes++;
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) this.values.delete(key);
      else this.values.set(key, value);
    }
  }
}
