// Files a value names (Files & media, docs/silverware-database-files.md) drawn, opened, uploaded, listed and deleted,
// for the views' host and the modules' alike, as the platform gives them (`MediaSource`, the binding's: Silverware
// Assets where it is installed, else the platform's own). Made once by the core from what the host gives; a host
// without it has none (a value of files then shows as their names).
import { scaledPx } from "../../../shared/contentscale.ts";
import { el } from "../../../shared/elements.ts";
import type { Awaitable, UserInterface } from "../../../shared/platform.ts";
import { fileName, isImageTarget, isWebTarget } from "../domain/types/files.ts";
import type { DatabaseStore } from "./store.ts";

/**
 * The room a file is drawn in (px): it fits in `width` × `height` at its proportions; an image whose shorter side would
 * be under `min` is cropped to it (centred) rather than shrunk further
 */
export type MediaBox = { readonly width: number; readonly height: number; readonly min: number };

/**
 * Files given by an event (a paste, a drop), read in it: the files, and the HTML and the address list beside them,
 * which may hold an image's address on the web; where they came from
 */
export type GivenFiles = { readonly files: readonly File[]; readonly html?: string; readonly uriList?: string; readonly source: "clipboard" | "drop" };

/** What the host gives of files (each part optional: none, what needs it is not offered) */
export type MediaSource = {
  /** The address a file of the space is loaded from (an image drawn by Database itself) */
  url?(path: string): string | undefined;
  /** A file's preview fitted in a box, resolved once drawn; null where there is none (its icon and name drawn then) */
  preview?(target: string, box: MediaBox, signal: AbortSignal): Promise<HTMLElement | null>;
  /** A file opened (a file of the space as the platform shows one, an address in a tab) */
  open?(target: string): void;
  /** Files uploaded into a folder (those an event gave, or picked: none given), resolved with their targets once written; undefined where cancelled */
  upload?(given: GivenFiles | undefined, folder: string): Promise<readonly string[] | undefined>;
  /** The space's files (paths), pages left out */
  files?(): Awaitable<readonly string[]>;
  /** Files deleted, nothing asked: those not deleted */
  remove?(paths: readonly string[]): Promise<readonly string[]>;
};

/** What a host offers of files: none where the platform gives none (values of files shown as their names) */
export type MediaHost = { readonly media?: Media };

/** What a host offers of files (`ViewHost.media`, `ModuleHost.media`) */
export type Media = {
  /**
   * A file drawn in a box: an image as itself, else its preview where the host draws one (its icon and name until it
   * comes, and where none comes). Synchronous: what it starts ends once the element has left the page (looked at as
   * files are drawn again)
   */
  draw(target: string, box: MediaBox): HTMLElement;
  /** A file opened (none where the platform opens none) */
  open(target: string): void;
  /** The address a file is loaded from (an address of the web as it is), none where it has none */
  url(target: string): string | undefined;
  /** The space's files (none where the platform lists none) */
  files(): Promise<readonly string[]>;
  /**
   * Files uploaded for a database, into its folder of files (those an event gave, or picked in the platform's dialog:
   * none given), resolved with their targets once written; undefined where cancelled or not uploaded (said). None where
   * the platform uploads none
   */
  upload?(database: string, given?: GivenFiles): Promise<readonly string[] | undefined>;
  /** Files deleted, nothing asked (the caller asked): those not deleted. None where the platform deletes none */
  remove?(paths: readonly string[]): Promise<readonly string[]>;
};

// A file's icon where it is not drawn: a page, a corner folded
const FILE_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 1.75h5.25L12.5 5v9.25H4z"/><path d="M9.25 1.75V5h3.25"/></svg>';

// How long after files are drawn those that left the page are looked for (their previews' drawing ended): they are put
// in the page at once, so any not in it by then has gone
const SWEEP_MS = 1000;

/** A host's files from a source (none: none given, values of files shown as their names), uploads put in the store's folder of a database's files */
export function mediaHost(source: MediaSource | undefined, store: Pick<DatabaseStore, "filesFolderOf">, ui: Pick<UserInterface, "notify">, doc: Document): Media | undefined {
  if (!source) return undefined;
  // What each file drawn started, ended once its element has left the page
  const drawing = new Map<HTMLElement, AbortController>();
  let sweep: ReturnType<typeof setTimeout> | undefined;
  const swept = () => {
    sweep = undefined;
    for (const [element, control] of drawing) {
      if (element.isConnected) continue;
      control.abort();
      drawing.delete(element);
    }
  };
  const said = (what: string, error: unknown) => ui.notify(`${what}: ${error instanceof Error ? error.message : String(error)}`, { type: "error" });
  return {
    draw: (target, box) => {
      const web = isWebTarget(target);
      const name = fileName({ target, web });
      const element = el(doc, "span", { class: "swd-media", title: name, attrs: { "data-swd-media": "file" } });
      // (Its box as the style page reads it, zoomed with the content: an image held in it before it has loaded too)
      element.style.setProperty("--swd-media-width", scaledPx(box.width));
      element.style.setProperty("--swd-media-height", scaledPx(box.height));
      const src = isImageTarget(target) ? (web ? target : source.url?.(target)) : undefined;
      if (src) {
        element.dataset.swdMedia = "image";
        const image = el(doc, "img", { attrs: { src, alt: name, loading: "lazy", decoding: "async", draggable: "false" } });
        // (Its size once its own is known: fitted, or cropped where it is too narrow or too low for the box)
        image.addEventListener("load", () => fitImage(image, box), { once: true });
        element.append(image);
        return element;
      }
      element.append(el(doc, "span", { class: "swd-media-icon", html: FILE_ICON, attrs: { "aria-hidden": "true" } }), el(doc, "span", { class: "swd-media-name", text: name }));
      if (!source.preview) return element;
      const control = new AbortController();
      drawing.set(element, control);
      sweep ??= setTimeout(swept, SWEEP_MS);
      source
        .preview(target, box, control.signal)
        .then((preview) => {
          if (!preview || control.signal.aborted) return;
          element.dataset.swdMedia = "preview";
          element.replaceChildren(preview);
        })
        .catch(() => undefined)
        .finally(() => {
          if (drawing.get(element) === control) drawing.delete(element);
        });
      return element;
    },
    open: (target) => {
      try {
        source.open?.(target);
      } catch (error) {
        said(`"${target}" could not be opened`, error);
      }
    },
    url: (target) => (isWebTarget(target) ? target : source.url?.(target)),
    files: async () => {
      try {
        return (await source.files?.()) ?? [];
      } catch (error) {
        said("The space's files could not be listed", error);
        return [];
      }
    },
    ...(source.upload
      ? {
          upload: async (database: string, given?: GivenFiles) => {
            const folder = store.filesFolderOf(database);
            if (folder === undefined) {
              ui.notify("This database keeps no files of its own: none uploaded", { type: "error" });
              return undefined;
            }
            try {
              return await source.upload!(given, folder);
            } catch (error) {
              said("The files were not uploaded", error);
              return undefined;
            }
          },
        }
      : {}),
    ...(source.remove ? { remove: (paths: readonly string[]) => source.remove!(paths).catch(() => [...paths]) } : {}),
  };
}

/**
 * The size an image of `natural` size is drawn at in a box: fitted at its proportions; where its shorter side would be
 * under the box's least, that side the least and the other as long as the box lets it (`cropped`: drawn so by covering,
 * its middle shown)
 */
export function fittedSize(natural: { readonly width: number; readonly height: number }, box: MediaBox): { readonly width: number; readonly height: number; readonly cropped: boolean } {
  if (!(natural.width > 0 && natural.height > 0)) return { width: box.width, height: box.height, cropped: false };
  const scale = Math.min(box.width / natural.width, box.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  if (Math.min(width, height) >= box.min) return { width: Math.round(width), height: Math.round(height), cropped: false };
  return width < height ? { width: Math.min(box.min, box.width), height: box.height, cropped: true } : { width: box.width, height: Math.min(box.min, box.height), cropped: true };
}

/** An image loaded given its size in its box, zoomed with the content (`data-swd-cropped` where it covers it, its middle shown) */
function fitImage(image: HTMLImageElement, box: MediaBox): void {
  const size = fittedSize({ width: image.naturalWidth, height: image.naturalHeight }, box);
  image.style.width = scaledPx(size.width);
  image.style.height = scaledPx(size.height);
  image.style.objectFit = size.cropped ? "cover" : "";
  image.toggleAttribute("data-swd-cropped", size.cropped);
}
