// A workbook (.xlsx) read by ExcelJS (docs/silverware-viewers.md), loaded the first time a workbook is drawn from
// beside the bundle (silverware-assets-xlsx-exceljs.js, bundled by scripts/build.mjs from its package's browser build), as
// Silverware Chart loads Chart.js: offline, never in a space showing no workbook. Each file read once (its previews and
// readers draw what was read), at most two at once.
import { fileVersion, readTurns } from "../../shared/reads.ts";
import type { Workbook } from "./model.ts";
import { type ExcelWorkbook, workbookOf } from "./workbook.ts";

const READER_FILE = "./silverware-assets-xlsx-exceljs.js";
// How long ExcelJS not loaded is believed before it is asked again (ms)
const RETRY_MS = 30_000;
const AT_ONCE = 2;
const KEPT = 6;

type ExcelJs = { readonly Workbook: new () => ExcelWorkbook & { readonly xlsx: { load(data: ArrayBuffer): Promise<unknown> } } };

let loading: Promise<ExcelJs> | undefined;

function exceljs(): Promise<ExcelJs> {
  loading ??= import(new URL(READER_FILE, import.meta.url).href).catch((error: unknown) => {
    setTimeout(() => (loading = undefined), RETRY_MS);
    throw error;
  });
  return loading;
}

/** A workbook fetched (its URL resolved by the document's base, as the page's own elements resolve it) and read */
async function readWorkbook(doc: Document, url: string): Promise<Workbook> {
  const [lib, response] = await Promise.all([exceljs(), fetch(new URL(url, doc.baseURI).href)]);
  if (!response.ok) throw new Error(`the file could not be read (${response.status})`);
  const workbook = new lib.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return workbookOf(workbook);
}

const inTurn = readTurns(AT_ONCE);
const kept = new Map<string, Promise<Workbook>>();

/**
 * A workbook read once per file and version (what its server says of it now: replaced under the same name, read again),
 * for its previews and its readers; a failure not kept: tried again next time
 */
export async function workbook(doc: Document, url: string, again = false): Promise<Workbook> {
  const key = `${await fileVersion(url, doc.baseURI)} ${url}`;
  // (`again`: read anew, Regenerate preview)
  if (again) kept.delete(key);
  const known = kept.get(key);
  if (known) {
    kept.delete(key);
    kept.set(key, known);
    return known;
  }
  const reading = inTurn(() => readWorkbook(doc, url));
  kept.set(key, reading);
  reading.catch(() => kept.get(key) === reading && kept.delete(key));
  while (kept.size > KEPT) kept.delete(kept.keys().next().value!);
  return reading;
}
