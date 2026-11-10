// A property's key made from a label (`Due date` → `due_date`), and a
// database's id from its name: what the core makes as a property is added, and
// a converter as it names the properties it reads (core/converter.ts).

/** A text made a slug: ASCII letters and digits, lower case, the rest one separator */
export function slug(text: string, separator: string): string {
  const parts = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return parts.join(separator);
}

/** A property's key from its label: `Due date` → `due_date`, starting with a letter */
export function keyFromLabel(label: string): string {
  const key = slug(label, "_");
  if (!key) return "property";
  return /^[a-z]/.test(key) ? key : `p_${key}`;
}
