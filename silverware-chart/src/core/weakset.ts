// Objects held weakly, yet gone through: what is followed while it lives (charts' boxes), let go with it.

/** A set of elements held weakly that can be gone through (WeakRefs; a gone one is dropped as it is met) */
export class IterableWeakSet<T extends object> {
  private readonly refs = new Set<WeakRef<T>>();
  private readonly known = new WeakSet<T>();

  add(value: T): void {
    if (this.known.has(value)) return;
    this.known.add(value);
    this.refs.add(new WeakRef(value));
  }

  delete(value: T): void {
    if (!this.known.delete(value)) return;
    for (const ref of this.refs) if (ref.deref() === value) this.refs.delete(ref);
  }

  *[Symbol.iterator](): Iterator<T> {
    for (const ref of this.refs) {
      const value = ref.deref();
      if (value) yield value;
      else this.refs.delete(ref);
    }
  }
}
