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

/** The embed a widget drawn is: of the page's embeds of its target (as resolved), the `nth` (its order among those drawn) */
export function embedOf(embeds: readonly Embed[], resolved: (embed: Embed) => string, target: string, nth: number): { readonly embed: Embed; readonly occurrence: number; readonly of: number } | undefined {
  const wanted = sameTarget(target);
  const alike = embeds.filter((embed) => sameTarget(resolved(embed)) === wanted);
  if (!alike.length) return undefined;
  const embed = alike[Math.min(Math.max(nth, 0), alike.length - 1)]!;
  // Its place among the embeds of the same text, which the page writer finds it by
  const sameText = embeds.filter((one) => one.text === embed.text);
  return { embed, occurrence: sameText.indexOf(embed), of: sameText.length };
}
