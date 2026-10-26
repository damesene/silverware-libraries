// A link: `[text](url)`, the caret where the url goes; a URL selected becomes
// the target, the caret where its text goes. Recognized selected whole, or
// with the selection (or the caret) in its text or its url: taken off, its
// text left.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const WHOLE_RE = /^\[([^\]]*)\]\([^)]*\)$/;
// Its start before the selection: "[" (not an image's "![") and its text up to the selection
const START_RE = /(?<!!)\[[^\][]*/;
// Its end after the selection: the rest of its text, "](", the url, ")"
const END_RE = /[^\][]*\]\([^)]*\)/;
// Or the selection in its url: its start up to it, the rest of the url and ")"
const URL_START_RE = /(?<!!)\[[^\][]*\]\([^()]*/;
const URL_END_RE = /[^()]*\)/;

export default (helpers: Helpers): InlineDefinition => ({
  name: "link",
  scope: "inline",
  label: "Link",
  icon: helpers.icons.link,
  group: "Links",
  keywords: ["url", "href", "web", "odkaz"],
  read: (text, { before, after }) => {
    const whole = WHOLE_RE.exec(text);
    if (whole) return whole[1];
    const start = before.touching(START_RE);
    const end = after.touching(END_RE);
    if (start !== undefined && end !== undefined) return { text: start.slice(1) + text + end.slice(0, end.indexOf("](")), start, end };
    // In its url: its text is what is left
    const head = before.touching(URL_START_RE);
    const tail = after.touching(URL_END_RE);
    if (head === undefined || tail === undefined) return undefined;
    return { text: head.slice(1, head.indexOf("](")), start: head, end: tail };
  },
  write: (text) => (helpers.isUrl(text) ? `[${helpers.cursor()}](${text.trim()})` : `[${text || "link"}](${helpers.cursor()})`),
});
