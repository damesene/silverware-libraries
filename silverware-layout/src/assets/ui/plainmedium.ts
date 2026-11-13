// An asset drawn as the browser draws a file of its kind (an image, a video, audio, a PDF's viewer), where nothing else
// draws it: a file a link points to, shown in a panel. None for a kind the browser shows no medium of (a zip).
import type { Asset } from "../../../../shared/assets.ts";
import { el } from "../../../../shared/elements.ts";

/** The medium of an asset by its MIME type; none where it has no URL or its kind has none */
export function plainMedium(doc: Document, asset: Asset, mime: string): HTMLElement | undefined {
  if (!("url" in asset)) return undefined;
  if (mime.startsWith("image/")) return el(doc, "img", { attrs: { src: asset.url, alt: asset.alt ?? "" } });
  if (mime.startsWith("video/")) return el(doc, "video", { attrs: { src: asset.url, controls: "", preload: "metadata", playsinline: "" } });
  if (mime.startsWith("audio/")) return el(doc, "audio", { attrs: { src: asset.url, controls: "", preload: "metadata" } });
  if (mime === "application/pdf") return el(doc, "object", { attrs: { type: mime, data: asset.url } });
  return undefined;
}
