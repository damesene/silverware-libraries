// A file's preview kept in the space (docs/silverware-assets-stored-previews.md, shared/assets.ts `StoredPreview`): in
// one folder at the space's top, its name starting with `_` (SilverBullet's pickers, space tree and completion leave
// such a path out, 2.12.1: a cache, not the user's content), the files' paths kept under it, each preview named by the version of its file it was made of, its time
// of change and size (`_silverware-asset-preview/Projects/Report.pdf.1731600000000-48213.webp`): a file replaced is another
// version, whose preview is made again (whatever its time: a copy that keeps an older one too). Previews of versions
// gone, and of files gone, are taken away by Clean up previews (`orphanedPreviews`).
import type { StoredPreview } from "../../../shared/assets.ts";

/** The folder the previews are kept in */
export const PREVIEWS_FOLDER = "_silverware-asset-preview";

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
export function previewPath(path: string, version: string, kind: string): string | undefined {
  const extension = PREVIEW_KINDS[kind];
  return extension ? `${PREVIEWS_FOLDER}/${path}.${version}.${extension}` : undefined;
}

/** A file's previews kept by the host's files; `anew`: none read (Regenerate preview) */
export function storedPreview(files: PreviewFiles, path: string, anew = false): StoredPreview {
  // (The file's version where it is now: none known, nothing kept nor read)
  const at = async (kind: string) => {
    const facts = await files.facts(path).catch(() => undefined);
    return facts ? previewPath(path, versionOf(facts), kind) : undefined;
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
export function previewPathsOf(path: string, facts: FileFacts): string[] {
  return Object.keys(PREVIEW_KINDS).map((kind) => previewPath(path, versionOf(facts), kind)!);
}

/** A file's previews of a version taken away, of every kind (`facts`: that version; none: the file's now) */
export async function forgetPreviews(files: PreviewFiles, path: string, facts?: FileFacts): Promise<void> {
  const version = facts ?? (await files.facts(path).catch(() => undefined));
  if (!version) return;
  for (const at of previewPathsOf(path, version)) if (await files.facts(at).catch(() => undefined)) await files.remove(at).catch(() => undefined);
}

/** A file as the host lists it: its path, its facts where known */
export type ListedFile = { readonly name: string; readonly facts?: FileFacts };

/** The previews among the space's files whose file is gone (deleted, renamed) or is another version now (replaced) */
export function orphanedPreviews(files: readonly ListedFile[]): string[] {
  const byName = new Map(files.map((file) => [file.name, file]));
  const extensions = Object.values(PREVIEW_KINDS).map((extension) => `.${extension}`);
  return files.flatMap(({ name }) => {
    if (!name.startsWith(`${PREVIEWS_FOLDER}/`)) return [];
    const extension = extensions.find((one) => name.endsWith(one));
    if (!extension) return [];
    const named = /^(.+)\.(\d+-\d+)$/.exec(name.slice(PREVIEWS_FOLDER.length + 1, -extension.length));
    // (A preview of ours named by no version: one kept before previews were named by it, read by nothing)
    if (!named) return [name];
    const file = byName.get(named[1]!);
    // (A file whose facts are not listed: its preview left, not known to be another version)
    return !file || (file.facts && versionOf(file.facts) !== named[2]) ? [name] : [];
  });
}
