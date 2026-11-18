// A file's preview kept in the space (docs/silverware-assets-stored-previews.md, shared/assets.ts `StoredPreview`): in
// one folder, the settings' (`previewFolder`; by default at the space's top, its name starting with `_`:
// SilverBullet's pickers, space tree and completion leave such a path out, 2.12.1: a cache, not the user's content),
// the files' paths kept under it, each preview named by the version of its file it was made of, its time
// of change and size (`_silverware-assets-previews/Projects/Report.pdf.1731600000000-48213.webp`): a file replaced is another
// version, whose preview is made again (whatever its time: a copy that keeps an older one too). Previews of versions
// gone, and of files gone, are taken away by Clean up previews (`orphanedPreviews`).
import type { StoredPreview } from "../../../shared/assets.ts";


/** The kinds a preview is kept as, each by its file's extension */
export const PREVIEW_KINDS: Readonly<Record<string, string>> = { "image/webp": "webp", "image/png": "png", "text/html": "html" };

/** A file's facts as the host knows them: its time of change (ms) and its size (bytes) */
export type FileFacts = { readonly modified: number; readonly size: number };

/** What the host keeps files by: a file's facts (none: no such file), read, written, deleted */
export type PreviewFiles = {
  facts(path: string): Promise<FileFacts | undefined>;
  read(path: string): Promise<Uint8Array | undefined>;
  write(path: string, data: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
};

/** A file's version as a preview's name keeps it */
export const versionOf = (facts: FileFacts): string => `${Math.round(facts.modified)}-${facts.size}`;

/** Where the preview of a kind of a file's version is kept; none for a kind not kept */
export function previewPath(folder: string, path: string, version: string, kind: string): string | undefined {
  const extension = PREVIEW_KINDS[kind];
  return extension ? `${folder}/${path}.${version}.${extension}` : undefined;
}

/** A file's previews kept by the host's files; `anew`: none read (Regenerate preview) */
export function storedPreview(files: PreviewFiles, folder: string, path: string, anew = false): StoredPreview {
  // (The file's version where it is now: none known, nothing kept nor read)
  const at = async (kind: string) => {
    const facts = await files.facts(path).catch(() => undefined);
    return facts ? previewPath(folder, path, versionOf(facts), kind) : undefined;
  };
  return {
    ...(anew ? { anew } : {}),
    read: async (kind) => {
      if (anew) return undefined;
      const where = await at(kind);
      const data = where ? await files.read(where).catch(() => undefined) : undefined;
      return data ? new Blob([data as BlobPart], { type: kind }) : undefined;
    },
    write: async (data) => {
      if (!PREVIEW_KINDS[data.type]) return `a preview is not kept as ${data.type || "this"}`;
      const where = await at(data.type);
      if (!where) return "the file's version is not known";
      try {
        await files.write(where, new Uint8Array(await data.arrayBuffer()));
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  };
}

/** Where a file's version's previews of every kind would be kept */
export function previewPathsOf(folder: string, path: string, facts: FileFacts): string[] {
  return Object.keys(PREVIEW_KINDS).map((kind) => previewPath(folder, path, versionOf(facts), kind)!);
}

/** Whether a preview of any kind is kept of a file's version now (none known: no) */
export async function hasStoredPreview(files: PreviewFiles, folder: string, path: string): Promise<boolean> {
  const facts = await files.facts(path).catch(() => undefined);
  if (!facts) return false;
  for (const at of previewPathsOf(folder, path, facts)) if (await files.facts(at).catch(() => undefined)) return true;
  return false;
}

/** A file's previews of a version taken away, of every kind (`facts`: that version; none: the file's now) */
export async function forgetPreviews(files: PreviewFiles, folder: string, path: string, facts?: FileFacts): Promise<void> {
  const version = facts ?? (await files.facts(path).catch(() => undefined));
  if (!version) return;
  for (const at of previewPathsOf(folder, path, version)) if (await files.facts(at).catch(() => undefined)) await files.remove(at).catch(() => undefined);
}

/** A path that is a preview's of the folder (`<folder>/<file>.<time>-<size>.<kind's extension>`): its file and version; none else */
function previewNamed(path: string, folder: string): { readonly file: string; readonly version: string } | undefined {
  if (!path.startsWith(`${folder}/`)) return undefined;
  const extension = Object.values(PREVIEW_KINDS).find((one) => path.endsWith(`.${one}`));
  // (A file's name with its extension, then its version: its time in ms, 10 digits and more, and its size; a file of
  // the user's named alike by chance, `scan.2024-11.png`, is none)
  const named = extension && /^(.+\.[^./]+)\.(\d{10,}-\d+)$/.exec(path.slice(folder.length + 1, -extension.length - 1));
  return named ? { file: named[1]!, version: named[2]! } : undefined;
}

/** A file as the host lists it: its path, its facts where known */
export type ListedFile = { readonly name: string; readonly facts?: FileFacts };

/** The previews among the space's files whose file is gone (deleted, renamed) or is another version now (replaced) */
export function orphanedPreviews(files: readonly ListedFile[], folder: string): string[] {
  const byName = new Map(files.map((file) => [file.name, file]));
  return files.flatMap(({ name }) => {
    const named = previewNamed(name, folder);
    // (Only a preview's name: the folder may be the user's, its other files theirs, never taken away)
    if (!named) return [];
    const file = byName.get(named.file);
    // (A file whose facts are not listed: its preview left, not known to be another version)
    return !file || (file.facts && versionOf(file.facts) !== named.version) ? [name] : [];
  });
}

/**
 * Where each file of the previews' folder goes as the folder is renamed (the settings' `previewFolder` changed): its
 * path under the new folder, kept as it is under the old. None where the two are the same
 */
export function movedPreviews(paths: readonly string[], from: string, to: string): { readonly from: string; readonly to: string }[] {
  if (from === to) return [];
  // (Only previews: the folder may hold the user's own files too, left where they are; those already in the new
  // folder, where it is within the old, left there: moved again they went a folder deeper)
  return paths.filter((path) => previewNamed(path, from) && !path.startsWith(`${to}/`)).map((path) => ({ from: path, to: `${to}/${path.slice(from.length + 1)}` }));
}
