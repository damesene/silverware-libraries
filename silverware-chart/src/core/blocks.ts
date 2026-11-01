// The fenced code blocks of a page's text: where a chart's block is, so its
// data can be written (Update data, a table's write) and a source can be
// found by its place (the table above it).

export type Block = {
  readonly language: string;
  // The block from its opening fence to the end of its closing one
  readonly from: number;
  readonly to: number;
  // Its text between the fences (without the line break before the closing fence)
  readonly bodyFrom: number;
  readonly bodyTo: number;
  readonly body: string;
};

const OPEN_RE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\s`]*)[^\n]*$/;

/** The fenced code blocks of a text, in order; one left open runs to the text's end */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let at = 0;
  let open: { language: string; fence: string; from: number; bodyFrom: number } | undefined;
  for (const line of lines) {
    const end = at + line.length;
    const content = line.replace(/\r$/, "");
    if (!open) {
      const m = OPEN_RE.exec(content);
      if (m) open = { language: m[3] ?? "", fence: m[2] ?? "```", from: at, bodyFrom: Math.min(end + 1, text.length) };
    } else {
      const closing = content.trim();
      if (closing.length >= open.fence.length && closing === (open.fence[0] ?? "`").repeat(closing.length)) {
        const bodyTo = Math.max(open.bodyFrom, at - 1);
        blocks.push({ language: open.language, from: open.from, to: end, bodyFrom: open.bodyFrom, bodyTo, body: text.slice(open.bodyFrom, bodyTo) });
        open = undefined;
      }
    }
    at = end + 1;
  }
  if (open) blocks.push({ language: open.language, from: open.from, to: text.length, bodyFrom: open.bodyFrom, bodyTo: text.length, body: text.slice(open.bodyFrom) });
  return blocks;
}

/** The block of that language and text (the first where several are the same), if the text has it */
export function blockOf(text: string, language: string, body: string): Block | undefined {
  return blocksOf(text).find((block) => block.language === language && block.body.replace(/\r/g, "") === body.replace(/\r/g, ""));
}
