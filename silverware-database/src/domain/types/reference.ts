// A reference to another document of the space, kept as a wiki link
// (`[[Projects/Alpha]]`, a text of its own after a bar: `[[Projects/Alpha|Alpha]]`)
// in a list, one or several: so the index takes it for a link, the document
// it names lists the item among its links, and a rename of that document
// (SilverBullet's: the links in frontmatter lists followed since its build of
// main, 2026-10) writes the new name into it, nothing of the database's
// doing. One written by hand as a single link, not in a list, reads too.

/** A reference read: the document it names (as a link names it: a heading after `#` kept), the text it shows where it has one, and how it was written */
export type Reference = { readonly target: string; readonly text?: string; readonly written: string };

// One wiki link: its target (no bracket nor bar in it), then a text of its own after a bar
const LINK = String.raw`\[\[([^\][|]+?)(?:\|([^\][]*))?\]\]`;
const LINK_RE = new RegExp(`^${LINK}$`);
const LINKS_RE = new RegExp(LINK, "g");

/** A text read as one wiki link, or undefined where it is none */
export function readReference(text: string): Reference | undefined {
  const written = text.trim();
  const m = LINK_RE.exec(written);
  if (!m) return undefined;
  const target = m[1]!.trim();
  const shown = m[2]?.trim();
  return target ? (shown ? { target, text: shown, written } : { target, written }) : undefined;
}

/**
 * A value's references, in their order, or undefined where it is not a list
 * of wiki links (nor one link alone): no value of the type
 */
export function readReferences(value: unknown): readonly Reference[] | undefined {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? [value] : undefined;
  if (!parts) return undefined;
  const read = parts.map((one) => (typeof one === "string" ? readReference(one) : undefined));
  return read.every((one): one is Reference => one !== undefined) ? read : undefined;
}

/** The document a link's target names: its name, a heading after `#` or a place after `@` left out (`People/Ada#Bio`: People/Ada) */
export function linkedDocument(target: string): string {
  return target.split(/[#@]/)[0]!.trim() || target;
}

/** Why a document's name cannot be a link's target (a bracket or a bar in it), undefined where it can */
export function validateReferenceTarget(name: string): string | undefined {
  return /[[\]|]/.test(name) ? `"${name}" cannot be named by a link ([[Name]]): no bracket nor bar in it` : undefined;
}

/** A reference as kept: a wiki link to the document of that name */
export function writeReference(target: string): string {
  return `[[${target.trim()}]]`;
}

/**
 * Text typed made references, in its order: each wiki link in it as written
 * (its text kept), the parts between them split at commas each a name typed
 * plainly; a document named twice once, as first written. Nothing typed is
 * left out: a part that cannot be a name (a bracket or a bar in it) is its
 * `problem`
 */
export function typedReferences(typed: string): { readonly written: readonly string[] } | { readonly problem: string } {
  const written: string[] = [];
  const targets = new Set<string>();
  const add = (reference: Reference) => {
    if (targets.has(reference.target)) return;
    targets.add(reference.target);
    written.push(reference.written);
  };
  let at = 0;
  const plain = (text: string): string | undefined => {
    for (const name of text.split(",").map((one) => one.trim())) {
      if (!name) continue;
      const problem = validateReferenceTarget(name);
      if (problem) return problem;
      add({ target: name, written: writeReference(name) });
    }
    return undefined;
  };
  for (const m of typed.matchAll(LINKS_RE)) {
    const problem = plain(typed.slice(at, m.index));
    if (problem) return { problem };
    add(readReference(m[0])!);
    at = m.index! + m[0].length;
  }
  const problem = plain(typed.slice(at));
  return problem ? { problem } : { written };
}
