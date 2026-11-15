// Files inserted (docs/silverware-assets-insert.md), what is pure of it: a file's name and path, what SilverBullet would
// refuse of a path and the name offered for it, names taken apart in a batch, the markdown written for each, and
// whether a paste's clipboard is files to take. Pure.
import { writeMetadata } from "../../../shared/markdown/embed.ts";
import type { InsertAs, View } from "../model/settings.ts";
import { mimeOf } from "./choose.ts";

/** A file's name by the date and time, as SilverBullet names a file pasted without one: `2026-11-15_13-09-48` (local time) */
export function timestampName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}_${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
}

// A file's extension by its MIME type, where its subtype is none (`svg+xml`, `jpeg`, `quicktime`)
const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tif",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
};

/** The extension of a MIME type (its subtype where it is a plain word), `bin` where it gives none */
export function extensionOf(mime: string): string {
  const type = mime.toLowerCase().split(";")[0]!.trim();
  if (EXTENSIONS[type]) return EXTENSIONS[type];
  const subtype = type.split("/")[1] ?? "";
  return /^[a-z0-9]+$/.test(subtype) ? subtype : "bin";
}

/** Where a file comes from: the clipboard and the camera give no name of the user's (`image.png`) */
export type FileSource = "clipboard" | "camera" | "drop" | "upload";

/** A file's name as offered: its own, else (none, or of the clipboard or the camera) the date and time and the extension of its type */
export function nameOf(file: { readonly name: string; readonly type: string }, source: FileSource, now: Date): string {
  const own = file.name.trim();
  if (own && source !== "clipboard" && source !== "camera") return own;
  const ext = /\.([a-z0-9]+)$/i.exec(own)?.[1]?.toLowerCase() ?? extensionOf(file.type);
  return `${timestampName(now)}.${ext}`;
}

/** The folder a page is in, from the space's top (`Notes/Daily` of `Notes/Daily/Today`; none of `Today`) */
export const folderOf = (page: string): string => (page.includes("/") ? page.slice(0, page.lastIndexOf("/")) : "");

/** A file's path in a folder */
export const pathIn = (folder: string, name: string): string => (folder ? `${folder}/${name}` : name);

/**
 * Why SilverBullet would refuse a file's path, as text; none where it takes it. Its rules (`refRegex` of
 * `plug-api/lib/ref.ts`, SilverBullet 2.12.1 and main 2026-11-15) copied: not empty; none of `@ # | < > $`; not
 * starting with a dot or `^`; no part `.` or `..`, no empty part; no `[[` nor `]]`; no `.md` after another extension
 * (a page's name); and none of what a disk refuses in the file's own name (`\ : * ? "`) nor a control character
 */
export function validateFilePath(path: string): string | undefined {
  if (!path.trim()) return "the name is empty";
  if (path !== path.trim()) return "the name starts or ends with a space";
  const bad = /[@#|<>$\u0000-\u001f]/.exec(path);
  if (bad) return `the name has a "${bad[0]}" in it`;
  // (What a disk refuses in a file's name: its own name's alone, a folder of the space's may have it)
  const disk = /[\\:*?"]/.exec(path.slice(path.lastIndexOf("/") + 1));
  if (disk) return `the file's name has a "${disk[0]}" in it`;
  if (/^\/?[.^]/.test(path)) return "the name starts with a dot or ^";
  if (path.split("/").some((part) => part === "" || part === "." || part === "..")) return "the path has an empty part, or . or ..";
  if (/\[\[|\]\]/.test(path)) return "the name has [[ or ]] in it";
  if (/\.[a-zA-Z0-9]+\.md$/.test(path)) return "the name ends in .md after another extension";
  return undefined;
}

/** A name SilverBullet would refuse made one it takes: what it refuses taken out, its start's dots too; nothing left: `file.<ext>` */
export function cleanName(name: string, ext: string): string {
  const refused = (text: string) => text.replace(/[@#|<>$\\:*?"/\u0000-\u001f]|\[\[|\]\]/g, "");
  // (Its name and its extension apart: a name of nothing but what is refused is no name, its extension kept)
  const dot = name.lastIndexOf(".");
  const own = dot > 0 ? refused(name.slice(dot + 1)).replace(/[^a-zA-Z0-9]/g, "") : "";
  let stem = refused(dot > 0 ? name.slice(0, dot) : name)
    .replace(/^[.^\s]+/, "")
    .replace(/[.\s]+$/, "");
  // (A page's name, `x.png.md`, is no file's)
  if (own.toLowerCase() === "md" && /\.[a-zA-Z0-9]+$/.test(stem)) return `${stem}`;
  if (!stem) stem = "file";
  return `${stem}.${own || ext}`;
}

/** A path with `-N` before its extension (`photo-2.jpg`) */
const numbered = (path: string, n: number): string => {
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  return dot > slash + 1 ? `${path.slice(0, dot)}-${n}${path.slice(dot)}` : `${path}-${n}`;
};

/**
 * The paths of a batch taken apart: each its own unless an earlier row of the batch has it, else the first `-N` free of
 * the batch and of what `taken` says is in the space where `keepBoth` asks so. Case alike (a disk that does not tell
 * case would write one over the other)
 */
export function pathsApart(wanted: readonly string[], taken: (path: string) => boolean, keepBoth: (index: number) => boolean = () => false): string[] {
  const used = new Set<string>();
  return wanted.map((path, index) => {
    const free = (one: string) => !used.has(one.toLowerCase()) && !(keepBoth(index) && taken(one));
    let out = path;
    for (let n = 1; !free(out); n++) out = numbered(path, n);
    used.add(out.toLowerCase());
    return out;
  });
}

/** How a link is written: SilverBullet's `defaultLinkStyle` (`wikilink`, else a markdown link) */
export type LinkStyle = "wikilink" | "markdown";

/** A page's or file's name in a markdown link's URL, as SilverBullet writes it (`encodePageURI`: its slashes kept) */
const encodedPath = (path: string): string => encodeURIComponent(path).replace(/%2F/g, "/");

/**
 * The markdown of a file inserted: a link in the link style (`[[path]]`, `[path](path)`), or an embed (`![[path]]`),
 * its view written in its metadata where it is not the one *Show as* gives its type (`configured`: the view
 * configured, not the one drawn)
 */
export function markdownOf(path: string, as: Exclude<InsertAs, "shown">, configured: View, style: LinkStyle): string {
  if (as === "link") return style === "wikilink" ? `[[${path}]]` : `[${path}](${encodedPath(path)})`;
  return as === configured ? `![[${path}]]` : `![[${path}|||${writeMetadata({ view: as })}]]`;
}

/**
 * The markdown of several files inserted at once: links a space apart; embeds a line each, or a space apart where they
 * go into a line of text (a table's row, mid-line). In a list's item, each line after the first indented as its
 * continuation (`indent`)
 */
export function joinedMarkdown(parts: readonly { readonly text: string; readonly embed: boolean }[], inLine: boolean, indent = ""): string {
  if (inLine || parts.every((part) => !part.embed)) return parts.map((part) => part.text).join(" ");
  return parts.map((part) => part.text).join(`\n${indent}`);
}

/**
 * Where files are put in a text, as the line round `from` says: into the line (a table's row, text beside it: the files
 * a space apart), and the indent of a list's item's lines after its first (its marker's width)
 */
export function placeIn(text: string, from: number, to: number): { readonly inLine: boolean; readonly indent: string; readonly before: string; readonly after: string } {
  const start = text.lastIndexOf("\n", from - 1) + 1;
  const endAt = text.indexOf("\n", to);
  const end = endAt < 0 ? text.length : endAt;
  const line = text.slice(start, end);
  const before = text.slice(start, from);
  const after = text.slice(to, end);
  const item = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/.exec(line);
  const inLine = /^\s*\|/.test(line) || (!!before.trim() && !(item && before.trim() === item[1]!.trim())) || !!after.trim();
  // (Into a line: a space apart from the text right beside it)
  const spaced = (char: string | undefined) => (inLine && char !== undefined && !/\s/.test(char) ? " " : "");
  return { inLine, indent: item ? " ".repeat(item[1]!.length) : "", before: spaced(from > 0 ? text[from - 1] : undefined), after: spaced(to < text.length ? text[to] : undefined) };
}

/** What a paste's clipboard holds, as its types and HTML say (read in the event: `types`, `getData("text/html")`) */
export type ClipboardKinds = { readonly files: number; readonly types: readonly string[]; readonly html: string };

/**
 * Whether a paste is files to take: where SilverBullet would upload them (files, no HTML: a file copied in a file
 * manager, its name as plain text beside it, is uploaded by SilverBullet too), and a web page's image (*Copy image*:
 * HTML of that image alone, which SilverBullet would make a link to its URL). HTML with text is a part of a page or a
 * document (Word gives an image of its text beside it): SilverBullet's, made markdown
 */
export function takesPaste(kinds: ClipboardKinds): boolean {
  if (!kinds.files) return false;
  if (!kinds.types.includes("text/html")) return true;
  const text = kinds.html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(meta|img|br)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return !text && /<img\b/i.test(kinds.html);
}

/**
 * A place in a text moved by what was changed in it since (the text then and now, apart in one run: what is the same at
 * their start and at their end kept): before the change it stays, after it it moves with it; none where the change
 * took it in (typed over, or the whole text changed round it)
 */
export function mappedPlace(then: string, now: string, from: number, to: number): { readonly from: number; readonly to: number } | undefined {
  if (then === now) return { from, to };
  let start = 0;
  const shortest = Math.min(then.length, now.length);
  while (start < shortest && then[start] === now[start]) start++;
  let end = 0;
  while (end < shortest - start && then[then.length - 1 - end] === now[now.length - 1 - end]) end++;
  const changedTo = then.length - end;
  const shift = now.length - then.length;
  if (to <= start) return { from, to };
  if (from >= changedTo) return { from: from + shift, to: to + shift };
  return undefined;
}

/** A URL of the web written into a markdown link or image: what would end it or break it encoded */
const webUrl = (url: string): string => url.replace(/[\s()<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);

/**
 * The markdown of a file of the web linked, not kept in the space: a link (`[name](url)`), or an image's embed
 * (`![](url)`), its view in its metadata where it is not the one *Show as* gives its type (`![||{ view: icon }](url)`:
 * SilverBullet reads the first two segments as the alt text and the size)
 */
export function webMarkdownOf(url: string, name: string, as: Exclude<InsertAs, "shown">, configured: View): string {
  if (as === "link") return `[${name.replace(/[[\]]/g, "")}](${webUrl(url)})`;
  return as === configured ? `![](${webUrl(url)})` : `![||${writeMetadata({ view: as })}](${webUrl(url)})`;
}

/** A file's name in a URL of the web: its path's last part, decoded (none: `image`) */
export function webNameOf(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last) || "image";
  } catch {
    return "image";
  }
}

/** An attribute's value as HTML writes it, its character references read (`&amp;`, `&#38;`, `&#x26;`, `&quot;`) */
const attributeText = (value: string): string =>
  value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|quot|apos|lt|gt));/gi, (whole, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" } as Record<string, string>)[name!.toLowerCase()] ?? whole;
  });

/**
 * The address on the web of the one file a paste or a drop carries, where the browser gives it: an image copied from a
 * web page (its HTML that image alone, `<img src>`), dragged from one (its `text/uri-list`); an `http(s)` URL alone,
 * whose name says it is an image (SilverBullet draws an image of a URL by its extension, Silverware Assets takes its
 * type so: one without draws as no image). None where there are more files or none is said
 */
export function webUrlOf(kinds: { readonly files: number; readonly html: string; readonly uriList?: string }): string | undefined {
  if (kinds.files !== 1) return undefined;
  const web = (url: string | undefined) => {
    const trimmed = url?.trim();
    return trimmed && /^https?:\/\/\S+$/i.test(trimmed) && mimeOf({ kind: "web", url: trimmed }).startsWith("image/") ? trimmed : undefined;
  };
  // (Its `src` alone, not a lazy page's `data-src`)
  const images = [...kinds.html.matchAll(/<img\b[^>]*?(?<![\w-])src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((match) => attributeText(match[1] ?? match[2] ?? match[3] ?? ""));
  if (images.length === 1 && web(images[0])) return web(images[0]);
  const listed = (kinds.uriList ?? "").split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  return listed.length === 1 ? web(listed[0]) : undefined;
}
