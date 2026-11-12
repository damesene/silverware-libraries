// The widget plugins' providers, as they register them through Silverware Layout's API (shared/layout.ts): one per
// name, a provider registered under a name already there replacing it (Space Lua loaded again runs their init pages
// again, the API being the same object). Told to whoever lays widgets out as they change.
import { LAYOUT_VERSION, type Layout, type LayoutProvider } from "../../../shared/layout.ts";

/** Why something handed over is no provider, as text, undefined where it is one */
export function validateProvider(given: unknown): string | undefined {
  if (!given || typeof given !== "object") return "a provider is an object";
  const { name, selector, read, write } = given as Partial<LayoutProvider>;
  if (typeof name !== "string" || !name.trim()) return "a provider has a name";
  if (typeof selector !== "string" || !selector.trim()) return `the provider ${name} has no selector`;
  if (typeof read !== "function" || typeof write !== "function") return `the provider ${name} has no read or write`;
  return undefined;
}

export class Registry {
  private readonly byName = new Map<string, LayoutProvider>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly problem: (message: string) => void) {}

  /** The providers registered, in the order their names were first registered */
  get providers(): readonly LayoutProvider[] {
    return [...this.byName.values()];
  }

  /** A provider registered (one of its name replaced); the function given back unregisters it, if it is still the one of its name */
  register(provider: LayoutProvider): () => void {
    const problem = validateProvider(provider);
    if (problem) {
      this.problem(`Silverware Layout: ${problem}; nothing registered`);
      return () => undefined;
    }
    this.byName.set(provider.name, provider);
    this.changed();
    return () => {
      if (this.byName.get(provider.name) !== provider) return;
      this.byName.delete(provider.name);
      this.changed();
    };
  }

  /** Told as providers are registered and unregistered; the function given back stops it */
  onChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Silverware Layout's API, as the widget plugins are handed it */
  api(): Layout {
    return { version: LAYOUT_VERSION, register: (provider) => this.register(provider) };
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}
