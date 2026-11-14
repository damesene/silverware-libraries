// Reading documents' files, as Silverware Assets PDF, DOCX and XLSX do (docs/silverware-viewers.md): a file's version as its
// server says it now, what a document read before is kept by; and the turns reads take, so a page of many does not read
// them all together.

/**
 * A file's version as its server says it now (its ETag, else its date changed, else its size; none where it says
 * nothing or cannot be asked): what a document read before is kept by with its URL, so a file replaced under the same
 * name is read again. Asked with the browser's cache revalidated (a HEAD request, nothing of the file sent)
 */
export async function fileVersion(url: string, base: string): Promise<string> {
  try {
    const response = await fetch(new URL(url, base).href, { method: "HEAD", cache: "no-cache" });
    if (!response.ok) return "";
    return response.headers.get("etag") ?? response.headers.get("last-modified") ?? response.headers.get("content-length") ?? "";
  } catch {
    return "";
  }
}

/**
 * Turns for reads of documents: at most `atOnce` at a time (a page of many previews does not read them all together),
 * a turn handed to the next waiting as a read ends, so no read comes between and more go on than that
 */
export function readTurns(atOnce: number): <T>(work: () => Promise<T>) => Promise<T> {
  const waiting: (() => void)[] = [];
  let running = 0;
  return async (work) => {
    if (running < atOnce) running++;
    else await new Promise<void>((go) => waiting.push(go));
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  };
}
