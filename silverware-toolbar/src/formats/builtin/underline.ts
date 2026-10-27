// Underline: `<u>text</u>`, HTML's, as markdown has none (SilverBullet shows
// it underlined). Its tags around the selection, or around it on its line (a
// caret within them), are read as the format on; taken off, the text is left.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const WHOLE_RE = /^<u>([\s\S]*)<\/u>$/;
// Its tags reaching past the selection on its line: no other tag between them and it
const START_RE = /<u>[^<]*/;
const END_RE = /[^<]*<\/u>/;

export default (helpers: Helpers): InlineDefinition => ({
  name: "underline",
  scope: "inline",
  label: "Underline",
  icon: helpers.icons.underline,
  group: "Format",
  keywords: ["underlined", "u", "podtržené"],
  read: (text, { before, after }) => {
    const whole = WHOLE_RE.exec(text);
    if (whole) return whole[1]!;
    const start = before.touching(START_RE);
    const end = after.touching(END_RE);
    return start === undefined || end === undefined ? undefined : { text: start.slice(3) + text + end.slice(0, -4), start, end };
  },
  write: (text) => `<u>${text || helpers.cursor()}</u>`,
});
