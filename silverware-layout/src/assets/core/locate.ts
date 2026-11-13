// Which of a page's embeds an embed drawn by the host is (docs/silverware-layout-assets.md, probe 1: SilverBullet's
// widget of an embed carries no position): the embeds of its target in the page's order, the one by its order among
// the widgets of that target drawn. A widget scrolled out of view is not drawn, so the order may be short: the last
// of them then. Pure.
import type { Embed } from "../../../../shared/markdown/embed.ts";

/** A target as compared: no leading `/`, no `.md`, decoded, lower case */
export function sameTarget(target: string): string {
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

/** The embed a widget drawn is: of the page's embeds of its target (as resolved), the `nth` (its order among those drawn) */
export function embedOf(embeds: readonly Embed[], resolved: (embed: Embed) => string, target: string, nth: number, among: readonly Embed[] = embeds): { readonly embed: Embed; readonly occurrence: number; readonly of: number } | undefined {
  const wanted = sameTarget(target);
  const alike = among.filter((embed) => sameTarget(resolved(embed)) === wanted);
  if (!alike.length) return undefined;
  const embed = alike[Math.min(Math.max(nth, 0), alike.length - 1)]!;
  // Its place among the embeds of the same text, which the page writer finds it by
  const sameText = embeds.filter((one) => one.text === embed.text);
  return { embed, occurrence: sameText.indexOf(embed), of: sameText.length };
}

/** The link at a place of the page (a link in markdown rendered outside the editor, its place known), with its place among those of its text */
export function linkAt<L extends { readonly from: number; readonly text: string }>(links: readonly L[], at: number): { readonly link: L; readonly occurrence: number; readonly of: number } | undefined {
  const link = links.find((one) => one.from === at) ?? links.find((one) => Math.abs(one.from - at) <= 2);
  if (!link) return undefined;
  const sameText = links.filter((one) => one.text === link.text);
  return { link, occurrence: sameText.indexOf(link), of: sameText.length };
}
