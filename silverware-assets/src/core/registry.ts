// The registered types of asset and actions (docs/silverware-assets.md, *Types*, *Actions*): one per name, a
// name registered again replacing the one before; Silverware Assets' own registered only where their name is free
// (Space Lua loaded again runs Layout's init again: a user's or another plugin's override survives). The core knows no
// type or action by name.
import { ASSETS_VERSION, type AssetAction, type Assets, type AssetType } from "../../../shared/assets.ts";

/** Metadata keys Silverware Assets' own: a type declaring one in its validation is told so */
export const RESERVED_KEYS: readonly string[] = ["view"];

/** Why a type cannot be registered, as text; undefined where it can */
export function validateAssetType(type: unknown): string | undefined {
  const t = type as Partial<AssetType> | null;
  if (!t || typeof t !== "object") return "a type is no object";
  if (typeof t.name !== "string" || !t.name.trim()) return "a type has no name";
  if (!t.match || !Array.isArray(t.match.kind) || !t.match.kind.length) return `the type ${t.name} matches no kind of asset`;
  if (typeof t.icon !== "string") return `the type ${t.name} has no icon`;
  for (const [view, renderer] of Object.entries(t.views ?? {})) {
    if (view !== "preview" && view !== "embed") return `the type ${t.name} renders a view "${view}" (preview or embed only)`;
    if (typeof renderer !== "function") return `the type ${t.name}'s ${view} is no function`;
  }
  return undefined;
}

/** Why an action cannot be registered, as text; undefined where it can */
export function validateAssetAction(action: unknown): string | undefined {
  const a = action as Partial<AssetAction> | null;
  if (!a || typeof a !== "object") return "an action is no object";
  if (typeof a.name !== "string" || !a.name.trim()) return "an action has no name";
  if (typeof a.fits !== "function" || typeof a.run !== "function") return `the action ${a.name} has no fits or run`;
  return undefined;
}

class Named<T extends { readonly name: string }> {
  private readonly byName = new Map<string, T>();

  constructor(
    private readonly validate: (one: unknown) => string | undefined,
    private readonly problem: (message: string) => void,
    private readonly changed: () => void,
  ) {}

  get all(): readonly T[] {
    return [...this.byName.values()];
  }

  get(name: string): T | undefined {
    return this.byName.get(name);
  }

  register(one: T): () => void {
    const problem = this.validate(one);
    if (problem) {
      this.problem(`Silverware Assets: ${problem}; not registered`);
      return () => undefined;
    }
    // (What it replaces comes back as it is taken off: Silverware Assets PDF's `pdf` gone, Silverware Assets' own the browser's again)
    const replaced = this.byName.get(one.name);
    this.byName.set(one.name, one);
    this.changed();
    return () => {
      if (this.byName.get(one.name) !== one) return;
      if (replaced) this.byName.set(one.name, replaced);
      else this.byName.delete(one.name);
      this.changed();
    };
  }

  /** Registered where its name is free (Silverware Assets' own) */
  registerDefault(one: T): void {
    if (!this.byName.has(one.name)) this.register(one);
  }
}

export class AssetRegistry {
  readonly types: Named<AssetType>;
  readonly actions: Named<AssetAction>;
  private readonly listeners = new Set<() => void>();

  constructor(problem: (message: string) => void) {
    const changed = () => this.listeners.forEach((listener) => listener());
    this.types = new Named<AssetType>(validateAssetType, problem, changed);
    this.actions = new Named<AssetAction>(validateAssetAction, problem, changed);
  }

  /** Told as a type or an action is registered, replaced or taken off (another plugin's, its init page run after the page's files were drawn); what stops it given back */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** The API a plugin registers with (`silverware.assets.api`) */
  api(): Assets {
    return {
      version: ASSETS_VERSION,
      types: { register: (type) => this.types.register(type) },
      actions: { register: (action) => this.actions.register(action) },
    };
  }
}
