// A page's embeds (`![[cat.png|A cat|200|{ view: preview }]]`, `![A cat|200|{ view: preview }](cat.png)`) as Silverware
// Layout's assets read them (docs/silverware-layout-assets.md, *How an embed is written*): the one place that knows how
// an embed's text holds its size and its metadata. Pure.
//
// SilverBullet reads an embed's alias by its first two `|` segments only (`[alias, dimPart] = text.split("|")`,
// plug-api/lib/transclusion.ts, 2.12.1): the alt text and the size (`200`, `50%`, `200x100`). A third segment it
// ignores holds the metadata, `{ key: value, … }`. So an embed with metadata is always written with three segments,
// empty ones kept (`||200|{…}`): with two, SilverBullet would read the size as the alt text.

/** One embed of a page, as written */
export type Embed = {
  // Where it is in the text
  readonly from: number;
  readonly to: number;
  // Its text as read
  readonly text: string;
  // `![[…]]` or `![…](…)`
  readonly style: "wiki" | "markdown";
  // Its target as written (a wiki link's name, a markdown link's URL)
  readonly target: string;
  readonly alt: string;
  readonly width?: string;
  readonly height?: string;
  readonly metadata: Readonly<Record<string, string>>;
  // Its alias's segments as read (a third not in braces is no metadata: an embed written with changes leaves it out)
  readonly segments: readonly string[];
};

/** What an embed is given: a value, or null (taken off); a metadata key, null to take it off */
export type EmbedChanges = {
  readonly alt?: string | null;
  readonly width?: string | null;
  readonly height?: string | null;
  readonly metadata?: Readonly<Record<string, string | null>>;
};

/** A markdown link's local URL resolved from the page's folder, as SilverBullet resolves one (`../x`, `./x`, `/x`) */
export function resolveLinkPath(page: string, url: string): string {
  if (url.startsWith("/")) return url.slice(1);
  const parts = page.split("/").slice(0, -1);
  for (const part of url.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

const WIKI = /!\[\[([^\]\n]+?)\]\]/g;
const MARKDOWN = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const CODE_SPAN = /`+[^`\n]*`+/g;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** The size a segment is (`200`, `50%`, `200x100`, `x100`), as SilverBullet reads it; none: not a size */
export function readSize(segment: string): { readonly width?: string; readonly height?: string } | undefined {
  const m = /^\s*(\d+(?:\.\d+)?%?|\.\d+%)?(?:x(\d+))?\s*$/.exec(segment);
  if (!m || (!m[1] && !m[2])) return undefined;
  return { ...(m[1] ? { width: m[1] } : {}), ...(m[2] ? { height: m[2] } : {}) };
}

/** A size written as a segment (none: "") */
export const writeSize = (width?: string, height?: string) => (width ?? "") + (height ? `x${height}` : "");

/** Metadata as a segment holds them, `{ key: value, … }` (SilverBullet's smart quotes read as quotes); none: not metadata */
export function readMetadata(segment: string): Record<string, string> | undefined {
  const text = segment.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return undefined;
  const values: Record<string, string> = {};
  const body = text.slice(1, -1);
  let at = 0;
  while (at < body.length) {
    const key = /\s*([A-Za-z_][\w-]*)\s*:\s*/y;
    key.lastIndex = at;
    const k = key.exec(body);
    if (!k) break;
    at = key.lastIndex;
    let value = "";
    const open = body[at];
    const close = open === '"' ? '"' : open === "'" ? "'" : open === "“" || open === "”" ? "”" : undefined;
    if (close) {
      let end = at + 1;
      while (end < body.length && body[end] !== close && !(close === "”" && body[end] === "“")) end++;
      value = body.slice(at + 1, end);
      at = end + 1;
    } else {
      let end = at;
      while (end < body.length && body[end] !== ",") end++;
      value = body.slice(at, end).trim();
      at = end;
    }
    values[k[1]!] = value;
    const comma = /\s*,?/y;
    comma.lastIndex = at;
    comma.exec(body);
    at = comma.lastIndex;
  }
  return values;
}

/** Metadata written as a segment: `{ key: value, … }`, a value quoted where it holds a comma, a brace, a quote or spaces round it */
export function writeMetadata(values: Readonly<Record<string, string>>): string {
  const entries = Object.entries(values);
  if (!entries.length) return "";
  const value = (v: string) => (/^[^,{}"'“”|\]]*$/.test(v) && v.trim() === v && v !== "" ? v : `"${v.replace(/"/g, "'")}"`);
  return `{ ${entries.map(([k, v]) => `${k}: ${value(v)}`).join(", ")} }`;
}

/** An embed read from its alias's segments */
function fromAlias(alias: string | undefined): Pick<Embed, "alt" | "width" | "height" | "metadata" | "segments"> {
  if (alias === undefined) return { alt: "", metadata: {}, segments: [] };
  const segments = alias.split("|");
  // SilverBullet's own reading: one segment alone may be the size (`![[a.png|200]]`)
  if (segments.length === 1) {
    const size = readSize(segments[0]!);
    return size ? { alt: "", ...size, metadata: {}, segments } : { alt: segments[0]!, metadata: {}, segments };
  }
  const size = readSize(segments[1]!) ?? {};
  const metadata = segments.length >= 3 ? (readMetadata(segments.slice(2).join("|")) ?? {}) : {};
  return { alt: segments[0]!, ...size, metadata, segments };
}

/** The embeds of a text, in order: not in a fenced code block or a code span */
export function readEmbeds(text: string): Embed[] {
  const embeds: Embed[] = [];
  let fence: string | undefined;
  let at = 0;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const mark = FENCE.exec(line)?.[1];
    if (fence !== undefined) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length && line.trim() === mark) fence = undefined;
    } else if (mark) {
      fence = mark;
    } else {
      embeds.push(...embedsOfLine(line, at));
    }
    at += raw.length + 1;
  }
  return embeds;
}

function embedsOfLine(line: string, at: number): Embed[] {
  const code = [...line.matchAll(CODE_SPAN)].map((m) => [m.index!, m.index! + m[0].length] as const);
  const inCode = (i: number) => code.some(([from, to]) => i >= from && i < to);
  const found: Embed[] = [];
  for (const m of line.matchAll(WIKI)) {
    if (inCode(m.index!)) continue;
    const inner = m[1]!;
    const bar = inner.indexOf("|");
    const target = bar < 0 ? inner : inner.slice(0, bar);
    found.push({ from: at + m.index!, to: at + m.index! + m[0].length, text: m[0], style: "wiki", target, ...fromAlias(bar < 0 ? undefined : inner.slice(bar + 1)) });
  }
  for (const m of line.matchAll(MARKDOWN)) {
    if (inCode(m.index!)) continue;
    // (A wiki embed's `![[x]]` is no markdown image)
    if (line[m.index! + 2] === "[") continue;
    const alias = m[1]!;
    found.push({ from: at + m.index!, to: at + m.index! + m[0].length, text: m[0], style: "markdown", target: m[2]!, ...fromAlias(alias === "" ? undefined : alias) });
  }
  return found.sort((a, b) => a.from - b.from);
}

/**
 * An embed written with changes, in its own style: three segments where it has metadata (`alt|size|{…}`, empty ones
 * kept), else as few as say it (`alt|size`, `alt`, none). Unchanged: its text as it was
 */
export function writeEmbed(embed: Embed, changes: EmbedChanges): string {
  const pick = (value: string | null | undefined, was: string | undefined) => (value === undefined ? was : value === null ? undefined : value);
  const alt = pick(changes.alt, embed.alt) ?? "";
  const width = pick(changes.width, embed.width);
  const height = pick(changes.height, embed.height);
  const metadata: Record<string, string> = { ...embed.metadata };
  for (const [key, value] of Object.entries(changes.metadata ?? {})) {
    if (value === null) delete metadata[key];
    else metadata[key] = value;
  }
  const same = alt === embed.alt && width === embed.width && height === embed.height && JSON.stringify(metadata) === JSON.stringify(embed.metadata);
  if (same) return embed.text;
  const size = writeSize(width, height);
  const meta = writeMetadata(metadata);
  const segments = meta ? [alt, size, meta] : size ? [alt, size] : alt ? [alt] : [];
  const alias = segments.join("|");
  return embed.style === "wiki" ? `![[${embed.target}${alias ? `|${alias}` : ""}]]` : `![${alias}](${embed.target})`;
}
