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
  // Why it cannot be saved (the metadata setting off)
  readonly blocked?: string;
};

const NONE = "";

/** A swatch's text: what a sample shows */
const SAMPLE = "Aa 12";

export function openConditionsDialog(host: ModelHost, options: ConditionsDialogOptions): Dialog {
  const doc = host.doc;
  const e = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Parameters<typeof el>[2], ...children: ElementChild[]) => el(doc, tag, props, ...children);
  let rules: StoredRule[] = [...options.rules, ...(options.added ? [options.added] : [])];
  let open = options.added ? rules.length - 1 : -1;
  let saved = false;

  const list = e("div", "swt-cf-list");
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

  // A sample of how a rule's format looks: three cells of low, middle and high numbers (a keyword's: its rows' styles)
  const sample = (rule: Rule): HTMLElement => {
    const format = formatNamed(rule.format.name);
    const box = e("span", "swt-cf-samples");
    if (!format) return box;
    const params = readParams(format.params, rule.format.params);
    const cells = ["10", "55", "100"].map((v, i) => ({ row: i + 1, column: 0, cell: cellOf(v, v, "x"), rowCells: {} }));
    const { styles } = evaluateRules([{ rule: { scope: { kind: "column", column: 0 }, format: rule.format }, cells }]);
    let shown: (Style | undefined)[] = cells.map((c) => styles.get(`${c.row}:0`));
    if (shown.every((s) => s === undefined)) {
      // Keywords' or ranges' rows: each row's own style
      const rows = Object.entries(format.params ?? {}).find(([, spec]) => spec.kind === "list");
      const list = rows ? ((params[rows[0]] as readonly Record<string, unknown>[] | undefined) ?? []) : [];
      shown = list.slice(0, 3).map((row) => Object.values(row).find((v): v is Style => typeof v === "object" && v !== null && !Array.isArray(v)));
    }
    const distinct = shown.filter((s, i) => s && shown.findIndex((t) => JSON.stringify(t) === JSON.stringify(s)) === i);
    for (const style of distinct.length ? distinct : [undefined]) box.append(swatch(style));
    return box;
  };
  const swatch = (style: Style | undefined): HTMLElement => {
    const span = e("span", { class: "swt-cf-sample", text: SAMPLE });
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
      const b = e("button", { class: "swt-cf-tool", text, title, attrs: { "aria-label": title }, run });
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
      { class: "swt-cf-summary", attrs: { "aria-expanded": String(open === i) }, title: open === i ? "Close the rule's settings" : "Edit the rule", run: () => toggle(i) },
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
    if (focused) Array.from(list.querySelectorAll<HTMLElement>("[data-focus]")).find((f) => f.dataset.focus === focused)?.focus();
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
      (v) => set(i, { ...rule, scope: scopes.find((s) => s.value === v)!.scope }),
      `rule ${i} scope`,
      "Applies to",
    );
    const conditions = allConditions();
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
    );
    const format = select(
      [...allFormats().map((f) => f.name), ...(formatNamed(rule.format.name) ? [] : [rule.format.name])],
      (v) => formatNamed(v)?.label ?? `${v} (not defined)`,
      rule.format.name,
      (v) => set(i, { ...rule, format: { name: v, params: {} } }),
      `rule ${i} format`,
      "Format",
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
      return e(
        "div",
        "swt-cf-params",
        ...Object.entries(specs).map(([key, spec]) => field(spec, params[key], (v, typing) => changed(key, v, typing), `rule ${i} ${which} ${key}`, spec.label ?? key)),
      );
    };
    const describe = (text: string | undefined) => (text ? e("p", { class: "swt-cf-description", text }) : null);
    const stop = e("input", { attrs: { type: "checkbox", "data-focus": `rule ${i} stop` } });
    stop.checked = !!rule.stop;
    stop.addEventListener("change", () => {
      const { stop: _, ...rest } = rule;
      set(i, stop.checked ? { ...rest, stop: true } : rest);
    });
    return e(
      "div",
      "swt-cf-editor",
      section("Applies to", scope),
      section("Which cells", when, describe(condition?.description), rule.when ? refFields(rule.when, condition?.params, "when") : null),
      section("Format", format, describe(formatDefinition?.description), refFields(rule.format, formatDefinition?.params, "format")),
      section("", e("label", "swt-pivot-toggle", stop, "Stop: the rules after this one leave the cells it formats alone")),
    );
  }

  const section = (title: string, ...children: ElementChild[]) =>
    e("div", "swt-cf-section", e("div", { class: "swt-cf-label", text: title }), e("div", "swt-cf-fields", ...children));

  const select = (values: readonly string[], label: (v: string) => string, value: string, changed: (v: string) => void, focus: string, aria: string): HTMLSelectElement => {
    const s = e("select", { attrs: { "aria-label": aria, "data-focus": focus } });
    for (const v of values) s.append(new Option(label(v), v));
    s.value = value;
    s.addEventListener("change", () => changed(s.value));
    return s;
  };

  // ---- fields made of params ------------------------------------------------------------
  /** A param's field: `changed(value, typing)`, typing true while text is typed (the form not made anew) */
  function field(spec: ParamSpec, value: unknown, changed: (value: unknown, typing: boolean) => void, focus: string, label: string): HTMLElement {
    const labelled = (...children: ElementChild[]) => e("label", "swt-cf-param", e("span", { class: "swt-cf-param-name", text: label }), ...children);
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
            tool("↑", "Move up", () => setRows(swap(rows, r, -1)), r === 0),
            tool("↓", "Move down", () => setRows(swap(rows, r, 1)), r === rows.length - 1),
            tool("×", "Remove", () => setRows(rows.filter((_, j) => j !== r))),
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
    subtitle: "Cells that look different where their values meet a condition; rules apply from the first, an earlier rule's look kept",
    className: "swt-cf-dialog",
    content: e("div", "swt-pivot swt-cf", list),
    footer,
    closed: () => {
      clearTimeout(previewing);
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

/** A param's value as a rule's line shows it */
function valueText(spec: ParamSpec, value: unknown): string {
  if (value === undefined || value === "") return "";
  if (spec.kind === "choice") return spec.labels?.[spec.values.indexOf(String(value))] ?? String(value);
  if (spec.kind === "boolean") return value ? (spec.label ?? "yes") : "";
  if (spec.kind === "number" || spec.kind === "text" || spec.kind === "pattern") return String(value);
  return "";
}
