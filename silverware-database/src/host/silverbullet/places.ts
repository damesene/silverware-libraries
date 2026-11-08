// The places of databases kept in a space's pages: each `silverware-database`
// block (block.ts) of any page, its state its lines. The core's `PlaceStore`
// over them: found by reading every page (the index keeps no code block), a
// few at a time, the progress told; written through the page writer, a block
// written anew only where it is still as read (another hand's edit since: left,
// said). The core says what a state becomes; the block's form is this file's.
import { inBatches } from "../../../../shared/pages/batch.ts";
import { codeBlocksOf, sameBody } from "../../../../shared/pages/blocks.ts";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import type { ApplyReport, PageWriter } from "../../../../shared/pages/writer.ts";
import type { Space } from "../../../../shared/platform.ts";
import type { PlaceChange, PlacesPlan, PlacesReport, PlaceStore, WriteProgress } from "../../core/store.ts";
import { BLOCK_LANGUAGE, readBlock, writeBlock } from "./block.ts";

// A block to write anew: its page, its text as read and as it is to be, which of the blocks alike it is as the writer finds
// it: the page's edits written one after another, a block alike to others written first takes the first place, the
// others' count one less (two blocks showing the same, the second found so once the first is written)
type BlockEdit = { readonly page: string; readonly body: string; readonly text: string; readonly occurrence: number; readonly of: number };

export function blockPlaces(space: Pick<Space, "list" | "read">, writer: PageWriter): PlaceStore {
  // What each plan writes and what each apply wrote, kept for its own (the core is given the pages alone)
  const edits = new WeakMap<PlacesPlan, readonly BlockEdit[]>();
  const writes = new WeakMap<PlacesReport, ApplyReport>();
  const reportOf = (report: ApplyReport): PlacesReport => {
    const made: PlacesReport = { written: report.written.map((one) => one.page), skipped: report.skipped.map((one) => ({ document: one.page, reason: one.reason })) };
    writes.set(made, report);
    return made;
  };
  return {
    async plan(database: string, change: PlaceChange, progress?: WriteProgress): Promise<PlacesPlan> {
      const pages = [...(await space.list())];
      const found = await inBatches(
        pages,
        async (page) => {
          let text: string;
          try {
            text = String(await space.read(page));
          } catch {
            // (Gone meanwhile, or not readable: no place of it)
            return [];
          }
          if (!text.includes(BLOCK_LANGUAGE)) return [];
          const blocks = codeBlocksOf(text).filter((block) => block.language === BLOCK_LANGUAGE);
          const out: BlockEdit[] = [];
          for (const block of blocks) {
            const state = readBlock(block.body);
            if (state.get("id") !== database) continue;
            const changed = change(state);
            if (!changed) continue;
            // (Which of the blocks showing the same it is, those before it already written: each found first, among one fewer)
            const alike = blocks.filter((one) => sameBody(one.body) === sameBody(block.body));
            out.push({ page, body: block.body, text: writeBlock(block.body, changed), occurrence: 0, of: alike.length - alike.indexOf(block) });
          }
          return out;
        },
        progress,
      );
      const all = found.flat();
      const plan: PlacesPlan = { documents: [...new Set(all.map((one) => one.page))] };
      edits.set(plan, all);
      return plan;
    },

    async apply(plan: PlacesPlan): Promise<PlacesReport> {
      const all = edits.get(plan) ?? [];
      if (!all.length) return { written: [], skipped: [] };
      const batch = pageChanges();
      for (const page of plan.documents) batch.page(page, (p) => {
        for (const one of all.filter((edit) => edit.page === page)) p.codeBlocks.replace(BLOCK_LANGUAGE, one.body, one.text, { occurrence: one.occurrence, of: one.of });
      });
      return reportOf(await writer.write(batch.build()));
    },

    async undo(report: PlacesReport): Promise<PlacesReport> {
      const wrote = writes.get(report);
      if (!wrote || !wrote.written.length) return { written: [], skipped: [] };
      // (The writer's own undo: each page put back where it is still as written, one changed since left)
      const plan = await writer.planUndo(wrote);
      const back = await writer.apply(plan);
      // (A page once, however many of its blocks were left)
      const skipped = new Map([...plan.skipped, ...back.skipped].map((one) => [one.page, one.reason]));
      return { written: back.written.map((one) => one.page), skipped: [...skipped].map(([document, reason]) => ({ document, reason })) };
    },
  };
}
