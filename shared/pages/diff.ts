// A page's change as the preview shows it: the lines changed, before and
// after, in runs (each with the line it starts on), the lines around them left
// out. Lines matched by their longest common subsequence where the part
// changed is small enough, else that part shown whole.

export type DiffRun = {
  // The first line of the run in the text before (1-based)
  readonly line: number;
  readonly removed: readonly string[];
  readonly added: readonly string[];
};

// Lines of the part changed past which it is shown whole (the table of the subsequence grows with their product)
const MATCHED = 2000;

export function diffLines(before: string, after: string): DiffRun[] {
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  const x = a.slice(start, a.length - end);
  const y = b.slice(start, b.length - end);
  if (!x.length && !y.length) return [];
  if (x.length * y.length > MATCHED * MATCHED / 4 || x.length + y.length > MATCHED) return [{ line: start + 1, removed: x, added: y }];
  // The longest common subsequence's lengths, from the ends
  const lengths: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) lengths[i]![j] = x[i] === y[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
  const runs: DiffRun[] = [];
  let run: { line: number; removed: string[]; added: string[] } | undefined;
  const flush = () => {
    if (run) runs.push(run);
    run = undefined;
  };
  let i = 0;
  let j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      flush();
      i++;
      j++;
    } else if (j < y.length && (i === x.length || lengths[i]![j + 1]! >= lengths[i + 1]![j]!)) {
      run ??= { line: start + i + 1, removed: [], added: [] };
      run.added.push(y[j++]!);
    } else {
      run ??= { line: start + i + 1, removed: [], added: [] };
      run.removed.push(x[i++]!);
    }
  }
  flush();
  return runs;
}

/** The one edit making `before` into `after`: what lies between their common start and end */
export function minimalEdit(before: string, after: string): { from: number; to: number; insert: string } | undefined {
  if (before === after) return undefined;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start++;
  let end = 0;
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}
