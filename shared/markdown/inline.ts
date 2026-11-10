// The marks of a line of markdown as SilverBullet's parser finds them
// (client/markdown_parser/: `Hashtag`, `AtMention`, `WikiLink`, `Attribute`):
// hashtags, mentions, wiki links and attributes, each where it is in the line.
// Not in inline code, a link's target, a URL, an HTML tag or comment, an
// entity, Space Lua's `${…}`, nor escaped; nothing inside a wiki link or an
// attribute's value is a mark of its own (verified in SilverBullet 2.12.1,
// 2026-11-10: `[x: #a]` gives no tag, `[y: '@a']` no mention). One line at a
// time: what is code by its lines (fenced, indented) is the caller's to leave out.

// SilverBullet's tag (tagRegex, client/markdown_parser/constants.ts of 2.12.1
// and of main 2026-10-16): a name of characters that are not spaces nor
// punctuation, not of digits alone, not ending in a hyphen; or any text in < >
export const TAG_SOURCE = String.raw`#(?:(?:\d*[^\d\s!@#$%^&*(),.?":{}|<>\\';\/–—][^\s!@#$%^&*(),.?":{}|<>\\]*)|(?:<[^>\n]+>))(?<!-)`;

// SilverBullet's mention (atMentionRegex, constants.ts of main 2026-11-10): a
// name as a tag's, dots and apostrophes joining its parts, a possessive's `'s` not its
const NAME_CHAR = String.raw`[^\s!@#$%^&*(),.?":{}|<>\\\/'’]`;
const MENTION_SOURCE = String.raw`@(?:\d*[^\d\s!@#$%^&*(),.?":{}|<>\\\/'’]${NAME_CHAR}*(?:(?:\.|['’](?![sS](?!${NAME_CHAR})))${NAME_CHAR}+)*)`;
// What may not stand right before a mention's `@` (an e-mail address, `a.@b`, `@@b`, `+@b`, `-@b`)
const NOT_BEFORE_MENTION = /[\w.@+-]/;

// An attribute's start (attributeStartRegex, parser.ts): its name, a colon or two, the space after
const ATTRIBUTE_START = /\[([\w$]+)(::?[ \t]*)/y;

const TAG_RE = new RegExp(TAG_SOURCE, "y");
const MENTION_RE = new RegExp(MENTION_SOURCE, "y");
const ENTITY_RE = /&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/y;
const URL_RE = /https?:\/\/[^\s<>]*/y;
const HTML_RE = /<\/?[A-Za-z][^>\n]*>|<![^>\n]*>/y;

/** A mark of a line, `from`..`to` its text in the line (a hashtag's `#`, a mention's `@`, a link's brackets included) */
export type InlineMark =
  | { readonly kind: "tag"; readonly name: string; readonly from: number; readonly to: number }
  | { readonly kind: "mention"; readonly name: string; readonly from: number; readonly to: number }
  // A wiki link: the page it names as written (`Page#header`, `Page@12` too), its alias, an embed (`![[…]]`)
  | { readonly kind: "link"; readonly name: string; readonly alias?: string; readonly embed: boolean; readonly from: number; readonly to: number }
  // An attribute: its name, its value as written (YAML, the caller's to read)
  | { readonly kind: "attribute"; readonly name: string; readonly value: string; readonly from: number; readonly to: number };

/** A tag's name of its hashtag: what is in its < >, else after its # */
export function nameOfHashtag(hashtag: string): string {
  return hashtag.startsWith("#<") ? hashtag.slice(2, -1) : hashtag.slice(1);
}

const WHOLE_TAG_RE = new RegExp(`^${TAG_SOURCE}$`);
const START_TAG_RE = new RegExp(`^${TAG_SOURCE}`);

/** A name as a hashtag: `#name`, or `#<name>` where `#name` would not read as all of it (spaces, punctuation) */
export function hashtagOf(name: string): string {
  const plain = `#${name}`;
  return WHOLE_TAG_RE.test(plain) ? plain : `#<${name}>`;
}

/**
 * A name as a hashtag written before `after` (the text that follows it): in
 * < > also where `#name` would read on into that text (`#<my tag>foo` renamed
 * `b` is `#<b>foo`, not `#bfoo`)
 */
export function hashtagBefore(name: string, after: string): string {
  const tag = hashtagOf(name);
  if (tag.startsWith("#<") || !after) return tag;
  return START_TAG_RE.exec(tag + after)?.[0].length === tag.length ? tag : `#<${name}>`;
}

/**
 * A line with its attributes escaped (`\[status: x]`): shown the same, read as no attribute. SilverBullet gives the
 * attributes of a page's paragraph to the page, over its frontmatter's values (verified in 2.12.1, 2026-11-11). What
 * an attribute's value holds is escaped too (`[`, `#`, `@`, a backtick): no longer in an attribute, it would read as a
 * mark of its own (`[a: [b: c]]` an attribute `b`, `[who: @ada]` a mention)
 */
export function escapedAttributes(line: string): string {
  return inlineMarks(line)
    .filter((mark) => mark.kind === "attribute")
    .reduceRight((text, mark) => `${text.slice(0, mark.from)}${text.slice(mark.from, mark.to).replace(/[[#@`]/g, (c) => `\\${c}`)}${text.slice(mark.to)}`, line);
}

/** Where a run of brackets opened at `at` closes (the index after its `]`), counting brackets inside; -1 where it does not */
function closingBracket(text: string, at: number): number {
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return i + 1;
  }
  return -1;
}

/** Where a group opened at `at` by `open` closes, counting inside; the text's end where it does not */
function closingOf(text: string, at: number, open: string, close: string): number {
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return i + 1;
  }
  return text.length;
}

/** The marks of a line from `start`, in their order */
export function inlineMarks(line: string, start = 0): InlineMark[] {
  const marks: InlineMark[] = [];
  const sticky = (re: RegExp, at: number) => {
    re.lastIndex = at;
    return re.exec(line);
  };
  let i = start;
  while (i < line.length) {
    const c = line[i]!;
    if (c === "\\" && i + 1 < line.length) {
      i += 2;
      continue;
    }
    if (c === "`") {
      const ticks = sticky(/`+/y, i)![0];
      const close = line.indexOf(ticks, i + ticks.length);
      i = close < 0 ? i + ticks.length : close + ticks.length;
      continue;
    }
    const embed = line.startsWith("![[", i);
    if (embed || line.startsWith("[[", i)) {
      const open = embed ? i + 1 : i;
      const close = line.indexOf("]]", open + 2);
      if (close >= 0) {
        const inner = line.slice(open + 2, close);
        const bar = inner.indexOf("|");
        const name = bar < 0 ? inner : inner.slice(0, bar);
        marks.push({ kind: "link", name, ...(bar < 0 ? {} : { alias: inner.slice(bar + 1) }), embed, from: i, to: close + 2 });
        i = close + 2;
        continue;
      }
    }
    if (c === "[") {
      const attribute = sticky(ATTRIBUTE_START, i);
      const end = attribute ? closingBracket(line, i) : -1;
      // A `]` followed by `(` is a link's text, not an attribute
      if (attribute && end > 0 && line[end] !== "(") {
        marks.push({ kind: "attribute", name: attribute[1]!, value: line.slice(i + attribute[0].length, end - 1), from: i, to: end });
        i = end;
        continue;
      }
    }
    if (line.startsWith("](", i)) {
      i = closingOf(line, i + 1, "(", ")");
      continue;
    }
    if (line.startsWith("<!--", i)) {
      const close = line.indexOf("-->", i + 4);
      i = close < 0 ? line.length : close + 3;
      continue;
    }
    if (line.startsWith("${", i)) {
      i = closingOf(line, i + 1, "{", "}");
      continue;
    }
    const skipped = (c === "<" && sticky(HTML_RE, i)) || (c === "&" && sticky(ENTITY_RE, i)) || (c === "h" && sticky(URL_RE, i));
    if (skipped) {
      i += skipped[0].length;
      continue;
    }
    if (c === "#") {
      const tag = sticky(TAG_RE, i)?.[0];
      if (tag) {
        marks.push({ kind: "tag", name: nameOfHashtag(tag), from: i, to: i + tag.length });
        i += tag.length;
        continue;
      }
    }
    if (c === "@" && !(i > 0 && NOT_BEFORE_MENTION.test(line[i - 1]!))) {
      const mention = sticky(MENTION_RE, i)?.[0];
      if (mention) {
        marks.push({ kind: "mention", name: mention.slice(1), from: i, to: i + mention.length });
        i += mention.length;
        continue;
      }
    }
    i++;
  }
  return marks;
}
