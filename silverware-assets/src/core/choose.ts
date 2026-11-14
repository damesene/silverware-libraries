// Which type an asset is, which view it is shown in, which action a gesture runs (docs/silverware-assets.md,
// *Matching*, *Views*, *Actions*): the declarations of the types and the user's settings evaluated, no type or action
// known by name. Pure.
import type { Asset, AssetAction, AssetMatch, AssetType, Capabilities } from "../../../shared/assets.ts";
import type { AssetSettings, Gesture, View } from "../model/settings.ts";

// A file's MIME type where the host gives none, by its extension (the common ones a type is likely to match)
const MIME: Readonly<Record<string, string>> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp", ico: "image/x-icon",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", ogv: "video/ogg",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac",
  pdf: "application/pdf",
};

/** An asset's extension (lower case; none: "") */
export function extOf(asset: Asset): string {
  const path = asset.kind === "file" ? asset.path : asset.kind === "web" ? asset.url.split(/[?#]/, 1)[0]! : "";
  return /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase() ?? "";
}

/** An asset's MIME type: the host's, else by its extension (none: "") */
export function mimeOf(asset: Asset): string {
  return ("mime" in asset && asset.mime) || MIME[extOf(asset)] || "";
}

/** How specific a match is where it holds (higher: more), or -1 where it does not */
function score(match: AssetMatch, asset: Asset): number {
  if (!match.kind.includes(asset.kind)) return -1;
  let best = 0;
  if (match.mime) {
    const mime = mimeOf(asset);
    const wild = match.mime.endsWith("/*");
    const holds = wild ? mime.startsWith(match.mime.slice(0, -1)) : mime === match.mime;
    if (!holds && !match.ext) return -1;
    if (holds) best = Math.max(best, wild ? 1 : 2);
  }
  if (match.ext) {
    const holds = match.ext.some((ext) => ext.toLowerCase() === extOf(asset));
    if (holds) best = Math.max(best, 3);
    else if (!match.mime || best === 0) return -1;
  }
  if (match.test) {
    if (!match.test(asset)) return -1;
    best = 4;
  }
  return best;
}

/** The type an asset is: the most specific match, of those as specific the one registered later; none matching: none */
export function typeFor(types: readonly AssetType[], asset: Asset): AssetType | undefined {
  let found: AssetType | undefined;
  let best = -1;
  for (const type of types) {
    const s = score(type.match, asset);
    if (s >= 0 && s >= best) {
      best = s;
      found = type;
    }
  }
  return found;
}

/**
 * The view an asset is shown in: its embed's own, else the user's for its type, else the user's default; one that
 * cannot be drawn falls on in the order embed, preview, icon (the card always can)
 */
export function viewFor(own: string | undefined, type: string | undefined, settings: AssetSettings, can: (view: View) => boolean): View {
  const wanted = (own === "icon" || own === "preview" || own === "embed" ? own : undefined) ?? (type ? settings.views.types[type] : undefined) ?? settings.views.default;
  const order: readonly View[] = ["embed", "preview", "icon"];
  for (const view of order.slice(order.indexOf(wanted))) if (view === "icon" || can(view)) return view;
  return "icon";
}

/** The action a gesture runs on an asset: the user's for its type, else the user's default, where it fits; none: none */
export function actionFor(gesture: Gesture, type: string | undefined, settings: AssetSettings, actions: (name: string) => AssetAction | undefined, asset: Asset, can: Capabilities): AssetAction | undefined {
  for (const name of [type ? settings.actions.types[type]?.[gesture] : undefined, settings.actions.default[gesture]]) {
    const action = name ? actions(name) : undefined;
    if (action && action.fits(asset, can)) return action;
  }
  return undefined;
}
