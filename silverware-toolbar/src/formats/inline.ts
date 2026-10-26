// The inline engine: a format toggled on a selection, each line's part of it
// apart (markdown's inline formats end at a block's end), the spaces at its
// ends and a line's block marker left out, lines no format may change (code,
// a table, a rule) left alone; a caret is a part of its own. On when every
// part has the format; toggling then takes it off every part, else puts it on
// those without it. It knows no format by name:
// - a format of markers (`**`) is read around the part through other
//   formats' markers between (`**_x_**`), or as a pair at the part's ends, or
//   with the part inside a pair (taken off the part only: `**wo**r**d**`; a
//   caret: the pair taken off); put on, its own pairs inside merge into one;
// - a format of its own reads and writes (a link) is read by its `read`,
//   given the line around the part, and says how far it reaches past it.
// A literal format (code) is not put inside: another format on its content
// is not offered, and put on text, it takes the other formats' markers off.
import type { Change, Context } from "../core/action.ts";
import { afterOf } from "./after.ts";
import type { Format, Found, Side } from "./format.ts";
import { type TextLine, textLines } from "./lines.ts";
import { formatsIn } from "./registry.ts";

type Part = { readonly from: number; readonly to: number; readonly line: TextLine };

/** The parts of the lines a selection touches that a format applies to: from..to in the page's text (a caret: empty) */
export function partsOf(context: Context): Part[] {
  const lines = textLines(context);
  if (context.from === context.to) {
    const line = lines[0]!;
    return !line.fixed && context.from >= line.start ? [{ from: context.from, to: context.to, line }] : [];
  }
  const parts: Part[] = [];
  for (const line of lines) {
    if (line.fixed) continue;
    let from = Math.max(context.from, line.start);
    let to = Math.min(context.to, line.to);
    while (from < to && /\s/.test(context.text[from]!)) from++;
    while (to > from && /\s/.test(context.text[to - 1]!)) to--;
    if (from < to) parts.push({ from, to, line });
  }
  return parts;
}

// A format found on a part: the span it takes in the page's text, the plain
// text it leaves there when taken off, and how much of that text is not the
// part's (before, after: so the part's own text stays selected)
type Span = { readonly from: number; readonly to: number; readonly text: string; readonly around: readonly [number, number] };

/** The characters the formats' markers are written with, for reading runs of them */
function markerChars(): Set<string> {
  return new Set(formatsIn("inline").flatMap((f) => (f.markers ?? []).map((m) => m[0]!)));
}

type Group = { readonly ch: string; readonly start: number; readonly length: number };

/** The runs of marker characters right before `at` (going back) or right after it, the nearest first, each one character repeated */
function groups(text: string, at: number, step: 1 | -1, chars: Set<string>): Group[] {
  const found: Group[] = [];
  let i = step > 0 ? at : at - 1;
  while (i >= 0 && i < text.length && chars.has(text[i]!)) {
    const ch = text[i]!;
    let length = 0;
    while (text[i] === ch) {
      length++;
      i += step;
    }
    found.push({ ch, start: step > 0 ? i - length : i + 1, length });
  }
  return found;
}

/** Whether a run of a marker's character holds that marker: a one-character one odd times (italic's * in *x* and ***x***, not in **x**), a longer one at least once */
function fits(marker: string, length: number): boolean {
  return marker.length === 1 ? length % 2 === 1 : length >= marker.length;
}

/**
 * Where a part's marker is, if the format wraps it: `left` and `right`, the
 * marker's places before and after the text. Around the part (outside),
 * through other formats' markers between (`**_x_**`: bold around x), those
 * on both sides matching; or the part's own first and last characters
 * (inside), a pair: no run of the marker between them that could close it
 * (`_a_ b _c_` is two italics, `*a **b** c*` one; snake_case's _ is in a word).
 */
function wrapping(text: string, from: number, to: number, markers: readonly string[], chars: Set<string>): { marker: string; left: number; right: number } | undefined {
  for (const marker of markers) {
    const n = marker.length;
    const ch = marker[0]!;
    const before = groups(text, from, -1, chars);
    const after = groups(text, to, 1, chars);
    for (let j = 0; j < Math.min(before.length, after.length); j++) {
      const l = before[j]!;
      const r = after[j]!;
      if (l.ch !== r.ch) break;
      // The marker's innermost characters of the run (***x***: italic's * next to x)
      if (l.ch === ch && fits(marker, l.length) && fits(marker, r.length)) return { marker, left: l.start + l.length - n, right: r.start };
    }
    const head = groups(text, from, 1, chars)[0];
    const tail = groups(text, to, -1, chars)[0];
    // One marker outside the part, the other inside its end: a selection over lines formatted before holds the
    // markers of the lines it goes on past (`one.**` on the first, `**Two` on the next)
    const outsideBefore = before[0];
    const outsideAfter = after[0];
    if (outsideBefore?.ch === ch && tail?.ch === ch && fits(marker, outsideBefore.length) && fits(marker, tail.length) && tail.start > from) {
      const core = text.slice(from, tail.start);
      if (core.trim() !== "" && !closes(core, marker)) return { marker, left: outsideBefore.start + outsideBefore.length - n, right: tail.start + tail.length - n };
    }
    if (head?.ch === ch && outsideAfter?.ch === ch && fits(marker, head.length) && fits(marker, outsideAfter.length) && head.start + head.length < to) {
      const core = text.slice(head.start + head.length, to);
      if (core.trim() !== "" && !closes(core, marker)) return { marker, left: head.start, right: outsideAfter.start };
    }
    if (!head || !tail || head.ch !== ch || tail.ch !== ch || head.start + head.length > tail.start) continue;
    if (!fits(marker, head.length) || !fits(marker, tail.length)) continue;
    const core = text.slice(head.start + head.length, tail.start);
    if (core.trim() === "" || closes(core, marker)) continue;
    return { marker, left: head.start, right: tail.start + tail.length - n };
  }
  return undefined;
}

/** Whether a text has a run of the marker that could end a pair (not one inside a word, for _) */
function closes(text: string, marker: string): boolean {
  const ch = marker[0]!;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ch) continue;
    let length = 0;
    while (text[i + length] === ch) length++;
    const inWord = ch === "_" && /[\p{L}\p{N}]/u.test(text[i - 1] ?? "") && /[\p{L}\p{N}]/u.test(text[i + length] ?? "");
    if (!inWord && fits(marker, length)) return true;
    i += length - 1;
  }
  return false;
}

// A code span: a run of backticks, its text, the same run (`` a`b ``)
const CODE_SPAN_RE = /(?<![\\`])(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;
const pairs = new Map<string, RegExp>();

/**
 * Pairs of a marker in a text: not escaped with \, the text between them not
 * starting or ending with a space; `_` not inside a word (snake_case is no
 * italic); backticks as code spans (a run, its text, the same run)
 */
function pairRe(marker: string): RegExp {
  if (marker[0] === "`") return CODE_SPAN_RE;
  let re = pairs.get(marker);
  if (!re) {
    // Only syntax characters are escaped (under the u flag \_ or \= is no escape)
    const e = marker.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const c = e.slice(0, e.length / marker.length);
    const word = marker[0] === "_" ? "(?<![\\p{L}\\p{N}])" : "";
    const after = marker[0] === "_" ? "(?![\\p{L}\\p{N}])" : "";
    // Each marker a run of its own: not a part of a longer one (italic's * in **x**)
    const open = `(?<!\\\\|${c})${e}(?!${c})`;
    const close = `(?<!\\\\|${c})${e}(?!${c})`;
    re = new RegExp(`${word}${open}(?=\\S)(.+?)(?<=\\S)${close}${after}`, "gu");
    pairs.set(marker, re);
  }
  return re;
}

/** A pair of the format's markers on the line with at..to (the caret: at) inside its content, the innermost */
function pairAround(text: string, line: TextLine, at: number, markers: readonly string[], to = at): { marker: string; left: number; right: number } | undefined {
  let best: { marker: string; left: number; right: number } | undefined;
  const content = text.slice(line.start, line.to);
  for (const marker of markers) {
    const re = pairRe(marker);
    re.lastIndex = 0;
    for (let m = re.exec(content); m; m = re.exec(content)) {
      const open = marker[0] === "`" ? m[1]!.length : marker.length;
      const left = line.start + m.index;
      const right = left + m[0].length - open;
      if (left + open <= at && to <= right && (!best || left > best.left)) best = { marker: marker[0] === "`" ? m[1]! : marker, left, right };
    }
  }
  return best;
}

/** One side of a part on its line, as a format's read gets it */
function sideOf(text: string, before: boolean): Side {
  return {
    text,
    touching: (what) => {
      if (typeof what === "number") return Number.isInteger(what) && what >= 0 && what <= text.length ? (before ? text.slice(text.length - what) : text.slice(0, what)) : undefined;
      if (typeof what === "string") return (before ? text.endsWith(what) : text.startsWith(what)) ? what : undefined;
      const flags = what.flags.replace(/[gym]/g, "");
      const re = new RegExp(before ? `(?:${what.source})$` : `^(?:${what.source})`, flags);
      return re.exec(text)?.[0];
    },
  };
}

/** Where the format is on a part, if it has it there */
function found(context: Context, format: Format, part: Part): Span | undefined {
  const { text } = context;
  const { from, to, line } = part;
  if (format.markers) {
    if (from === to) {
      const pair = pairAround(text, line, from, format.markers);
      if (!pair) return undefined;
      const n = pair.marker.length;
      return { from: pair.left, to: pair.right + n, text: text.slice(pair.left + n, pair.right), around: [from - (pair.left + n), pair.right - from] };
    }
    const w = wrapping(text, from, to, format.markers, markerChars());
    if (!w) {
      // Inside a pair: taken off the part only, the pair closed before it and opened after it (`**wo**r**d**`)
      const pair = pairAround(text, line, from, format.markers, to);
      if (!pair) return undefined;
      const n = pair.marker.length;
      const head = from === pair.left + n;
      const tail = to === pair.right;
      const close = head ? "" : pair.marker;
      const open = tail ? "" : pair.marker;
      return { from: head ? pair.left : from, to: tail ? pair.right + n : to, text: close + text.slice(from, to) + open, around: [close.length, open.length] };
    }
    const n = w.marker.length;
    const a = Math.min(w.left, from);
    const b = Math.max(w.right + n, to);
    // The part's text where it is in what is left: what was between it and the markers kept
    return {
      from: a,
      to: b,
      text: text.slice(a, w.left) + text.slice(w.left + n, w.right) + text.slice(w.right + n, b),
      around: [Math.max(0, from - (w.left + n)), Math.max(0, w.right - to)],
    };
  }
  if (!format.readInline) return undefined;
  const before = text.slice(line.start, from);
  const after = text.slice(to, line.to);
  const read: Found | undefined = format.readInline(text.slice(from, to), { index: line.index, before: sideOf(before, true), after: sideOf(after, false) });
  if (read === undefined) return undefined;
  const { text: plain, start = "", end = "" } = typeof read === "string" ? { text: read } : read;
  if (!before.endsWith(start) || !after.startsWith(end)) throw new Error(`${format.name}'s read gave a start or end that does not touch the selection`);
  return { from: from - start.length, to: to + end.length, text: plain, around: [0, 0] };
}

/** Whether the format is on for the whole selection (every part has it; a caret: inside it) */
export function isOn(context: Context, format: Format): boolean {
  const parts = partsOf(context);
  return parts.length > 0 && parts.every((part) => found(context, format, part));
}

/** Whether the format can be toggled: the selection has text to format, none of it inside a literal format's content (code) */
export function canFormat(context: Context, format: Format): boolean {
  const parts = partsOf(context);
  if (!parts.length) return false;
  const literals = formatsIn("inline").filter((f) => f.literal && f !== format);
  return !parts.some((part) => literals.some((literal) => inside(context, literal, part)));
}

/** Whether a part is in a format's content (not the whole of it: selected whole, it may be wrapped) */
function inside(context: Context, format: Format, part: Part): boolean {
  if (format.markers) return !!pairAround(context.text, part.line, part.from, format.markers, part.to);
  const span = found(context, format, part);
  return !!span && (span.from < part.from || span.to > part.to);
}

/**
 * The format toggled on the selection; undefined: nothing to change. Put on,
 * a part's own pairs of it inside go, so it is wrapped once (`~~x~~ y` struck:
 * `~~x y~~`); a literal format takes the others' markers off its text.
 */
export function toggle(context: Context, format: Format): Change | undefined {
  const { text } = context;
  const parts = partsOf(context).map((part) => ({ part, span: found(context, format, part) }));
  if (!parts.length) return undefined;
  const off = parts.every((p) => p.span);
  const change = rewrite(
    text,
    parts.map(({ part, span }) => {
      if (off && span) return span;
      // Already formatted while others are not: left as it is
      if (span) return { from: part.from, to: part.to, text: text.slice(part.from, part.to), around: [0, 0] as const };
      const own = text.slice(part.from, part.to);
      const content = format.literal ? plain(own) : own;
      if (format.markers) {
        const marker = format.markers[0]!;
        const inner = withoutPairs(content, format.markers);
        return { from: part.from, to: part.to, text: marker + inner + marker, around: [marker.length, marker.length] as const };
      }
      return { from: part.from, to: part.to, text: format.writeInline!(content, { index: part.line.index }), around: [0, 0] as const };
    }),
  );
  return change && !off ? { ...change, ...afterOf(format, change.from) } : change;
}

/**
 * Spans of the text, in order, given new texts: one change from the first
 * span's start to the last one's end, the text between them kept; the
 * selection from the first new text to the last one (`around`: the markers at
 * its ends left out of the selection)
 */
function rewrite(text: string, spans: readonly Span[]): Change | undefined {
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (!first || !last) return undefined;
  let out = "";
  let at = first.from;
  let selectFrom = -1;
  let selectTo = -1;
  for (const span of spans) {
    out += text.slice(at, span.from);
    const [before, after] = span.around;
    if (selectFrom < 0) selectFrom = first.from + out.length + before;
    out += span.text;
    selectTo = first.from + out.length - after;
    at = span.to;
  }
  if (out === text.slice(first.from, last.to)) return undefined;
  return { from: first.from, to: last.to, insert: out, select: { from: selectFrom, to: selectTo } };
}

/** A text's pairs of these markers taken off, their text kept */
function withoutPairs(text: string, markers: readonly string[]): string {
  return markers.reduce((t, m) => t.replace(pairRe(m), m[0] === "`" ? "$2" : "$1"), text);
}

/**
 * A text's marker formats taken off: what is in a literal one (a code span)
 * kept as written, its markers gone; the longer markers first, so `**` is not
 * read as two `*`
 */
function plain(text: string): string {
  const formats = formatsIn("inline").filter((f) => f.markers);
  const literal = formats.filter((f) => f.literal).flatMap((f) => f.markers!);
  const others = formats
    .filter((f) => !f.literal)
    .flatMap((f) => f.markers!)
    .sort((a, b) => b.length - a.length);
  const strip = (s: string) => withoutPairs(s, others);
  // The literal formats' spans, in order, kept as they are
  const spans: { from: number; to: number; inner: string }[] = [];
  for (const marker of literal) {
    const re = pairRe(marker);
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const span = { from: m.index, to: m.index + m[0].length, inner: marker[0] === "`" ? m[2]! : m[1]! };
      if (!spans.some((s) => s.from < span.to && span.from < s.to)) spans.push(span);
    }
  }
  spans.sort((a, b) => a.from - b.from);
  let out = "";
  let at = 0;
  for (const span of spans) {
    out += strip(text.slice(at, span.from)) + span.inner;
    at = span.to;
  }
  return out + strip(text.slice(at));
}

/** Every marker format taken off the selection: the markers around each part and the pairs inside it */
export function clear(context: Context): Change | undefined {
  const { text } = context;
  if (context.from === context.to) return undefined;
  const markers = formatsIn("inline")
    .flatMap((f) => f.markers ?? [])
    .sort((a, b) => b.length - a.length);
  return rewrite(
    text,
    partsOf(context).map((p) => {
      let a = p.from;
      let b = p.to;
      // The markers around it, as many as there are (bold and italic: ***x***)
      for (let again = true; again; ) {
        again = false;
        for (const m of markers) {
          if (text.slice(a - m.length, a) === m && text.slice(b, b + m.length) === m) {
            a -= m.length;
            b += m.length;
            again = true;
            break;
          }
        }
      }
      return { from: a, to: b, text: plain(text.slice(p.from, p.to)), around: [0, 0] as const };
    }),
  );
}

/** Whether there is anything to clear: the selection has text to format */
export function canClear(context: Context): boolean {
  return context.from < context.to && partsOf(context).length > 0;
}
