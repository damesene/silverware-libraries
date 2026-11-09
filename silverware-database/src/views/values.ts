// A value as the views draw it, the same in every view and the peek: a select's
// and a multi-select's values as pills, each option in a color of its own (by its
// place among the property's options, as Notion colors them), a value that is
// none of the options a pill of no color marked as not one; any other value as
// its type's text. The colors are the style page's, read from SilverBullet's own
// so they follow its light and dark looks.
import { el } from "../../../shared/elements.ts";
import { wholePercent } from "../domain/types/builtin/progress.ts";
import { fullAddress, isOpenable, prettyUrl, readLink } from "../domain/types/link.ts";
import { pathOf } from "../domain/folders.ts";
import { linkedDocument, type Reference, readReferences } from "../domain/types/reference.ts";
import type { ViewHost } from "../core/view.ts";
import { optionColor } from "../domain/types/options.ts";
import type { PropertyType } from "../domain/types/type.ts";
import { isEmpty, type Item, type Property, type Value } from "../model/database.ts";

/** Why an item's value of a property is wrong, as the views mark it: none where it is required, else its type's reason; none where it is right */
export function problemOf(host: Pick<ViewHost, "type">, item: Item, property: Property): string | undefined {
  const value = item.values[property.key];
  if (value === undefined || isEmpty(value)) return missing(host, item, property) ? `${property.label} is required` : undefined;
  return host.type(property).validate(value, property.params);
}

/** Whether an item lacks the value of a property required (a checkbox never does: unticked is its value) */
export function missing(host: Pick<ViewHost, "type">, item: Item, property: Property): boolean {
  // (A value turned by a press is never missing: unticked is its value)
  return !!property.required && host.type(property).editor !== "toggle" && isEmpty(item.values[property.key]);
}

/** A required value missing, as a line of values shows it: a pill of no color saying so */
export function missingPill(doc: Document, property: Property): HTMLElement {
  return el(doc, "span", { class: "swd-pill swd-pill-missing", text: `${property.label} required`, title: `${property.label} is required: no value yet` });
}

/** How many colors options go round */
export const PILL_COLORS = 8;

/** A property's options, as its params have them */
export function optionsOf(property: Property): readonly string[] {
  const options = property.params.options;
  return Array.isArray(options) ? options.filter((one): one is string => typeof one === "string") : [];
}

/**
 * A pill: a value of a select, in a color of the palette (by its place) or
 * one of the user's own (`#rrggbb`: mixed with the page's colors as the
 * palette's are); none where it is none of the options
 */
export function pill(doc: Document, text: string, color: number | `#${string}` | undefined, title?: string): HTMLElement {
  const made = el(doc, "span", { class: `swd-pill${color === undefined ? " swd-pill-none" : ""}`, text, ...(title ? { title } : {}) });
  if (typeof color === "number") made.dataset.color = String(color % PILL_COLORS);
  else if (color) {
    made.dataset.color = "own";
    made.style.setProperty("--swd-pill", readableColor(color));
  }
  return made;
}

// What a pill mixes an own color with (the style page's rule: its text 55 % the color, its ground 16 %), as
// SilverBullet's own light and dark looks have them: a color is made to read in both
const LOOKS: readonly { readonly text: readonly number[]; readonly ground: readonly number[] }[] = [
  { text: [55, 53, 47], ground: [255, 255, 255] },
  { text: [230, 230, 230], ground: [30, 30, 30] },
];
// The contrast a pill's text keeps against its ground (WCAG's for text: 4.5, a little room above it)
const CONTRAST = 4.6;

// Own colors made readable, by their text: a table draws a pill of the same color on every row
const readableOf = new Map<string, string>();

/** An own color (`#rrggbb`) as the palette's are drawn (`r, g, b`, a pill's `--swd-pill`, an item's `--swd-item`), made readable once */
export function readableColor(color: string): string {
  let made = readableOf.get(color);
  if (made === undefined) {
    made = readable([1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)) as [number, number, number]).join(", ");
    readableOf.set(color, made);
  }
  return made;
}

/** An own color as a pill takes it: its hue and saturation, the lightness nearest its own at which the pill reads in light and dark */
function readable([r, g, b]: [number, number, number]): [number, number, number] {
  const [h, s, l] = toHsl(r / 255, g / 255, b / 255);
  const at = (lightness: number) => fromHsl(h, s, lightness).map((one) => one * 255);
  const reads = (color: number[]) => LOOKS.every(({ text, ground }) => contrast(mixed(color, 0.55, text), mixed(color, 0.16, ground)) >= CONTRAST);
  for (let step = 0; step <= 100; step++)
    for (const lightness of [l - step / 100, l + step / 100]) {
      if (lightness < 0 || lightness > 1) continue;
      const color = at(lightness);
      if (reads(color)) return color.map(Math.round) as [number, number, number];
    }
  return at(0.45).map(Math.round) as [number, number, number];
}

const mixed = (color: readonly number[], share: number, other: readonly number[]) => color.map((one, at) => one * share + other[at]! * (1 - share));

function contrast(a: readonly number[], b: readonly number[]): number {
  const luminance = (rgb: readonly number[]) => {
    const [r, g, b2] = rgb.map((one) => {
      const c = one / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b2!;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const at = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (at < 1 / 6) return p + (q - p) * 6 * at;
    if (at < 1 / 2) return q;
    if (at < 2 / 3) return p + (q - p) * (2 / 3 - at) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/**
 * A value's color among a property's options: the one given its option, else its option's place's; one none of them but
 * taken by its type (a person's with Anyone) a color of the palette by its name; none where it is none of them
 */
export function choiceColor(property: Property, value: string, type?: PropertyType): number | `#${string}` | undefined {
  const listed = optionColor(property.params, value);
  if (listed !== undefined || type === undefined) return listed;
  return type.validate(type.lists ? [value] : value, property.params) === undefined ? nameColor(value) : undefined;
}

/**
 * A select's or a person's value as a pill, shown as its type shows an option (`@ada`), in its color (`choiceColor`); marked
 * where it is none of the options and not taken. A person's (`PropertyType.mentions`) looks as the page's mentions do, and
 * where `openMention` is given a press or Enter on it shows where that person is mentioned, editing nothing
 */
export function optionPill(doc: Document, property: Property, value: string, type?: PropertyType, openMention?: (name: string) => unknown): HTMLElement {
  const color = choiceColor(property, value, type);
  const text = type?.optionShown?.(value) ?? value;
  const made = pill(doc, text, color, color === undefined ? `${text}: none of ${property.label}'s options` : undefined);
  if (!type?.mentions) return made;
  made.classList.add("swd-mention");
  if (!openMention) return made;
  made.setAttribute("role", "link");
  made.tabIndex = 0;
  if (color !== undefined) made.title = `Where ${text} is mentioned`;
  const opened = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    void openMention(value);
  };
  made.addEventListener("click", opened);
  made.addEventListener("keydown", (event) => {
    if (event.key === "Enter") opened(event);
  });
  return made;
}

/** A color of the palette for a name none of the options, the same for the same name */
function nameColor(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % PILL_COLORS;
}

/** The values of a select or a multi-select, as kept (a list, or one value of another kind as its text) */
function chosen(value: Value | undefined): string[] {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/**
 * A value drawn as its type's look says (`PropertyType.look`): its options as
 * pills, a share as a bar beside its percent, a link to open, links to the
 * documents it names, labels as quiet pills; else its type's text; nothing where it is empty. A
 * checkbox is the view's own (a box to tick, or its property's name on a card).
 */
export function valueNodes(host: Pick<ViewHost, "document" | "type" | "text" | "openByName" | "openMention" | "folderSeparator">, item: Item, property: Property): Node[] {
  const doc = host.document;
  const type = host.type(property);
  const value = item.values[property.key];
  if (type.look === "options") return chosen(value).map((one) => optionPill(doc, property, one, type, host.openMention));
  // (Labels: each a quiet pill, none of them an option; a value that is no list shown as kept, marked by the view)
  if (type.look === "labels" && Array.isArray(value)) return value.map((one) => pill(doc, String(one), 0));
  // (Links only of a value that reads as the type: one that does not is shown as kept, marked by the view)
  const references = type.look === "documents" && type.validate(value ?? null, property.params) === undefined ? readReferences(value) : undefined;
  if (references) return references.map((one) => referenceNode(doc, one, host.folderSeparator, host.openByName));
  const text = host.text(item, property.key);
  if (type.look === "share" && typeof value === "number" && value >= 0 && value <= 1)
    return [el(doc, "span", { class: "swd-progress", attrs: { "aria-hidden": "true" } }, el(doc, "span", { class: "swd-progress-done", attrs: { style: `width: ${wholePercent(value)}%` } })), doc.createTextNode(text)];
  // (A link only of a value that reads as the type: one that does not is shown as kept, marked by the view)
  const link = type.look === "link" && typeof value === "string" && type.validate(value, property.params) === undefined ? readLink(value) : undefined;
  // (Its address as a browser opens it: one written without its scheme by hand, https)
  if (link && isOpenable(fullAddress(link.url))) return [linkNode(doc, { ...link, url: fullAddress(link.url) })];
  return text ? [doc.createTextNode(text)] : [];
}

/**
 * A value drawn where it stands alone (a card's line, a list's row: no header
 * names it), the one place of what that shows: a required one without a value
 * said missing (its pill names it); a box ticked its property's name (`✓ Done`,
 * unticked nothing); any other as `valueNodes` draws it, its property's name
 * before it where the property says so (`showName`: `Status: Todo`); nothing
 * where it has no value (no name alone). A view drawing values under a header
 * naming them (a table's column) draws them with `valueNodes`
 */
export function fieldNodes(host: Pick<ViewHost, "document" | "type" | "text" | "openByName" | "openMention" | "folderSeparator">, item: Item, property: Property): Node[] {
  const doc = host.document;
  if (missing(host, item, property)) return [missingPill(doc, property)];
  if (host.type(property).look === "check") return item.values[property.key] === true ? [doc.createTextNode(`✓ ${property.label}`)] : [];
  const nodes = valueNodes(host, item, property);
  return property.showName && nodes.length ? [el(doc, "span", { class: "swd-field-name", text: `${property.label}: ` }), ...nodes] : nodes;
}

/**
 * A link to open in a tab of its own: its text, else its address as read
 * (the host, the rest quieter: `github.com` `/silverbullet/issues`), its
 * address its title. A press on it opens it alone: not the value's editor
 * (pressed beside it, the value is edited)
 */
function linkNode(doc: Document, link: { readonly url: string; readonly text?: string }): HTMLElement {
  const pretty = prettyUrl(link.url);
  const shown = link.text !== undefined ? [doc.createTextNode(link.text)] : [doc.createTextNode(pretty.host), ...(pretty.rest ? [el(doc, "span", { class: "swd-link-rest", text: pretty.rest })] : [])];
  const anchor = el(doc, "a", { class: "swd-link", attrs: { href: link.url, target: "_blank", rel: "noopener noreferrer", title: link.url } }, ...shown);
  anchor.addEventListener("click", (event) => event.stopPropagation());
  return anchor;
}

/**
 * A reference: the document it names as a link (its text where it has one),
 * opened in the editor by a press or Enter, which edits nothing (pressed
 * beside it, the value is edited); a link of the page's look, not the
 * browser's: a document is opened by the host, never by an address
 */
function referenceNode(doc: Document, reference: Reference, separator: string | undefined, open: (name: string) => Promise<void>): HTMLElement {
  // (Its text where it has one; else its name, the folder of its document before it quieter, as a URL's path)
  const folder = reference.text === undefined ? pathOf(linkedDocument(reference.target), separator).folder : undefined;
  const shown =
    folder === undefined
      ? [doc.createTextNode(reference.text ?? reference.target)]
      : [el(doc, "span", { class: "swd-reference-folder", text: `${folder}${separator}` }), doc.createTextNode(reference.target.slice(folder.length + separator!.length))];
  const anchor = el(doc, "a", { class: "swd-reference", attrs: { title: reference.target, role: "link", tabindex: "0" } }, ...shown);
  const opened = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    void open(reference.target);
  };
  anchor.addEventListener("click", opened);
  anchor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") opened(event);
  });
  return anchor;
}
