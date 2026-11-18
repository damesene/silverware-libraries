// Files dropped or pasted on what draws a value of files (a table's cell, a board's card, the peek's row, the files'
// popup: docs/silverware-database-files.md): taken there, uploaded through the host's dialog (Silverware Assets') and
// added at the end of the value as it is once they are written. The element is marked as taking files itself
// (shared/takesfiles.ts), so another plugin taking files at the document (Silverware Assets' insert into the page)
// leaves it alone. A paste with no file in it (a text) is left to whatever takes it.
import { markTakesFiles } from "../../../shared/takesfiles.ts";
import type { GivenFiles } from "../core/media.ts";
import type { ViewHost } from "../core/view.ts";
import { readFiles, writeFile } from "../domain/types/files.ts";
import type { Item } from "../model/database.ts";

/** What an event carries as files, read in it (a drop's and a clipboard's data are read there alone); none where it carries no file */
export function givenFiles(data: DataTransfer | null | undefined, source: GivenFiles["source"]): GivenFiles | undefined {
  const files = data ? [...data.files] : [];
  if (!files.length) return undefined;
  const html = data!.types.includes("text/html") ? data!.getData("text/html") : "";
  const uriList = data!.types.includes("text/uri-list") ? data!.getData("text/uri-list") : "";
  return { files, source, ...(html ? { html } : {}), ...(uriList ? { uriList } : {}) };
}

/**
 * Files dropped on `element` (and pasted, where it takes the focus: `paste`) handed to `take`, the element marked as
 * taking files itself and lit while files are dragged over it
 */
export function takeFiles(element: HTMLElement, take: (given: GivenFiles, at: Element) => void, options: { readonly paste?: boolean } = {}): void {
  markTakesFiles(element, true);
  const carries = (event: DragEvent) => !!event.dataTransfer?.types.includes("Files");
  element.addEventListener("dragover", (event) => {
    if (!carries(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer!.dropEffect = "copy";
    element.classList.add("swd-files-over");
  });
  element.addEventListener("dragleave", (event) => {
    if (!element.contains(event.relatedTarget as Node | null)) element.classList.remove("swd-files-over");
  });
  element.addEventListener("drop", (event) => {
    element.classList.remove("swd-files-over");
    const given = givenFiles(event.dataTransfer, "drop");
    if (!given) return;
    event.preventDefault();
    event.stopPropagation();
    take(given, event.target instanceof Element ? event.target : element);
  });
  if (!options.paste) return;
  element.addEventListener("paste", (event) => {
    const given = givenFiles(event.clipboardData, "clipboard");
    if (!given) return;
    event.preventDefault();
    event.stopPropagation();
    take(given, element);
  });
}

/**
 * Files uploaded for an item's value of files (those an event gave, or picked in the host's dialog: none), added at the
 * end of the value as it is once they are written (the item as the store has it then: another place may have written it
 * since the view was drawn), those it has already left out. Without the host's upload, said; a value that does not read
 * as files is not written over (said)
 */
export function uploadInto(host: Pick<ViewHost, "database" | "media" | "update" | "notify" | "current">, shown: Item, key: string, label: string, given?: GivenFiles): void {
  const upload = host.media?.upload;
  if (!upload) return host.notify(`${label}: uploading files needs Silverware Assets`);
  void upload(host.database.id, given).then(async (targets) => {
    if (!targets?.length) return;
    const item = (await host.current(shown)) ?? shown;
    const kept = readFiles(item.values[key]);
    if (!kept) return host.notify(`${label} of ${item.name}: its value is no list of files: the files uploaded are not added (${targets.map((one) => one.target).join(", ")})`);
    const was = kept.map((one) => one.written);
    const added = targets.filter((one) => !kept.some((file) => file.target === one.target)).map((one) => writeFile(one.target, one.title));
    if (added.length) void host.update(item, key, [...was, ...added]);
  });
}
