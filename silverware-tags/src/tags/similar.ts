// Tags that are likely one, told by their names alone: the same but for case
// or a separator (`Todo`, `to-do`, `todo`), a plural of another (`ideas`,
// `idea`), or one letter apart at the same level (a typo: `meeting`,
// `meetnig`; names of five letters or more, so short ones are not taken for
// each other). Each group's tags most used first; the groups most used first.

export type SimilarReason = "form" | "plural" | "typo";

export type SimilarGroup = {
  // Most used first (the one to merge into, by default)
  readonly tags: readonly string[];
  // Why they are one, each kind that joined them (form, then plural, then typo)
  readonly reasons: readonly SimilarReason[];
};

// A typo told apart only in names this long or longer
const TYPO_LENGTH = 5;

/** A name as it is compared: its last level, lower case, without separators */
const formOf = (name: string) => name.toLowerCase().replace(/[-_\s]/g, "");
const parentOf = (name: string) => (name.includes("/") ? name.slice(0, name.lastIndexOf("/")).toLowerCase() : "");

/** Whether two words are one edit apart (a letter added, taken away, changed, or two side by side swapped) */
function oneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, i) => (c === b[i] ? [] : [i]));
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0]! + 1 && a[diff[0]!] === b[diff[1]!] && a[diff[1]!] === b[diff[0]!];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  return false;
}

/** The groups of tags likely one, of the tags counted by name (pages using each) */
export function similarTags(counts: ReadonlyMap<string, number>): SimilarGroup[] {
  const names = [...counts.keys()];
  // Union-find over the names, each group with the reasons that joined it
  const root = new Map(names.map((name) => [name, name]));
  const find = (name: string): string => {
    let at = name;
    while (root.get(at) !== at) at = root.get(at)!;
    root.set(name, at);
    return at;
  };
  const reasons = new Map<string, Set<SimilarReason>>();
  const join = (a: string, b: string, reason: SimilarReason) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra === rb) return;
    root.set(rb, ra);
    reasons.set(ra, new Set([...(reasons.get(ra) ?? []), ...(reasons.get(rb) ?? []), reason]));
  };
  const order: readonly SimilarReason[] = ["form", "plural", "typo"];
  // The same but for case and separators, at the same level
  const byForm = new Map<string, string>();
  for (const name of names) {
    const key = `${parentOf(name)}\u0000${formOf(name.slice(name.lastIndexOf("/") + 1))}`;
    const other = byForm.get(key);
    if (other) join(other, name, "form");
    else byForm.set(key, name);
  }
  // A plural of another: its form with "s" or "es"
  for (const [key, name] of byForm) {
    for (const ending of ["s", "es"]) {
      const plural = byForm.get(key + ending);
      if (plural) join(name, plural, "plural");
    }
  }
  // One edit apart at the same level, in names long enough
  const keys = [...byForm.keys()].filter((key) => key.split("\u0000")[1]!.length >= TYPO_LENGTH);
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const [pa, a] = keys[i]!.split("\u0000");
      const [pb, b] = keys[j]!.split("\u0000");
      if (pa === pb && oneEdit(a!, b!)) join(byForm.get(keys[i]!)!, byForm.get(keys[j]!)!, "typo");
    }
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const r = find(name);
    groups.set(r, [...(groups.get(r) ?? []), name]);
  }
  const used = (name: string) => counts.get(name) ?? 0;
  return [...groups]
    .filter(([, tags]) => tags.length > 1)
    .map(([r, tags]) => ({ tags: tags.sort((a, b) => used(b) - used(a) || a.length - b.length || a.localeCompare(b)), reasons: order.filter((reason) => reasons.get(r)?.has(reason)) }))
    .sort((a, b) => b.tags.reduce((s, t) => s + used(t), 0) - a.tags.reduce((s, t) => s + used(t), 0) || a.tags[0]!.localeCompare(b.tags[0]!));
}
