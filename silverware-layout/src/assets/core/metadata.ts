// A type's own metadata of an embed, as a renderer is handed them (shared/assets.ts, `AssetMetadata`): Silverware
// Layout's reserved keys left out, read by helpers so that no type converts values itself, written through Silverware
// Layout. Pure.
import type { AssetMetadata } from "../../../../shared/assets.ts";
import { RESERVED_KEYS } from "./registry.ts";

export function metadataOf(all: Readonly<Record<string, string>>, write: (changes: Readonly<Record<string, string | null>>) => Promise<string | undefined>): AssetMetadata {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(all)) if (!RESERVED_KEYS.includes(key)) values[key] = value;
  return {
    values,
    number: (key) => {
      const value = values[key];
      if (value === undefined || value.trim() === "") return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    },
    boolean: (key) => (values[key] === "true" ? true : values[key] === "false" ? false : undefined),
    text: (key) => values[key],
    write: (changes) => {
      const reserved = Object.keys(changes).find((key) => RESERVED_KEYS.includes(key));
      if (reserved) return Promise.resolve(`"${reserved}" is Silverware Layout's own key`);
      return write(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value === null ? null : String(value)])));
    },
  };
}
