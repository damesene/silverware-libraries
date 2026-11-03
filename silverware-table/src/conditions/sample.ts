// A rule's sample for its preview: a few of its cells across its values (the
// smallest, the largest and those between, by their places among the numbers;
// texts after them, each once), with the looks the rule gives them, so a
// scale's or levels' whole range shows in a line whatever the table's size;
// one cell the rule formats and one it does not, where it has both. Pure.
import type { Style } from "./api.ts";
import type { Placed } from "./evaluate.ts";

export type SampleCell = { readonly text: string; readonly style?: Style };

const keyOf = (p: Placed) => `${p.row}:${p.column}`;
const sameText = (p: Placed) => p.cell.value.trim().toLowerCase();

/** Up to `count` of the cells, in the order of their numbers (texts after), each with the look it got */
export function sampleOf(cells: readonly Placed[], styles: ReadonlyMap<string, Style>, count = 8): SampleCell[] {
  const numbers = cells.filter((p) => p.cell.number !== undefined).sort((a, b) => a.cell.number! - b.cell.number!);
  const texts = cells.filter((p) => p.cell.number === undefined && p.cell.text.trim() !== "");
  // The numbers at their places from the smallest to the largest, as many as there is room for (texts get a third at least)
  const forNumbers = texts.length ? Math.max(Math.min(numbers.length, count - Math.min(texts.length, Math.ceil(count / 3))), 0) : Math.min(numbers.length, count);
  const picked = new Set<Placed>();
  for (let i = 0; i < forNumbers; i++) picked.add(numbers[forNumbers === 1 ? 0 : Math.round((i * (numbers.length - 1)) / (forNumbers - 1))]!);
  // Then texts, each once, as many as are left room for
  const seen = new Set<string>();
  for (const p of texts) {
    if (picked.size >= count) break;
    if (seen.has(sameText(p))) continue;
    seen.add(sameText(p));
    picked.add(p);
  }
  // A cell the rule formats and one it does not, where the cells have both and the sample has not
  const formatted = (p: Placed) => styles.has(keyOf(p));
  const ensure = (want: boolean) => {
    if ([...picked].some((p) => formatted(p) === want)) return;
    const one = cells.find((p) => formatted(p) === want && (p.cell.number !== undefined || p.cell.text.trim() !== ""));
    if (!one) return;
    // In place of a cell of the other kind, the sample keeping its size
    const other = [...picked].reverse().find((p) => formatted(p) !== want);
    if (other && picked.size >= count) picked.delete(other);
    picked.add(one);
  };
  ensure(true);
  ensure(false);
  const ordered = [...picked].sort((a, b) => {
    const na = a.cell.number;
    const nb = b.cell.number;
    if (na !== undefined && nb !== undefined) return na - nb;
    if (na !== undefined) return -1;
    if (nb !== undefined) return 1;
    return 0;
  });
  return ordered.map((p) => {
    const style = styles.get(keyOf(p));
    return style ? { text: p.cell.text, style } : { text: p.cell.text };
  });
}
