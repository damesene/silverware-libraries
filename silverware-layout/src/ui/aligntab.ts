// The Alignment tab of the settings dialog (docs/silverware-layout-align.md): where each kind of widget stands where
// it says nothing itself, a row per kind of the providers registered (a medium's preview and a file shown full, a table, a
// chart), each a pick list, its kind's own default named. A widget's own (its handle's menu) wins. Saved on Save, as
// every tab.
import type { LayoutAlign, LayoutKind } from "../../../shared/layout.ts";
import { el } from "../../../shared/elements.ts";
import { ALIGN_NAMES, ALIGNS } from "../model/settings.ts";
import type { DialogTabPart } from "./pagedialog.ts";

const OWN_DEFAULT = "";

/** A kind of widget as the tab lists it: its key (`<provider>/<kind>`), its name, its own default */
export type AlignKind = { readonly key: string; readonly kind: LayoutKind };

export function alignTab(doc: Document, kinds: readonly AlignKind[], alignments: Readonly<Record<string, LayoutAlign>>, save: (alignments: Readonly<Record<string, LayoutAlign>>) => Promise<string | undefined>): DialogTabPart {
  const rows = kinds.map(({ key, kind }) => {
    const own = kind.align ?? "center";
    const select = el(doc, "select", { class: "swl-align-select", attrs: { "aria-label": `${kind.name}: where it stands` } });
    select.append(el(doc, "option", { text: `${ALIGN_NAMES[own]} (default)`, attrs: { value: OWN_DEFAULT } }));
    for (const align of ALIGNS) if (align !== own) select.append(el(doc, "option", { text: ALIGN_NAMES[align], attrs: { value: align } }));
    select.value = alignments[key] && alignments[key] !== own ? alignments[key] : OWN_DEFAULT;
    return { key, select, row: el(doc, "label", "swl-align-row", el(doc, "span", { class: "swl-align-name", text: kind.name }), select) };
  });
  // (The saved ones of kinds not shown, their plugin not registered now, kept: saving the rows shown takes none of them off)
  const current = (): Readonly<Record<string, LayoutAlign>> => {
    const shown = new Set(rows.map((one) => one.key));
    const kept = Object.entries(alignments).filter(([key]) => !shown.has(key));
    return Object.fromEntries([...kept, ...rows.filter((one) => one.select.value !== OWN_DEFAULT).map((one) => [one.key, one.select.value as LayoutAlign] as const)]);
  };
  const was = JSON.stringify(current());
  const panel = el(
    doc,
    "div",
    "swl-align",
    el(doc, "p", "swl-align-note", "Default alignment for each kind of widget. An alignment set in a widget's own menu overrides it."),
    ...(rows.length ? rows.map((one) => one.row) : [el(doc, "p", "swl-align-note", "No installed plugin has widgets to align.")]),
  );
  return {
    id: "alignment",
    title: "Alignment",
    panel,
    changed: () => JSON.stringify(current()) !== was,
    save: () => save(current()),
  };
}
