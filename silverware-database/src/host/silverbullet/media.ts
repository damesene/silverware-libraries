// The files a value of files names, in SilverBullet (core/media.ts `MediaSource`, docs/silverware-database-files.md):
// by Silverware Assets' API where it is installed (a preview by the file's type, the side panel, its upload dialog, a
// file deleted with its kept previews), else SilverBullet's own (an image from `.fs/`, a file opened as it opens one,
// its space's files listed and deleted). Targets are as a value keeps them: a path from the space's top (a wiki link's,
// resolved from no page), or an address of the web.
import type { Assets } from "../../../../shared/assets.ts";
import { documentUrl } from "../../../../shared/silverbullet/platform.ts";
import type { MediaSource } from "../../core/media.ts";
import { isWebTarget } from "../../domain/types/files.ts";

/** What the files take of the init page's bridge */
export type MediaBridge = {
  // A page or a file opened in the editor, as a link to it is followed
  navigate(ref: string): Promise<void>;
  // The space's files (not its pages): their paths
  listDocuments?(): Promise<readonly string[]>;
  // A file deleted from the space
  deleteDocument?(path: string): Promise<void>;
};

/** What Silverware Assets' API resolves a link's target against: none (a value's paths are from the space's top) */
const FROM_TOP = "";

/** The files' source of SilverBullet, Silverware Assets' API (shared/assets.ts `assetsOf`: its stand-in where it is not installed) used where it gives a part */
export function silverBulletMedia(bridge: MediaBridge, assets: Assets, openTab: (url: string) => void): MediaSource {
  const { drawPreview, showFile, insertFiles, deleteFiles } = assets;
  return {
    url: (path) => documentUrl(path),
    ...(drawPreview ? { preview: (target, box, signal) => drawPreview(target, FROM_TOP, { width: box.width, height: box.height }, signal) } : {}),
    open: (target) => {
      if (showFile) return showFile(target, FROM_TOP);
      if (isWebTarget(target)) return openTab(target);
      void bridge.navigate(target);
    },
    // (No upload without Silverware Assets: its dialog names the files and writes them)
    ...(insertFiles ? { upload: (given, folder) => insertFiles(given, { folder }) } : {}),
    ...(bridge.listDocuments ? { files: () => bridge.listDocuments!() } : {}),
    ...(deleteFiles
      ? { remove: (paths) => deleteFiles(paths) }
      : bridge.deleteDocument
        ? {
            remove: async (paths) => {
              const left: string[] = [];
              for (const path of paths) await bridge.deleteDocument!(path).catch(() => void left.push(path));
              return left;
            },
          }
        : {}),
  };
}
