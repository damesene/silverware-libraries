// Where items were opened from: a block's place, followed live by what opened
// them (the peek marks the properties the view hides). One per place, handed
// to the place drawn after it for the same block (SilverBullet draws a block
// anew after a write of it), so it goes on telling the view shown there.
import type { OpenedFrom, OpenedView } from "./module.ts";

export class PlaceOpener implements OpenedFrom {
  private readonly listeners = new Set<() => void>();

  constructor(private source: () => OpenedView | undefined) {}

  current(): OpenedView | undefined {
    return this.source();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** What it follows now (the place drawn after it for the block), told as a change unless `quiet` (the place gone: the view as it last was, nothing changed) */
  follow(source: () => OpenedView | undefined, options: { readonly quiet?: boolean } = {}): void {
    this.source = source;
    if (!options.quiet) this.changed();
  }

  /** What `current` gives may have changed (the place drawn, a view's state changed): told */
  changed(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // (One listener failing keeps the others told)
      }
    }
  }
}
