// A page's own layout, its frontmatter's `_layout` map (docs/silverware-layout.md, *Where things are stored*): its text
// width read from the page's text, and written through the page writer (shared/pages/), which alone writes a page.
// `_layout`, not `layout`: pages from static site generators use `layout: post`.
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import { readFrontmatter } from "../../../../shared/pages/frontmatter.ts";
import { isYamlMap, readYamlMap } from "../../../../shared/yaml/tree.ts";
import { readWidth, storedWidth, type Width } from "../../model/width.ts";

/** The frontmatter's key holding a page's layout */
export const LAYOUT_KEY = "_layout";

/** A page's layout as its text has it: its text width (none where it has none or it is not read) and whether `_layout` holds more */
export type PageLayout = { readonly width: Width | undefined; readonly more: boolean };

/** A page's layout read from its text */
export function pageLayoutOf(text: string): PageLayout {
  const { yaml } = readFrontmatter(text);
  if (!yaml) return { width: undefined, more: false };
  const read = readYamlMap(text.slice(yaml.from, yaml.to));
  if ("problem" in read || !isYamlMap(read.value)) return { width: undefined, more: false };
  const layout = read.value[LAYOUT_KEY];
  if (!isYamlMap(layout)) return { width: undefined, more: false };
  return { width: readWidth(layout.width), more: Object.keys(layout).some((key) => key !== "width") };
}

/**
 * A page's text width written (none: taken off, and `_layout` with it where it held nothing else), in one edit; why
 * not, as text, where the writer left the page alone
 */
export async function writePageWidth(writer: PageWriter, page: string, text: string, width: Width | undefined): Promise<string | undefined> {
  const { more } = pageLayoutOf(text);
  const changes = pageChanges()
    .page(page, (p) => {
      if (width) p.properties.set([LAYOUT_KEY, "width"], storedWidth(width));
      else if (more) p.properties.remove([LAYOUT_KEY, "width"]);
      else p.properties.remove(LAYOUT_KEY);
    })
    .build();
  const report = await writer.write(changes);
  return report.skipped[0]?.reason;
}
