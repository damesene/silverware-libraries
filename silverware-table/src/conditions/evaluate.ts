// A table's rules evaluated: for each rule in order, the cells of its scope
// (the caller's: body cells only, pinned ones left out), those its condition
// picks, then its format's look of each; a cell's styles combined, an earlier
// rule's property kept; `stop` leaving the cells a rule picked to it alone.
// A definition is the user's code: one that throws, or gives what is no
// boolean or style, formats nothing for that rule and is said once.
import type { Cell, ConditionDefinition, Context, FormatDefinition, Style } from "./api.ts";
import { readParams } from "./params.ts";
import { conditionNamed, formatNamed } from "./registry.ts";
import type { Rule } from "./rule.ts";
import { scopeOf } from "./scope.ts";
import { checkStyle, combineStyles, emptyStyle } from "./style.ts";

/** A cell of a rule's scope: where it is (the markdown's row, header 0; its column), as definitions get it, and its row's cells */
export type Placed = { readonly row: number; readonly column: number; readonly cell: Cell; readonly rowCells: Readonly<Record<string, Cell>> };

/** A rule with the cells of its scope */
export type RuleCells = { readonly rule: Rule; readonly cells: readonly Placed[] };

/** The style of each cell formatted, by "row:column"; what went wrong, a line for each rule */
export type Evaluated = { readonly styles: ReadonlyMap<string, Style>; readonly problems: readonly string[] };

/** A formula of one row calculated for a row of the table (the markdown's); undefined: it cannot be */
export type RowFormula = (row: number, formula: string) => string | number | boolean | undefined;

const keyOf = (p: Placed) => `${p.row}:${p.column}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function evaluateRules(rules: readonly RuleCells[], formula: RowFormula = () => undefined): Evaluated {
  const styles = new Map<string, Style>();
  const stopped = new Set<string>();
  const problems: string[] = [];
  for (const { rule, cells } of rules) {
    const condition: ConditionDefinition | undefined = rule.when ? conditionNamed(rule.when.name) : undefined;
    const format: FormatDefinition | undefined = formatNamed(rule.format.name);
    if (rule.when && !condition) {
      problems.push(`no condition is named ${rule.when.name}`);
      continue;
    }
    if (!format) {
      problems.push(`no format is named ${rule.format.name}`);
      continue;
    }
    const open = cells.filter((p) => !stopped.has(keyOf(p)));
    const context = (p: Placed, params: Context["params"], scope: Context["scope"]): Context => ({
      params,
      scope,
      row: p.rowCells,
      formula: (text) => formula(p.row, text),
    });
    let picked: readonly Placed[] = open;
    if (condition) {
      const params = readParams(condition.params, rule.when!.params);
      const scope = scopeOf(cells.map((p) => p.cell));
      try {
        picked = open.filter((p) => {
          const result = condition.test(p.cell, context(p, params, scope));
          if (typeof result !== "boolean") throw new Error(`its test gave ${typeof result}, not true or false`);
          return result;
        });
      } catch (e) {
        problems.push(`the condition ${condition.name} failed: ${message(e)}`);
        continue;
      }
    }
    const params = readParams(format.params, rule.format.params);
    const scope = scopeOf(picked.map((p) => p.cell));
    let fixed: Style | undefined;
    try {
      if (format.style !== undefined) {
        const style = checkStyle(typeof format.style === "function" ? format.style(params) : format.style);
        if (typeof style === "string") throw new Error(style);
        fixed = style;
      }
      const looks = picked.map((p) => {
        if (fixed) return fixed;
        const style = checkStyle(format.look!(p.cell, context(p, params, scope)));
        if (typeof style === "string") throw new Error(style);
        return style;
      });
      picked.forEach((p, i) => {
        const style = looks[i]!;
        const key = keyOf(p);
        if (!emptyStyle(style)) styles.set(key, styles.has(key) ? combineStyles(styles.get(key)!, style) : style);
        if (rule.stop) stopped.add(key);
      });
    } catch (e) {
      problems.push(`the format ${format.name} failed: ${message(e)}`);
    }
  }
  return { styles, problems };
}
