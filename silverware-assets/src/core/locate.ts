// Which of a page's embeds (or links) one drawn by the host is (docs/silverware-assets.md, probe 1: SilverBullet's
// widget of an embed carries no position, 2.12.1, probed again 2026-11-14). The editor draws the part of the page in
// view and a margin: the widgets drawn, in the page's order, are a run of those the text has (`placeAmong`), found by
// their targets; where several runs fit (the same file twice, one drawn), where each is in the page decides. Pure.
import type { Embed } from "../../../shared/markdown/embed.ts";

/** A target as compared: no leading `/`, no `.md`, decoded, lower case */
export function sameTarget(target: string): string {
  // (A URL whole: its `@` and `$` are its own)
  if (/^[a-z][a-z0-9+.-]*:/i.test(target.trim())) return target.trim().toLowerCase();
  let text = target.split(/[#@$]/, 1)[0]!.trim().replace(/^\//, "").replace(/\.md$/i, "");
  try {
    text = decodeURI(text);
  } catch {
    // (Not encoded right: as written)
  }
  return text.toLowerCase();
}

/** A range of the page's text rendered outside the editor (a grid's cell): its embeds are no widget of the host's */
export type Range = { readonly from: number; readonly to: number };

/** The embed at a place of the page (a medium in markdown rendered outside the editor, its place known), with its place among those of its text */
export function embedAt(embeds: readonly Embed[], at: number): { readonly embed: Embed; readonly occurrence: number; readonly of: number } | undefined {
  // (Its rendering's offset may be a character off its `!`: the nearest within 2)
  const embed = embeds.find((one) => one.from === at) ?? embeds.find((one) => Math.abs(one.from - at) <= 2);
  if (!embed) return undefined;
  const sameText = embeds.filter((one) => one.text === embed.text);
  return { embed, occurrence: sameText.indexOf(embed), of: sameText.length };
}

/** The embeds the host draws as its own widgets: those outside every range rendered outside the editor */
export const outside = <E extends { readonly from: number }>(embeds: readonly E[], ranges: readonly Range[]): E[] => embeds.filter((one) => !ranges.some((range) => one.from >= range.from && one.from < range.to));

/** The link at a place of the page (a link in markdown rendered outside the editor, its place known), with its place among those of its text */
export function linkAt<L extends { readonly from: number; readonly text: string }>(links: readonly L[], at: number): { readonly link: L; readonly occurrence: number; readonly of: number } | undefined {
  const link = links.find((one) => one.from === at) ?? links.find((one) => Math.abs(one.from - at) <= 2);
  if (!link) return undefined;
  const sameText = links.filter((one) => one.text === link.text);
  return { link, occurrence: sameText.indexOf(link), of: sameText.length };
}

/** A widget of the host's, or an embed (a link) of the text: its target as compared (`sameTarget`), and how far down the page it is (0 to 1) */
export type Placed = { readonly target: string; readonly at: number };

/**
 * Which of the text's embeds the `index`th widget drawn is: the run of the text the widgets drawn are (their targets
 * one by one), the one whose place in the page is nearest where several fit; none found, among those of its target
 * the nearest. None where the text has none of its target
 */
export function placeAmong(drawn: readonly Placed[], index: number, inText: readonly Placed[]): number | undefined {
  const one = drawn[index];
  if (!one) return undefined;
  const nearest = (candidates: readonly number[]) =>
    candidates.length ? candidates.reduce((best, i) => (Math.abs(inText[i]!.at - one.at) < Math.abs(inText[best]!.at - one.at) ? i : best)) : undefined;
  const starts: number[] = [];
  for (let start = 0; start + drawn.length <= inText.length; start++) {
    if (drawn.every((widget, j) => widget.target === inText[start + j]!.target)) starts.push(start + index);
  }
  if (starts.length) return nearest(starts);
  // (The run broken: a widget drawn not offered yet, its content still coming, or one the cursor shows as text)
  return nearest(inText.flatMap((embed, i) => (embed.target === one.target ? [i] : [])));
}
