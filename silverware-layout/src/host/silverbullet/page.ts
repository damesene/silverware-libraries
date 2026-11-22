// A page's own layout, its frontmatter's `_layout` map (docs/silverware-layout.md, *Where things are stored*): its text's
// width and alignment (docs/silverware-layout-text-align.md) read from the page's text, and written through the page
// writer (shared/pages/), which alone writes a page.
// `_layout`, not `layout`: pages from static site generators use `layout: post`.
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import { readFrontmatter } from "../../../../shared/pages/frontmatter.ts";
import { isYamlMap, readYamlMap } from "../../../../shared/yaml/tree.ts";
import { readTextAlign, type TextAlign } from "../../model/settings.ts";
import { readTextWidth, storedWidth, type Width } from "../../model/width.ts";

/** The frontmatter's key holding a page's layout */
export const LAYOUT_KEY = "_layout";

/** A page's own text width and alignment (each none where it has none or it is not read) */
export type PageTextLayout = { readonly width: Width | undefined; readonly align: TextAlign | undefined };

/** A page's layout as its text has it: its text's width and alignment, and whether `_layout` holds more */
export type PageLayout = PageTextLayout & { readonly more: boolean };

// The keys of `_layout` Silverware Layout writes here
const OWN_KEYS = ["width", "align"];

/** A page's layout read from its text */
export function pageLayoutOf(text: string): PageLayout {
  const { yaml } = readFrontmatter(text);
  const none: PageLayout = { width: undefined, align: undefined, more: false };
  if (!yaml) return none;
  const read = readYamlMap(text.slice(yaml.from, yaml.to));
  if ("problem" in read || !isYamlMap(read.value)) return none;
  const layout = read.value[LAYOUT_KEY];
  if (!isYamlMap(layout)) return none;
  const align = readTextAlign(layout.align);
  // (An alignment not read, typed by hand, is none of ours: kept as the rest)
  return { width: readTextWidth(layout.width), align, more: Object.keys(layout).some((key) => !OWN_KEYS.includes(key) || (key === "align" && !align)) };
}

/**
 * A page's text width and alignment written (each none: taken off, and `_layout` with them where it held nothing
 * else), in one edit; why not, as text, where the writer left the page alone
 */
export async function writePageLayout(writer: PageWriter, page: string, text: string, { width, align }: PageTextLayout): Promise<string | undefined> {
  const { more, align: was } = pageLayoutOf(text);
  const changes = pageChanges()
    .page(page, (p) => {
      if (!width && !align && !more) return void p.properties.remove(LAYOUT_KEY);
      if (width) p.properties.set([LAYOUT_KEY, "width"], storedWidth(width));
      else p.properties.remove([LAYOUT_KEY, "width"]);
      if (align) p.properties.set([LAYOUT_KEY, "align"], align);
      else if (was) p.properties.remove([LAYOUT_KEY, "align"]);
    })
    .build();
  const report = await writer.write(changes);
  return report.skipped[0]?.reason;
}
