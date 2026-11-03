// Parameters: their specs checked (a definition's), and a rule's stored
// values read by them (leniently: a value that does not fit is the default),
// so a definition gets its params as their specs say.
import type { ParamSpec, ParamSpecs, Params } from "./api.ts";
import { checkStyle, colorProblem } from "./style.ts";

const KINDS: ReadonlySet<string> = new Set(["number", "choice", "text", "pattern", "formula", "color", "boolean", "style", "list"]);
const KEY_RE = /^[a-z][a-z0-9_]*$/i;

/** Why specs are not ones; undefined: they are */
export function specsProblem(specs: unknown, depth = 0): string | undefined {
  if (specs === undefined) return undefined;
  if (typeof specs !== "object" || specs === null || Array.isArray(specs)) return "params is an object of parameters by name";
  for (const [key, spec] of Object.entries(specs as Record<string, unknown>)) {
    if (!KEY_RE.test(key)) return `the parameter "${key}" is no name (letters, digits and _)`;
    if (typeof spec !== "object" || spec === null) return `the parameter ${key} is no { kind, … }`;
    const kind = (spec as Record<string, unknown>).kind;
    if (typeof kind !== "string" || !KINDS.has(kind)) return `the parameter ${key} has no kind of ${[...KINDS].join(", ")}`;
    const s = spec as ParamSpec;
    if (s.line !== undefined && typeof s.line !== "string") return `the parameter ${key}'s line is no text`;
    if (s.visible !== undefined && typeof s.visible !== "function") return `the parameter ${key}'s visible is no function of the params`;
    if (s.kind === "choice" && (!Array.isArray(s.values) || !s.values.length || s.values.some((v) => typeof v !== "string"))) return `the parameter ${key}'s values are a list of texts`;
    if (s.kind === "list") {
      if (depth > 0) return `the parameter ${key}: a list within a list`;
      const inner = specsProblem(s.of, depth + 1);
      if (inner || s.of === undefined) return `the parameter ${key}'s rows: ${inner ?? "of is missing"}`;
    }
  }
  return undefined;
}

/** A stored value read by its spec; undefined: it does not fit */
function valueOf(spec: ParamSpec, stored: unknown): unknown {
  switch (spec.kind) {
    case "number": {
      const n = typeof stored === "string" && stored.trim() !== "" ? Number(stored) : stored;
      if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
      const whole = spec.integer ? Math.round(n) : n;
      return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, whole));
    }
    case "choice":
      return typeof stored === "string" ? spec.values.find((v) => v.toLowerCase() === stored.toLowerCase()) : undefined;
    case "text":
    case "pattern":
    case "formula":
      return typeof stored === "string" ? stored : typeof stored === "number" ? String(stored) : undefined;
    case "color":
      return stored !== undefined && colorProblem(stored) === undefined ? stored : undefined;
    case "boolean":
      return typeof stored === "boolean" ? stored : undefined;
    case "style": {
      const style = checkStyle(stored);
      return typeof style === "string" || stored === undefined ? undefined : style;
    }
    case "list":
      return Array.isArray(stored)
        ? stored.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null && !Array.isArray(row)).map((row) => readParams(spec.of, row))
        : undefined;
  }
}

/** A rule's stored params read by the specs: each its value, else its default (undefined: none) */
export function readParams(specs: ParamSpecs | undefined, stored: Readonly<Record<string, unknown>> | undefined): Params {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(specs ?? {})) {
    const value = valueOf(spec, stored?.[key]);
    out[key] = value !== undefined ? value : spec.kind === "list" && spec.default ? spec.default.map((row) => readParams(spec.of, row)) : spec.default;
  }
  return out;
}

/** The params as stored: only those that differ from their default (a rule as short as it can be) */
export function storedParams(specs: ParamSpecs | undefined, params: Params): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(specs ?? {})) {
    const value = params[key];
    if (value === undefined) continue;
    if (spec.kind !== "list" && JSON.stringify(value) === JSON.stringify(spec.default)) continue;
    out[key] = value;
  }
  return out;
}
