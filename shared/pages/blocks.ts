// A page's fenced code blocks: where a block of a language and text is, so the
// page writer can write it anew (a plugin's block holding its state:
// Silverware Database's `silverware-database`). Pure, on the page's text.

export type CodeBlock = {
  readonly language: string;
  // What its opening fence is indented by (a block in a list item): its lines have it too
  readonly indent: string;
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
export function codeBlocksOf(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.split("\n");
  let at = 0;
  let open: { indent: string; language: string; fence: string; from: number; bodyFrom: number } | undefined;
  for (const line of lines) {
    const end = at + line.length;
    const content = line.replace(/\r$/, "");
    if (!open) {
      const m = OPEN_RE.exec(content);
      if (m) open = { indent: m[1] ?? "", language: m[3] ?? "", fence: m[2] ?? "```", from: at, bodyFrom: Math.min(end + 1, text.length) };
    } else {
      const closing = content.trim();
      if (closing.length >= open.fence.length && closing === (open.fence[0] ?? "`").repeat(closing.length)) {
        const bodyTo = Math.max(open.bodyFrom, at - 1);
        blocks.push({ indent: open.indent, language: open.language, from: open.from, to: end, bodyFrom: open.bodyFrom, bodyTo, body: text.slice(open.bodyFrom, bodyTo).replace(/\r$/, "") });
        open = undefined;
      }
    }
    at = end + 1;
  }
  if (open) blocks.push({ indent: open.indent, language: open.language, from: open.from, to: text.length, bodyFrom: open.bodyFrom, bodyTo: text.length, body: text.slice(open.bodyFrom) });
  return blocks;
}

/** A body's text as compared: its line breaks LF, no line break at its end */
export const sameBody = (body: string) => body.replace(/\r\n/g, "\n").replace(/\n+$/, "");
