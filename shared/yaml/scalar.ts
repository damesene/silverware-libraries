// YAML's scalars as a page's frontmatter and SilverBullet's attributes hold
// them: read as YAML 1.2's core schema reads them (a date stays text, as
// SilverBullet's index keeps it), written so that YAML reads them back whole.
// Pure: the page writer (shared/pages/) and markdown's attributes
// (shared/markdown/task.ts) both stand on it.

export type YamlScalar = string | number | boolean | null;

/** A value without a comment after it (` # …`, outside quotes; a `\"` inside double quotes is no closing quote) */
export function stripComment(value: string): string {
  let quote: string | undefined;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (quote) {
      if (c === "\\" && quote === '"') i++;
      else if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]!))) {
      // A value written `#a` at the start is a comment in YAML too: SilverBullet's YAML reads none then
      return value.slice(0, i).trim();
    }
  }
  return value.trim();
}

/** A scalar as written: its text (quotes and a comment off) and its value; undefined: not a scalar read here */
export function readScalar(raw: string): { text: string; value: YamlScalar } | undefined {
  const value = stripComment(raw);
  if (!value) return { text: "", value: null };
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) return undefined;
    try {
      const text = JSON.parse(value) as string;
      return { text, value: text };
    } catch {
      return undefined;
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) return undefined;
    const text = value.slice(1, -1).replace(/''/g, "'");
    return { text, value: text };
  }
  if (/^[[{&*!|>]/.test(value)) return undefined;
  return { text: value, value: plainValue(value) };
}

/** A plain scalar's value as YAML 1.2's core schema reads it (a date stays text, as SilverBullet's index keeps it) */
function plainValue(text: string): YamlScalar {
  if (/^(~|null|Null|NULL)$/.test(text)) return null;
  if (/^(true|True|TRUE)$/.test(text)) return true;
  if (/^(false|False|FALSE)$/.test(text)) return false;
  if (/^0x[\da-fA-F]+$/.test(text)) return parseInt(text.slice(2), 16);
  if (/^0o[0-7]+$/.test(text)) return parseInt(text.slice(2), 8);
  if (/^[-+]?(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?$/.test(text)) return Number(text);
  return text;
}

/** A text as a YAML scalar: as it is where YAML reads it so, else in quotes */
export function yamlScalar(name: string): string {
  // (Read otherwise unquoted: booleans, null, numbers, hex and octal numbers, dates as timestamps)
  return /^[\p{L}\p{N}_][\p{L}\p{N}_\-/.+]*$/u.test(name) && !/^(true|false|null|yes|no|on|off|~|[-+]?\d[\d_.]*([eE][-+]?\d+)?|0x[\da-f_]+|0o[0-7_]+|\d{4}-\d\d?-\d\d?\b.*)$/i.test(name) ? name : JSON.stringify(name);
}

/**
 * A text as a key's value that YAML reads back whole: a word as a scalar
 * (`yamlScalar`: `yes`, `123` quoted), words in quotes where YAML would read
 * them otherwise (starting with an indicator, `[x] b` a list, `@x` an error;
 * `: ` or ` #` inside; space at an end, a line break)
 */
export function yamlString(value: string): string {
  if (!/[\s,]/.test(value)) return yamlScalar(value);
  if (value !== value.trim() || /[\r\n]/.test(value)) return JSON.stringify(value);
  return /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) || /:(\s|$)|\s#/.test(value) ? JSON.stringify(value) : value;
}
