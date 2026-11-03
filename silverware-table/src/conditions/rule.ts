// A rule of conditional formatting: where (its scope), which cells (a
// condition, or all), how they look (a format), whether rules after it still
// apply to the cells it formats. Rules are stored in the table's metadata row
// as JSON: a column's on its column (`conditions.-c-<column>.rules`, so the
// core keeps them with their column), the table's and named rows' on the
// table (`conditions.rules`). A condition or a format is its name, or
// [name, params] where it has params. A rule read is never dropped: one that
// does not read is kept as written (`unread`) and written back so.

/** A condition or a format a rule names, with its params as stored */
export type Ref = { readonly name: string; readonly params: Readonly<Record<string, unknown>> };

/** Where a rule applies: the table, a column (by its place), a named row */
export type RuleScope = { readonly kind: "table" } | { readonly kind: "column"; readonly column: number } | { readonly kind: "row"; readonly name: string };

export type Rule = {
  readonly scope: RuleScope;
  // None: every cell of the scope
  readonly when?: Ref;
  readonly format: Ref;
  // The rules after it leave the cells it formats alone
  readonly stop?: boolean;
  // A rule of the whole table: each column on its own (its own scale, its own top values); else, as a
  // spreadsheet's range, its columns as one
  readonly perColumn?: boolean;
  // Its place among the table's rules (the order of the dialog), as stored; rules without one after those with
  readonly at?: number;
};

/** A stored rule that does not read, kept as written: where it was, its JSON */
export type UnreadRule = { readonly scope: RuleScope; readonly unread: unknown };

export type StoredRule = Rule | UnreadRule;

export const isUnread = (rule: StoredRule): rule is UnreadRule => "unread" in rule;

/** A stored reference: "name" or ["name", { params }] */
function refOf(stored: unknown): Ref | undefined {
  if (typeof stored === "string" && stored.trim()) return { name: stored.trim(), params: {} };
  if (Array.isArray(stored) && typeof stored[0] === "string" && stored[0].trim()) {
    const params = stored[1];
    if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) return undefined;
    return { name: stored[0].trim(), params: (params as Record<string, unknown> | undefined) ?? {} };
  }
  return undefined;
}

const refText = (ref: Ref): unknown => (Object.keys(ref.params).length ? [ref.name, ref.params] : ref.name);

/** One stored rule read, of an attribute whose rules are of this scope (a table's: a row's where it says so) */
function ruleOf(stored: unknown, scope: RuleScope): StoredRule {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return { scope, unread: stored };
  const s = stored as Record<string, unknown>;
  const format = refOf(s.format);
  const when = s.when === undefined ? undefined : refOf(s.when);
  const row = s.row;
  if (!format || (s.when !== undefined && !when) || (row !== undefined && (typeof row !== "string" || scope.kind !== "table"))) return { scope, unread: stored };
  return {
    scope: typeof row === "string" ? { kind: "row", name: row } : scope,
    format,
    ...(when ? { when } : {}),
    ...(s.stop === true ? { stop: true } : {}),
    ...(s.perColumn === true && scope.kind === "table" && typeof row !== "string" ? { perColumn: true } : {}),
    ...(typeof s.at === "number" && Number.isFinite(s.at) ? { at: s.at } : {}),
  };
}

/** The rules of an attribute's value (JSON: a list of rules), of this scope */
export function rulesOf(text: string | undefined, scope: RuleScope): StoredRule[] {
  if (!text?.trim()) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return [{ scope, unread: text }];
  }
  return Array.isArray(stored) ? stored.map((s) => ruleOf(s, scope)) : [{ scope, unread: stored }];
}

/** A rule as stored (its scope said by where it is, but a row's) */
function storedOf(rule: StoredRule): unknown {
  if (isUnread(rule)) return rule.unread;
  return {
    ...(rule.scope.kind === "row" ? { row: rule.scope.name } : {}),
    ...(rule.when ? { when: refText(rule.when) } : {}),
    format: refText(rule.format),
    ...(rule.stop ? { stop: true } : {}),
    ...(rule.perColumn && rule.scope.kind === "table" ? { perColumn: true } : {}),
    ...(rule.at !== undefined ? { at: rule.at } : {}),
  };
}

/** An attribute's value for these rules (undefined: none) */
export function rulesText(rules: readonly StoredRule[]): string | undefined {
  if (!rules.length) return undefined;
  // An unread rule that was no JSON at all (the attribute's whole text) is written back as it was
  const whole = rules.length === 1 && isUnread(rules[0]!) && typeof rules[0].unread === "string" ? rules[0].unread : undefined;
  return whole ?? JSON.stringify(rules.map(storedOf));
}

/** The rules in the order they apply: by `at`, those without after, the table's before the columns' (stable otherwise) */
export function inOrder<R extends StoredRule>(rules: readonly R[]): R[] {
  const rank = (r: StoredRule) => (r.scope.kind === "column" ? 1 : 0);
  const at = (r: StoredRule) => (isUnread(r) || r.at === undefined ? Infinity : r.at);
  return rules
    .map((rule, i) => ({ rule, i }))
    .sort((a, b) => at(a.rule) - at(b.rule) || rank(a.rule) - rank(b.rule) || a.i - b.i)
    .map(({ rule }) => rule);
}

/** The rules numbered in this order (their `at`), so the order is kept wherever each is stored */
export function numbered(rules: readonly StoredRule[]): StoredRule[] {
  return rules.map((rule, at) => (isUnread(rule) ? rule : { ...rule, at }));
}
