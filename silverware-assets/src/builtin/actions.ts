// Silverware Assets' own actions (docs/silverware-assets.md, *Actions*), registered as anyone's: the asset's
// URL in a new tab of the browser; the asset in a side panel, or enlarged over the page (./panels.ts); an image copied
// to the clipboard (its menu's alone); the file downloaded.
import type { AssetAction } from "../../../shared/assets.ts";
import { peek, popover } from "./panels.ts";

export const openTab: AssetAction = {
  name: "open-tab",
  label: "Open in a new tab",
  fits: (asset) => "url" in asset,
  run: (context) => {
    if ("url" in context.asset) context.open(context.asset.url);
  },
};

// The size an image of no size of its own (an SVG of a viewBox alone) is copied at
const SVG_SIZE = 1024;
// A file an image by its type or its name, where its type is not known
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i;

/**
 * The image as a PNG (what the clipboard takes of an image in every browser): drawn on a canvas as the browser draws
 * it, its own size; an image of another site that does not allow it (a tainted canvas) cannot be
 */
async function asPng(url: string): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  // (An SVG of a viewBox alone has no size of its own: drawn at a size of the clipboard's, its own proportion kept)
  const width = image.naturalWidth || SVG_SIZE;
  const height = image.naturalHeight || (image.naturalWidth ? image.naturalWidth : SVG_SIZE);
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("the image could not be read"))), "image/png"));
}

export const copyImage: AssetAction = {
  name: "copy-image",
  label: "Copy image",
  gesture: false,
  group: "file",
  fits: (asset) => "url" in asset && (asset.mime?.startsWith("image/") || IMAGE_NAME.test(asset.kind === "file" ? asset.path : asset.url)),
  run: async (context) => {
    if (!("url" in context.asset)) return;
    // (The clipboard takes an image where the page is served safely alone: HTTPS, or this machine)
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("the browser copies an image only where SilverBullet is served over HTTPS (or on this machine)");
    // (The image read inside the item: the click's permission to write kept while it is read)
    await clipboard.write([new ClipboardItem({ "image/png": asPng(context.asset.url) })]);
  },
};

/** The name a file is saved under: its path's or its URL's last part, as written (its alt text is no file's name) */
export function downloadName(asset: { readonly kind: string; readonly path?: string; readonly url?: string }): string {
  const last = (asset.kind === "file" ? asset.path : asset.url)?.split(/[?#]/, 1)[0]?.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || "download";
  } catch {
    return last || "download";
  }
}

export const download: AssetAction = {
  name: "download",
  label: "Download",
  group: "file",
  fits: (asset) => "url" in asset,
  run: async (context) => {
    const asset = context.asset;
    if (!("url" in asset)) return;
    const doc = globalThis.document;
    const address = new URL(asset.url, doc.baseURI);
    // A file of the space (this site's) saved by a link's download; another site's read first (a link's download names
    // no file of another site), else, where that site does not allow it, opened in a new tab
    let href = address.href;
    let made: string | undefined;
    if (address.origin !== doc.defaultView?.location.origin) {
      try {
        const response = await fetch(address.href);
        if (!response.ok) throw new Error(String(response.status));
        made = URL.createObjectURL(await response.blob());
        href = made;
      } catch {
        context.open(asset.url);
        return;
      }
    }
    const link = doc.createElement("a");
    link.href = href;
    link.download = downloadName(asset);
    link.style.display = "none";
    doc.body.append(link);
    link.click();
    link.remove();
    // (Let go once the browser has taken it)
    if (made) setTimeout(() => URL.revokeObjectURL(made!), 60_000);
  },
};

export const BUILTIN_ACTIONS: readonly AssetAction[] = [openTab, peek, popover, copyImage, download];
