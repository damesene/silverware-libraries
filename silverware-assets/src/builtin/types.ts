// Silverware Assets' own types of asset (docs/silverware-assets.md, *Types*), registered as anyone's: through
// the contract alone. Images, video and audio leave both views to the host (SilverBullet draws them); a PDF draws a
// smaller viewer as its preview, its full view the browser's viewer (Silverware Assets PDF, where installed, replaces the type:
// its preview its first page as an image, docs/silverware-viewers.md); an archive and any other file the card alone,
// each its own icon. Icons: SVG text, so they follow the theme's colour.
import type { AssetType } from "../../../shared/assets.ts";
import { el } from "../../../shared/elements.ts";

const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const FILE = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>';

export const imageType: AssetType = {
  name: "image",
  label: "Images",
  match: { kind: ["file", "web"], mime: "image/*" },
  icon: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
};

export const videoType: AssetType = {
  name: "video",
  label: "Videos",
  match: { kind: ["file", "web"], mime: "video/*" },
  icon: svg('<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m22 8-5 4 5 4z"/>'),
};

export const audioType: AssetType = {
  name: "audio",
  label: "Audio",
  match: { kind: ["file", "web"], mime: "audio/*" },
  icon: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
};

export const pdfType: AssetType = {
  name: "pdf",
  label: "PDF",
  document: true,
  match: { kind: ["file", "web"], mime: "application/pdf", ext: ["pdf"] },
  icon: svg(`${FILE}<path d="M9 13h6M9 17h4"/>`),
  views: {
    // A smaller viewer; no room for one (narrower than a preview may be set, 40 px), or no URL: the host's own
    preview: (context) =>
      "url" in context.asset && context.viewport.width >= 40 ? el(document, "object", { class: "swa-pdf", attrs: { type: "application/pdf", data: context.asset.url } }) : null,
  },
};

// The extensions of archives and disk images
const ARCHIVES = ["zip", "7z", "rar", "tar", "gz", "tgz", "bz2", "tbz2", "xz", "txz", "zst", "lz", "lzma", "cab", "iso", "dmg"];

/** An archive (zip, 7z, rar, tar…): a card as any file, its own icon (a file with a zipper) */
export const archiveType: AssetType = {
  name: "archive",
  label: "Archives",
  match: { kind: ["file", "web"], ext: ARCHIVES },
  icon: svg(`${FILE}<path d="M10 7h1M10 10h1M10 13h1"/><rect x="9" y="15" width="3" height="4" rx="1"/>`),
};

export const fileType: AssetType = {
  name: "file",
  label: "Other files",
  match: { kind: ["file", "web"] },
  icon: svg(FILE),
};

export const BUILTIN_TYPES: readonly AssetType[] = [imageType, videoType, audioType, pdfType, archiveType, fileType];
