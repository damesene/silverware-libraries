// A link pressed in a plugin's field (shared/editor.ts `openLink`: a database's peek, a grid's cell edited) followed as
// SilverBullet follows one in the page (docs/silverware-editor-links.md): a wiki link's target from the space's root, a
// markdown link's from the page's folder, its section kept (`Page#Part`); a URL of the web in a tab of its own; a new
// tab asked for by the page's address. The binding gives how SilverBullet goes to a page and how a tab opens.
import type { LinkOpening } from "../editor.ts";
import { readLinks, resolveLinkPath } from "../markdown/embed.ts";

// A target that is a URL (a scheme before its colon), not a name of the space
const WEB_URL = /^[a-z][a-z0-9+.-]*:/i;
// The URLs a press opens in a tab: the web's, mail, a phone number; never one that runs or reads (`javascript:`,
// `data:`, `file:`), which a page's content pasted or shared could hold
const OPENED = /^(https?|mailto|tel):/i;

/** Where a link goes: a page or a file of the space by SilverBullet's ref (`Page#Part`, `folder/photo.png`), or a URL of the web */
export type LinkTarget = { readonly ref: string } | { readonly url: string };

/** Where a link's markdown (one link alone) in a page goes; none where it is no link, or a URL no press opens */
export function linkTarget(markdown: string, page: string): LinkTarget | undefined {
  const links = readLinks(markdown);
  const link = links[0];
  if (links.length !== 1 || !link || link.from !== 0 || link.to !== markdown.length) return undefined;
  const target = link.target.trim();
  if (!target) return undefined;
  if (WEB_URL.test(target)) return OPENED.test(target) ? { url: target } : undefined;
  // (Its section, `#Part`, kept as written; the path before it resolved)
  const hash = target.indexOf("#");
  const path = hash < 0 ? target : target.slice(0, hash);
  const section = hash < 0 ? "" : target.slice(hash);
  if (link.style === "wiki") return { ref: path.replace(/^\//, "") + section };
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch {
    // (As written)
  }
  return { ref: (path ? resolveLinkPath(page, decoded) : page) + section };
}

/** A ref's address in SilverBullet (relative to its root, as its links are): each part of its path encoded, its section kept */
export function refHref(ref: string): string {
  const hash = ref.indexOf("#");
  const path = hash < 0 ? ref : ref.slice(0, hash);
  return path.split("/").map(encodeURIComponent).join("/") + (hash < 0 ? "" : ref.slice(hash));
}

/** How SilverBullet goes to a ref, and how a tab of the browser's opens an address (the binding's) */
export type LinkFollowing = { readonly navigate: (ref: string) => unknown; readonly openTab: (url: string) => void };

/** A link's markdown in a page followed: a page or file in place (in a new tab where asked), a URL in a tab of its own; false where it is no link */
export function followLink(markdown: string, page: string, how: LinkOpening, via: LinkFollowing): boolean {
  const target = linkTarget(markdown, page);
  if (!target) return false;
  if ("url" in target) via.openTab(target.url);
  else if (how.newTab) via.openTab(refHref(target.ref));
  else void via.navigate(target.ref);
  return true;
}
