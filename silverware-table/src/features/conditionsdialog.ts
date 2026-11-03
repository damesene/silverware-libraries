// The conditional formatting module's dialog: a table's rules in the order
// they apply, each a line (where, which cells, how they look, a sample), the
// one picked edited in place under its line (no dialog over the dialog). Its
// fields are made from the definitions' params (ParamSpec): a number, a
// choice, a text, a pattern (checked as typed), a color (the palette's
// swatches or one picked), a switch, a style (fill, text color, bold, italic,
// underline, strikethrough) and a list of rows of them. Every change is shown
// in the table at once (`preview`); Save writes them, Cancel and Esc leave the
// table as it was. It knows nothing of tables or writing: the module gives it
// the rules and takes them back.
import { el, type ElementChild } from "../../../shared/elements.ts";
import type { Dialog, ModelHost } from "../core/feature.ts";
import {
  allConditions,
  allFormats,
  cellOf,
  type Color,
  conditionNamed,
  evaluateRules,
  formatNamed,
  isPaletteName,
  isUnread,
  PALETTE_NAMES,
  type ParamSpec,
  type ParamSpecs,
  type Params,
  readParams,
  type Ref,
  type Rule,
  type RuleScope,
  type StoredRule,
  storedParams,
  type Style,
  styleLook,
} from "../conditions/index.ts";
import { parseFilter } from "../filter.ts";

/** A column a rule may apply to: its place and its name */
export type ScopeColumn = { readonly column: number; readonly name: string };

/** A choice offered while a formula is typed: what the list shows, what it puts in place of from..to */
export type FormulaOffer = { readonly label: string; readonly insert: string; readonly kind: string };

/** What the dialog asks while a formula is typed (the formulas module's, where it is on) */
export type FormulaHelpers = {
  // The choices for the name typed before the caret, and where that name is
  readonly complete: (formula: string, caret: number) => { readonly from: number; readonly to: number; readonly choices: readonly FormulaOffer[] } | undefined;
  // The function the caret is in: its syntax, the argument at the caret
  readonly help: (formula: string, caret: number) => { readonly syntax: string; readonly description: string; readonly argument?: { readonly from: number; readonly to: number } } | undefined;
  // Why it does not read; undefined: it does
  readonly problem: (formula: string) => string | undefined;
};

/** A rule on the table's own cells: a line of a sample for each of its ranges, how many cells it formats of how many */
export type RuleSample = {
  readonly lines: readonly { readonly label?: string; readonly cells: readonly { readonly text: string; readonly style?: Style }[] }[];
  // Ranges past those shown (columns)
  readonly more: number;
  readonly formatted: number;
  readonly total: number;
};

export type ConditionsDialogOptions = {
  readonly title: string;
  readonly columns: readonly ScopeColumn[];
  // The table's named rows (a row's scope)
  readonly rows: readonly string[];
  readonly rules: readonly StoredRule[];
  // A rule added as the dialog opens, its editor open (a quick rule of a column's menu)
  readonly added?: Rule;
  // The rules shown in the table as they are now; undefined: as written again
  readonly preview: (rules: readonly StoredRule[] | undefined) => void;
  readonly save: (rules: readonly StoredRule[]) => void;
  // How a rule looks on the table's own cells (the rule alone): the preview under its editor
  readonly sample?: (rule: Rule) => RuleSample | undefined;
  // Help while a formula param is typed; none: a plain text field
  readonly formulas?: FormulaHelpers;
  // Why it cannot be saved (the metadata setting off)
  readonly blocked?: string;
};

const NONE = "";
// The group of a definition without a category
const OTHER = "Other";

/** A swatch's text: what a sample shows */
const SAMPLE = "Aa 12";

// The numbers a strip samples a format at (0 to 100): a part for each run of the same look
const STRIP_STEPS = 11;

export function openConditionsDialog(host: ModelHost, options: ConditionsDialogOptions): Dialog {
  const doc = host.doc;
  const e = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Parameters<typeof el>[2], ...children: ElementChild[]) => el(doc, tag, props, ...children);
  let rules: StoredRule[] = [...options.rules, ...(options.added ? [options.added] : [])];
  let open = options.added ? rules.length - 1 : -1;
  let saved = false;

  // Focusable itself: where the focus goes when what had it is made anew without it (the dialog's keys stay its)
  const list = e("div", { class: "swt-cf-list", attrs: { tabindex: "-1" } });
  const submit = e("button", { class: "swt-dialog-primary", text: "Save" });

  // ---- shown in the table as it changes ----------------------------------------------
  let previewing: ReturnType<typeof setTimeout> | undefined;
  const previewSoon = () => {
    clearTimeout(previewing);
    previewing = setTimeout(() => options.preview(rules), 120);
  };

  const set = (i: number, rule: StoredRule) => {
    rules = rules.map((r, j) => (j === i ? rule : r));
    render();
    previewSoon();
  };
  // A field typed in: the rule changed without making the list anew (the field keeps its focus)
  const typed = (i: number, rule: StoredRule) => {
    rules = rules.map((r, j) => (j === i ? rule : r));
    previewSoon();
    refreshLine(i);
    sampleSoon();
  };

  // ---- the open rule's preview on the table's own cells ----------------------------------------
  const sampleBox = e("div", { class: "swt-cf-preview", attrs: { "aria-live": "polite" } });
  const fillSample = () => {
    const rule = rules[open];
    const made = rule && !isUnread(rule) ? options.sample?.(rule) : undefined;
    if (!made) {
      sampleBox.replaceChildren(e("span", { class: "swt-cf-description", text: "No cells to show" }));
      return;
    }
    const count = (n: number) => n.toLocaleString();
    sampleBox.replaceChildren(
      ...made.lines.map((line) =>
        e(
          "div",
          "swt-cf-preview-line",
          line.label !== undefined ? e("span", { class: "swt-cf-preview-label", text: line.label, title: line.label }) : null,
          ...(line.cells.length ? line.cells.map((cell) => sampleCell(cell.text, cell.style)) : [e("span", { class: "swt-cf-description", text: "No values" })]),
        ),
      ),
      e(
        "p",
        { class: "swt-cf-description" },
        `Formats ${count(made.formatted)} of ${count(made.total)} ${made.total === 1 ? "cell" : "cells"}${made.more ? ` · ${made.more} more ${made.more === 1 ? "column" : "columns"} not shown` : ""}`,
      ),
    );
  };
  let sampling: ReturnType<typeof setTimeout> | undefined;
  const sampleSoon = () => {
    clearTimeout(sampling);
    sampling = setTimeout(fillSample, 150);
  };
  // A cell of the sample: its text, its look (none: as the table shows it)
  const sampleCell = (text: string, style: Style | undefined) => {
    const span = e("span", { class: "swt-cf-sample swt-cf-preview-cell", text: text === "" ? "\u00a0" : text, title: text });
    if (style) {
      const look = styleLook(style);
      for (const mark of look.marks) span.classList.add(`swt-${mark}`);
      for (const [name, value] of Object.entries(look.vars)) span.style.setProperty(name, value);
    }
    return span;
  };

  // ---- labels ---------------------------------------------------------------------------
  const scopeLabel = (scope: RuleScope): string =>
    scope.kind === "table" ? "Whole table" : scope.kind === "row" ? `Row ${scope.name}` : `Column ${options.columns.find((c) => c.column === scope.column)?.name ?? scope.column + 1}`;
  const conditionLabel = (rule: Rule): string => {
    if (!rule.when) return "All cells";
    const condition = conditionNamed(rule.when.name);
    if (!condition) return `${rule.when.name} (not defined)`;
    const params = readParams(condition.params, rule.when.params);
    const shown = Object.entries(condition.params ?? {})
      .map(([key, spec]) => valueText(spec, params[key]))
      .filter((t) => t !== "");
    return shown.length ? `${condition.label}: ${shown.join(", ")}` : condition.label;
  };
  const formatLabel = (rule: Rule): string => formatNamed(rule.format.name)?.label ?? `${rule.format.name} (not defined)`;

  // How a rule's format looks, as a strip (as Google Sheets previews a scale): its looks of the numbers from 0 to
  // 100 in order, one part each where they differ (a scale's colors, levels); a keyword's or a range's rows' styles
  const sample = (rule: Rule): HTMLElement => {
    const format = formatNamed(rule.format.name);
    const strip = e("span", { class: "swt-cf-strip", title: formatLabel(rule) });
    if (!format) return strip;
    const params = readParams(format.params, rule.format.params);
    const values = Array.from({ length: STRIP_STEPS }, (_, i) => String(Math.round((i * 100) / (STRIP_STEPS - 1))));
    const cells = values.map((v, i) => ({ row: i + 1, column: 0, cell: cellOf(v, v, "x"), rowCells: {} }));
    const { styles } = evaluateRules([{ rule: { scope: { kind: "column", column: 0 }, format: rule.format }, cells }]);
    let shown: (Style | undefined)[] = cells.map((c) => styles.get(`${c.row}:0`));
    if (shown.every((s) => s === undefined)) {
      // Keywords' or ranges' rows: each row's own style
      const rows = Object.entries(format.params ?? {}).find(([, spec]) => spec.kind === "list");
      const list = rows ? ((params[rows[0]] as readonly Record<string, unknown>[] | undefined) ?? []) : [];
      shown = list.map((row) => Object.values(row).find((v): v is Style => typeof v === "object" && v !== null && !Array.isArray(v)));
    }
    // One part for each run of the same look
    const parts = shown.filter((s, i) => s && (i === 0 || JSON.stringify(s) !== JSON.stringify(shown[i - 1])));
    for (const style of (parts.length ? parts : [undefined]).slice(0, STRIP_STEPS)) strip.append(swatch(style, true));
    return strip;
  };
  // A sample of a style: in a strip a part (Aa where the text's look is set), else a cell's text
  const swatch = (style: Style | undefined, part = false): HTMLElement => {
    const textShown = !part || (style !== undefined && (style.color !== undefined || style.bold || style.italic || style.underline || style.strike));
    const span = e("span", { class: part ? "swt-cf-sample swt-cf-part" : "swt-cf-sample", text: textShown ? (part ? "Aa" : SAMPLE) : "" });
    if (style) {
      const look = styleLook(style);
      for (const mark of look.marks) span.classList.add(`swt-${mark}`);
      for (const [name, value] of Object.entries(look.vars)) span.style.setProperty(name, value);
    }
    return span;
  };

  // ---- the list --------------------------------------------------------------------------
  const lines = new Map<number, HTMLElement>();
  const lineOf = (rule: StoredRule, i: number): HTMLElement => {
    const button = (text: string, title: string, run: () => void, disabled = false) => {
      const b = e("button", { class: "swt-cf-tool", text, title, attrs: { "aria-label": title, "data-focus": `rule ${i} ${title}` }, run });
      b.disabled = disabled;
      return b;
    };
    const tools = e(
      "span",
      "swt-cf-tools",
      button("↑", "Move up: applies before", () => move(i, -1), i === 0),
      button("↓", "Move down: applies after", () => move(i, 1), i === rules.length - 1),
      button("×", "Remove the rule", () => remove(i)),
    );
    if (isUnread(rule)) {
      return e("div", "swt-cf-line swt-cf-unread", e("span", { class: "swt-cf-summary", text: `A rule that does not read, kept as written: ${JSON.stringify(rule.unread)}` }), tools);
    }
    const summary = e(
      "button",
      { class: "swt-cf-summary", attrs: { "aria-expanded": String(open === i), "data-focus": `rule ${i} summary` }, title: open === i ? "Close the rule's settings" : "Edit the rule", run: () => toggle(i) },
      e("span", { class: "swt-cf-scope", text: scopeLabel(rule.scope) }),
      e("span", { class: "swt-cf-when", text: conditionLabel(rule) }),
      e("span", { class: "swt-cf-arrow", text: "→" }),
      e("span", { class: "swt-cf-format", text: formatLabel(rule) }),
      rule.stop ? e("span", { class: "swt-cf-stop", text: "stop", title: "The rules after it leave these cells alone" }) : null,
    );
    return e("div", { class: `swt-cf-line${open === i ? " swt-cf-open" : ""}` }, summary, sample(rule), tools);
  };
  const refreshLine = (i: number) => {
    const old = lines.get(i);
    const rule = rules[i];
    if (!old || !rule) return;
    const line = lineOf(rule, i);
    old.replaceWith(line);
    lines.set(i, line);
  };
  const toggle = (i: number) => {
    open = open === i ? -1 : i;
    render();
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...rules];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    rules = next;
    if (open === i) open = i + by;
    else if (open === i + by) open = i;
    render();
    previewSoon();
  };
  const remove = (i: number) => {
    rules = rules.filter((_, j) => j !== i);
    if (open === i) open = -1;
    else if (open > i) open--;
    render();
    previewSoon();
  };

  function render(): void {
    const focused = (doc.activeElement as HTMLElement | null)?.dataset?.focus;
    lines.clear();
    list.replaceChildren(
      ...rules.flatMap((rule, i) => {
        const line = lineOf(rule, i);
        lines.set(i, line);
        return open === i && !isUnread(rule) ? [line, editor(rule, i)] : [line];
      }),
      ...(rules.length ? [] : [e("p", { class: "swt-cf-none", text: "No rules yet: cells look as they are." })]),
      e("button", { class: "swt-pivot-add", text: "+ Rule", run: add }),
    );
    const again = focused ? Array.from(list.querySelectorAll<HTMLElement>("[data-focus]")).find((f) => f.dataset.focus === focused) : undefined;
    if (again) again.focus();
    if (open >= 0 && options.sample) fillSample();
    else if (list.isConnected && !list.closest("[role=dialog], dialog, .swt-dialog")?.contains(doc.activeElement)) list.focus({ preventScroll: true });
    const problem = options.blocked;
    submit.disabled = !!problem;
    submit.title = problem ?? "";
  }

  const add = () => {
    const first = options.columns[0];
    rules = [...rules, { scope: first ? { kind: "column", column: first.column } : { kind: "table" }, when: { name: "greater", params: {} }, format: { name: "redFill", params: {} } }];
    open = rules.length - 1;
    render();
    previewSoon();
  };

  // ---- a rule's editor ---------------------------------------------------------------------
  function editor(rule: Rule, i: number): HTMLElement {
    const scopes: { readonly value: string; readonly label: string; readonly scope: RuleScope }[] = [
      { value: "table", label: "Whole table", scope: { kind: "table" } },
      ...options.columns.map((c) => ({ value: `c${c.column}`, label: `Column ${c.name}`, scope: { kind: "column", column: c.column } as RuleScope })),
      ...[...new Set([...options.rows, ...(rule.scope.kind === "row" ? [rule.scope.name] : [])])].map((name) => ({ value: `r${name}`, label: `Row ${name}`, scope: { kind: "row", name } as RuleScope })),
    ];
    const scopeValue = rule.scope.kind === "table" ? "table" : rule.scope.kind === "column" ? `c${rule.scope.column}` : `r${rule.scope.name}`;
    const scope = select(
      scopes.map((s) => s.value),
      (v) => scopes.find((s) => s.value === v)?.label ?? v,
      scopeValue,
      (v) => {
        const { perColumn: _, ...rest } = rule;
        const next = scopes.find((s) => s.value === v)!.scope;
        set(i, { ...(next.kind === "table" ? rule : rest), scope: next });
      },
      `rule ${i} scope`,
      "Applies to",
    );
    const conditions = lastWithout(allConditions());
    const when = select(
      [NONE, ...conditions.map((c) => c.name), ...(rule.when && !conditionNamed(rule.when.name) ? [rule.when.name] : [])],
      (v) => (v === NONE ? "All cells" : (conditionNamed(v)?.label ?? `${v} (not defined)`)),
      rule.when?.name ?? NONE,
      (v) => {
        const { when: _, ...rest } = rule;
        set(i, v === NONE ? rest : { ...rest, when: { name: v, params: {} } });
      },
      `rule ${i} condition`,
      "Which cells",
      (v) => (v === NONE ? undefined : (conditionNamed(v)?.category ?? OTHER)),
    );
    const format = select(
      [...lastWithout(allFormats()).map((f) => f.name), ...(formatNamed(rule.format.name) ? [] : [rule.format.name])],
      (v) => formatNamed(v)?.label ?? `${v} (not defined)`,
      rule.format.name,
      (v) => set(i, { ...rule, format: { name: v, params: {} } }),
      `rule ${i} format`,
      "Format",
      (v) => formatNamed(v)?.category ?? OTHER,
    );
    const condition = rule.when ? conditionNamed(rule.when.name) : undefined;
    const formatDefinition = formatNamed(rule.format.name);
    const refFields = (ref: Ref, specs: ParamSpecs | undefined, which: "when" | "format") => {
      if (!specs || !Object.keys(specs).length) return null;
      const params = readParams(specs, ref.params);
      const changed = (key: string, value: unknown, typing: boolean) => {
        const next: Params = { ...params, [key]: value };
        const stored = storedParams(specs, next);
        const updated = { ...rule, [which]: { name: ref.name, params: stored } } as Rule;
        if (typing) {
          // The rule's own fields keep their values: the next change reads them
          Object.assign(params, next);
          rule = updated;
          typed(i, updated);
        } else set(i, updated);
      };
      // A param's `visible` is the user's code too: one that throws shows it
      const shownNow = (spec: ParamSpec) => {
        try {
          return !spec.visible || spec.visible(params) !== false;
        } catch {
          return true;
        }
      };
      const fieldOf = ([key, spec]: [string, ParamSpec], compact: boolean) =>
        field(spec, params[key], (v, typing) => changed(key, v, typing), `rule ${i} ${which} ${key}`, spec.label ?? key, compact);
      // Params of one line side by side under its name, in the order of their first
      const children: ElementChild[] = [];
      const lines = new Map<string, HTMLElement>();
      for (const entry of Object.entries(specs)) {
        const line = entry[1].line;
        if (!shownNow(entry[1])) continue;
        if (line === undefined) {
          children.push(fieldOf(entry, false));
          continue;
        }
        let box = lines.get(line);
        if (!box) {
          box = e("div", "swt-cf-param swt-cf-param-line", e("span", { class: "swt-cf-param-name", text: line }));
          lines.set(line, box);
          children.push(box);
        }
        box.append(fieldOf(entry, true));
      }
      return e("div", "swt-cf-params", ...children);
    };
    const describe = (text: string | undefined) => (text ? e("p", { class: "swt-cf-description", text }) : null);
    // A whole table's rule: its cells as one range (as a spreadsheet's), or each column on its own
    const perColumn = e("input", { attrs: { type: "checkbox", "data-focus": `rule ${i} perColumn` } });
    perColumn.checked = !!rule.perColumn;
    perColumn.addEventListener("change", () => {
      const { perColumn: _, ...rest } = rule;
      set(i, perColumn.checked ? { ...rest, perColumn: true } : rest);
    });
    const stop = e("input", { attrs: { type: "checkbox", "data-focus": `rule ${i} stop` } });
    stop.checked = !!rule.stop;
    stop.addEventListener("change", () => {
      const { stop: _, ...rest } = rule;
      set(i, stop.checked ? { ...rest, stop: true } : rest);
    });
    return e(
      "div",
      "swt-cf-editor",
      section(
        "Applies to",
        scope,
        rule.scope.kind === "table" ? e("label", "swt-pivot-toggle", perColumn, "Each column on its own: its own scale, levels, bars and icons, its own top values, average and duplicates (else the table's cells as one range)") : null,
      ),
      section("Which cells", when, describe(condition?.description), rule.when ? refFields(rule.when, condition?.params, "when") : null),
      section("Format", format, describe(formatDefinition?.description), refFields(rule.format, formatDefinition?.params, "format")),
      section("", e("label", "swt-pivot-toggle", stop, "Stop: the rules after this one leave the cells it formats alone")),
      ...(options.sample ? [section("Preview", sampleBox)] : []),
    );
  }

  const section = (title: string, ...children: ElementChild[]) =>
    e("div", "swt-cf-section", e("div", { class: "swt-cf-label", text: title }), e("div", "swt-cf-fields", ...children));

  const select = (
    values: readonly string[],
    label: (v: string) => string,
    value: string,
    changed: (v: string) => void,
    focus: string,
    aria: string,
    // A value's group (an optgroup), in the order the groups first come; undefined: none
    group?: (v: string) => string | undefined,
  ): HTMLSelectElement => {
    const s = e("select", { attrs: { "aria-label": aria, "data-focus": focus } });
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const v of values) {
      const name = group?.(v);
      if (name === undefined) {
        s.append(new Option(label(v), v));
        continue;
      }
      let optgroup = groups.get(name);
      if (!optgroup) {
        optgroup = e("optgroup", { attrs: { label: name } });
        groups.set(name, optgroup);
        s.append(optgroup);
      }
      optgroup.append(new Option(label(v), v));
    }
    s.value = value;
    s.addEventListener("change", () => changed(s.value));
    return s;
  };

  // ---- fields made of params ------------------------------------------------------------
  /** A param's field: `changed(value, typing)`, typing true while text is typed (the form not made anew) */
  function field(spec: ParamSpec, value: unknown, changed: (value: unknown, typing: boolean) => void, focus: string, label: string, compact = false): HTMLElement {
    // On a line of its own, its name before it; on a line of several, the line's name stands for it (its own the field's)
    const labelled = (...children: ElementChild[]) =>
      compact ? e("span", "swt-cf-param", ...children) : e("label", "swt-cf-param", e("span", { class: "swt-cf-param-name", text: label }), ...children);
    switch (spec.kind) {
      case "number": {
        const input = e("input", { attrs: { type: "number", "aria-label": label, "data-focus": focus, ...(spec.min !== undefined ? { min: String(spec.min) } : {}), ...(spec.max !== undefined ? { max: String(spec.max) } : {}) } });
        input.value = typeof value === "number" ? String(value) : "";
        input.addEventListener("input", () => {
          const n = input.value.trim() === "" ? undefined : Number(input.value);
          changed(n !== undefined && Number.isFinite(n) ? n : undefined, true);
        });
        return labelled(input);
      }
      case "choice":
        return labelled(select(spec.values, (v) => spec.labels?.[spec.values.indexOf(v)] ?? v, String(value ?? spec.values[0]), (v) => changed(v, false), focus, label));
      case "formula":
        if (options.formulas) return labelled(formulaField(options.formulas, typeof value === "string" ? value : "", (v) => changed(v, true), focus, label));
      // falls through: no formulas module, a text field
      case "text":
      case "pattern": {
        const input = e("input", { attrs: { type: "text", "aria-label": label, "data-focus": focus, ...(spec.kind === "pattern" ? { placeholder: "word, /regex/, =a|b, >10" } : {}) } });
        input.value = typeof value === "string" ? value : "";
        const problem = e("span", "swt-cf-problem");
        const check = () => {
          problem.textContent = spec.kind === "pattern" ? (parseFilter(input.value).error ?? "") : "";
        };
        check();
        input.addEventListener("input", () => {
          check();
          changed(input.value, true);
        });
        return labelled(input, problem);
      }
      case "boolean": {
        const box = e("input", { attrs: { type: "checkbox", "data-focus": focus } });
        box.checked = value === true;
        box.addEventListener("change", () => changed(box.checked, false));
        return e("label", "swt-pivot-toggle", box, label);
      }
      case "color":
        return labelled(colorField(value as Color | undefined, (c) => changed(c, false), focus, label, false));
      case "style":
        return labelled(styleField((value as Style | undefined) ?? {}, (s) => changed(s, false), focus));
      case "list": {
        const rows = (Array.isArray(value) ? value : []) as Readonly<Record<string, unknown>>[];
        const setRows = (next: readonly Readonly<Record<string, unknown>>[]) => changed(next, false);
        const rowEl = (row: Readonly<Record<string, unknown>>, r: number) => {
          const tool = (text: string, title: string, run: () => void, disabled = false) => {
            const b = e("button", { class: "swt-cf-tool", text, title, attrs: { "aria-label": title }, run });
            b.disabled = disabled;
            return b;
          };
          return e(
            "div",
            "swt-cf-list-row",
            e(
              "div",
              "swt-cf-list-fields",
              ...Object.entries(spec.of).map(([key, inner]) =>
              field(
                inner,
                row[key],
                (v, typing) => {
                  const next = rows.map((x, j) => (j === r ? { ...x, [key]: v } : x));
                  if (typing) {
                    rows[r] = next[r]!;
                    changed(next, true);
                  } else setRows(next);
                },
                `${focus} ${r} ${key}`,
                inner.label ?? key,
              ),
              ),
            ),
            e(
              "span",
              "swt-cf-tools",
              tool("↑", "Move up", () => setRows(swap(rows, r, -1)), r === 0),
              tool("↓", "Move down", () => setRows(swap(rows, r, 1)), r === rows.length - 1),
              tool("×", "Remove", () => setRows(rows.filter((_, j) => j !== r))),
            ),
          );
        };
        return e(
          "div",
          "swt-cf-param swt-cf-param-list",
          e("span", { class: "swt-cf-param-name", text: label }),
          ...rows.map(rowEl),
          e("button", { class: "swt-pivot-add", text: "+ Add", run: () => setRows([...rows, readParams(spec.of, {})]) }),
        );
      }
    }
  }

  /**
   * A formula's field: the functions and the table's columns offered as a name is typed (↑ ↓ to pick, Enter or
   * Tab to put it in, Esc to close the list, a click), the syntax of the function the caret is in (the argument at
   * the caret marked), why it does not read
   */
  function formulaField(helpers: FormulaHelpers, value: string, changed: (v: string) => void, focus: string, label: string): HTMLElement {
    const input = e("input", { class: "swt-cf-formula", attrs: { type: "text", "aria-label": label, "data-focus": focus, placeholder: "=[@due] < TODAY()", spellcheck: "false", autocomplete: "off" } });
    input.value = value;
    const list = e("div", { class: "swt-cf-choices", attrs: { role: "listbox" } });
    const help = e("div", "swt-cf-formula-help");
    const problem = e("span", "swt-cf-problem");
    let offered: ReturnType<FormulaHelpers["complete"]>;
    let active = 0;
    // The list closed for the name it was closed at (Esc), until another is typed
    let closedAt: string | undefined;
    const caret = () => input.selectionStart ?? input.value.length;
    const put = (i: number) => {
      const choice = offered?.choices[i];
      if (!offered || !choice) return;
      input.value = input.value.slice(0, offered.from) + choice.insert + input.value.slice(offered.to);
      const at = offered.from + choice.insert.length;
      input.setSelectionRange(at, at);
      input.focus();
      update(true);
    };
    const showList = () => {
      list.replaceChildren(
        ...(offered?.choices ?? []).map((choice, i) =>
          e(
            "div",
            {
              class: `swt-cf-choice${i === active ? " swt-cf-choice-active" : ""}`,
              attrs: { role: "option", "aria-selected": String(i === active) },
              // A press keeps the field's focus; the choice is put in
              on: { mousedown: (ev: Event) => ev.preventDefault(), click: () => put(i) },
            },
            e("span", { class: "swt-cf-choice-name", text: choice.label }),
            e("span", { class: "swt-cf-choice-kind", text: choice.kind }),
          ),
        ),
      );
      list.hidden = !offered;
    };
    const showHelp = () => {
      const h = helpers.help(input.value, caret());
      if (!h) {
        help.replaceChildren();
        return;
      }
      const syntax = e("code", "swt-cf-formula-syntax");
      if (h.argument) {
        syntax.append(h.syntax.slice(0, h.argument.from), e("b", { text: h.syntax.slice(h.argument.from, h.argument.to) }), h.syntax.slice(h.argument.to));
      } else syntax.textContent = h.syntax;
      help.replaceChildren(syntax, e("span", { class: "swt-cf-description", text: h.description }));
    };
    // `typing`: the text changed (else only the caret moved: the list closes, it opens as a name is typed)
    const update = (typing: boolean) => {
      const at = caret();
      const made = typing && input.selectionStart === input.selectionEnd ? helpers.complete(input.value, at) : undefined;
      const key = made ? `${made.from}:${input.value.slice(made.from, at)}` : undefined;
      if (typing && key !== closedAt) closedAt = undefined;
      offered = made && key !== closedAt ? made : undefined;
      active = 0;
      showList();
      showHelp();
      problem.textContent = input.value.trim() === "" ? "" : (helpers.problem(input.value) ?? "");
      if (typing) changed(input.value);
    };
    input.addEventListener("input", () => update(true));
    // The caret moved (a click, an arrow, Home, End): the list closes, the help follows the caret; a key that typed
    // was the input's (its keyup leaves the list as typing made it)
    const MOVES = new Set(["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
    input.addEventListener("keyup", (ev) => (MOVES.has(ev.key) ? update(false) : showHelp()));
    for (const event of ["click", "focus"]) input.addEventListener(event, () => update(false));
    input.addEventListener("blur", () => {
      offered = undefined;
      showList();
    });
    input.addEventListener("keydown", (ev) => {
      if (!offered) return;
      const count = offered.choices.length;
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        active = (active + (ev.key === "ArrowDown" ? 1 : count - 1)) % count;
        showList();
      } else if (ev.key === "Enter" || ev.key === "Tab") put(active);
      else if (ev.key === "Escape") {
        // The list closes; the dialog stays
        closedAt = `${offered.from}:${input.value.slice(offered.from, caret())}`;
        offered = undefined;
        showList();
      } else return;
      ev.preventDefault();
      ev.stopPropagation();
    });
    list.hidden = true;
    problem.textContent = value.trim() === "" ? "" : (helpers.problem(value) ?? "");
    // The list under the field itself, not under the help after it
    return e("span", "swt-cf-formula-box", e("span", "swt-cf-formula-input", input, list), problem, help);
  }

  const swap = <T>(list: readonly T[], i: number, by: -1 | 1): T[] => {
    const out = [...list];
    [out[i], out[i + by]] = [out[i + by]!, out[i]!];
    return out;
  };

  /** A color: the palette's swatches, one picked of the browser's, none where it may be left out */
  function colorField(value: Color | undefined, changed: (c: Color | undefined) => void, focus: string, label: string, optional: boolean, use: "fill" | "text" = "fill"): HTMLElement {
    const box = e("span", { class: "swt-cf-colors", attrs: { role: "group", "aria-label": label } });
    const current = typeof value === "string" ? value : undefined;
    if (optional) {
      const none = e("button", { class: "swt-cf-swatch swt-cf-swatch-none", title: "None", attrs: { "aria-label": "None", "aria-pressed": String(value === undefined), "data-focus": `${focus} none` }, run: () => changed(undefined) });
      box.append(none);
    }
    for (const name of PALETTE_NAMES) {
      const swatch = e("button", { class: "swt-cf-swatch", title: name, attrs: { "aria-label": name, "aria-pressed": String(current === name), "data-focus": `${focus} ${name}` }, run: () => changed(name) });
      swatch.style.background = `var(--swt-cf-${name}-${use === "text" ? "text" : "fill"})`;
      box.append(swatch);
    }
    const picker = e("input", { attrs: { type: "color", title: "Another color", "aria-label": "Another color", "data-focus": `${focus} picker` } });
    picker.value = current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#888888";
    if (current && !isPaletteName(current)) picker.classList.add("swt-cf-picked");
    if (value !== undefined && typeof value !== "string") picker.title = "A color of each look, as defined";
    picker.addEventListener("change", () => changed(picker.value));
    box.append(picker);
    return box;
  }

  /** A style: its fill, its text's color, bold, italic, underline, strikethrough, and how it looks */
  function styleField(style: Style, changed: (s: Style) => void, focus: string): HTMLElement {
    const with_ = (key: keyof Style, value: unknown): Style => {
      const out: Record<string, unknown> = { ...style, [key]: value };
      if (value === undefined || value === false) delete out[key];
      return out as Style;
    };
    const flag = (key: "bold" | "italic" | "underline" | "strike", text: string, title: string) =>
      e("button", { class: `swt-cf-flag swt-cf-flag-${key}`, text, title, attrs: { "aria-label": title, "aria-pressed": String(!!style[key]), "data-focus": `${focus} ${key}` }, run: () => changed(with_(key, !style[key])) });
    return e(
      "span",
      "swt-cf-style",
      e("span", "swt-cf-style-row", e("span", { class: "swt-cf-style-name", text: "Fill" }), colorField(style.fill, (c) => changed(with_("fill", c)), `${focus} fill`, "Fill", true)),
      e("span", "swt-cf-style-row", e("span", { class: "swt-cf-style-name", text: "Text" }), colorField(style.color, (c) => changed(with_("color", c)), `${focus} color`, "Text color", true, "text")),
      e("span", "swt-cf-style-row", e("span", { class: "swt-cf-style-name", text: "" }), flag("bold", "B", "Bold"), flag("italic", "I", "Italic"), flag("underline", "U", "Underline"), flag("strike", "S", "Strikethrough"), swatch(style)),
    );
  }

  render();
  // A rule added as it opens shows in the table at once
  if (options.added) previewSoon();
  const cancel = e("button", { class: "swt-dialog-button", text: "Cancel" });
  const footer = e("div", "swt-pivot-foot", e("span", { class: "swt-pivot-note", text: options.blocked ?? "Changes show in the table as you make them" }), cancel, submit);
  const dialog = host.openDialog({
    title: options.title,
    subtitle: "Cells that look different by their values; the rules apply in this order",
    className: "swt-cf-dialog",
    // The table under it, shown as the rules change, a look away
    peek: true,
    content: e("div", "swt-pivot swt-cf", list),
    footer,
    closed: () => {
      clearTimeout(previewing);
      clearTimeout(sampling);
      if (!saved) options.preview(undefined);
    },
  });
  cancel.addEventListener("click", () => dialog.close());
  submit.addEventListener("click", () => {
    if (submit.disabled) return;
    saved = true;
    clearTimeout(previewing);
    dialog.close();
    options.save(rules);
  });
  return dialog;
}

/** Definitions with their categories first, in their order, then those without one (Other) */
function lastWithout<T extends { readonly category?: string }>(list: readonly T[]): T[] {
  return [...list.filter((d) => d.category !== undefined), ...list.filter((d) => d.category === undefined)];
}

/** A param's value as a rule's line shows it */
function valueText(spec: ParamSpec, value: unknown): string {
  if (value === undefined || value === "") return "";
  if (spec.kind === "choice") return spec.labels?.[spec.values.indexOf(String(value))] ?? String(value);
  if (spec.kind === "boolean") return value ? (spec.label ?? "yes") : "";
  if (spec.kind === "number" || spec.kind === "text" || spec.kind === "pattern") return String(value);
  return "";
}
