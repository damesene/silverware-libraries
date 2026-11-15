// An image embedded drawn in a plugin's editor's field as SilverBullet's page draws it, where no plugin drawing files
// (Silverware Assets) is installed: a file of the space by its path, a URL as written; none for another file (its
// markdown shown). Silverware Layout's cell and Silverware Database's peek fall back on it.
import type { EditorEmbed } from "../editor.ts";
import { readEmbeds, resolvedTarget } from "../markdown/embed.ts";
import { documentUrl } from "./platform.ts";

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i;
const WEB = /^https?:\/\//i;

/** An image embed of `markdown` (a page's embed, its target resolved against `page`) drawn; none for another file */
export function imageEmbed(markdown: string, page: string): EditorEmbed | undefined {
  const embed = readEmbeds(markdown)[0];
  if (!embed || !IMAGE.test(resolvedTarget(embed, page))) return undefined;
  const src = WEB.test(embed.target) ? embed.target : documentUrl(resolvedTarget(embed, page));
  const width = Number(embed.width) || undefined;
  const height = Number(embed.height) || undefined;
  return {
    key: `${page}\n${markdown}`,
    draw: (container) => {
      const picture = container.ownerDocument.createElement("img");
      picture.src = src;
      picture.alt = embed.alt ?? "";
      picture.draggable = false;
      // (Its size as its markdown gives it, as the page draws it: a side alone its proportion kept)
      if (width) picture.style.width = `${width}px`;
      if (height) picture.style.height = `${height}px`;
      container.append(picture);
    },
  };
}
