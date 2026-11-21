// Silverware Table bound to SilverBullet (core/binding.ts): the adapter of the
// tables SilverBullet renders, and the features in the order they get events:
// the modules (turned on or off by `silverware.table.modules.<name>.enabled`)
// and those always there. The controller creates those turned on from this
// list and knows none of them.
import type { FeatureName } from "../../bridge.ts";
import type { AdapterFeature, Feature, TableHost } from "../../core/feature.ts";
import type { FeatureEntry, TableBinding } from "../../core/binding.ts";
import { markTable, renderedModel, SilverBulletAdapter } from "./adapter.ts";
import { tablesLayoutProvider } from "./layoutprovider.ts";
import { MarkdownStore, serializerOf } from "../../store/markdown/store.ts";
import { AutoFill } from "../../features/autofill.ts";
import { Autoscroll } from "./modules/autoscroll.ts";
import { ColumnTypes } from "../../features/columntypes.ts";
import { Conditions } from "../../features/conditions.ts";
import { Excel } from "../../features/excel.ts";
import { Pivot } from "../../features/pivot.ts";
import { Views } from "../../features/views.ts";
import { Export } from "../../features/export.ts";
import { Expressions } from "./modules/expressions.ts";
import { Filters } from "../../features/filters.ts";
import { Formulas } from "../../features/formulas.ts";
import { FullScreen } from "./modules/fullscreen.ts";
import { Grips } from "../../features/grips.ts";
import { History } from "./modules/history.ts";
import { BesideTables } from "./modules/beside.ts";
import { CustomMenus } from "../../features/custommenus.ts";
import { LargeTables } from "./modules/largetables.ts";
import { Lazy } from "../../features/lazy.ts";
import { LongText } from "./modules/longtext.ts";
import { Names } from "../../features/names.ts";
import { PageLinks } from "../../features/pagelinks.ts";
import { Paste } from "../../features/paste.ts";
import { CellPopup } from "./modules/popup.ts";
import { Selection } from "../../features/selection.ts";
import { Sheet } from "./modules/sheet.ts";
import { Sheets } from "../../features/sheets.ts";
import { Sources } from "../../features/sources.ts";
import type { SourceTables } from "../../sources.ts";
import { Sticky } from "./modules/sticky.ts";
import { TableLabels } from "./modules/labels.ts";
import { Themes } from "../../features/themes.ts";
import { Widths } from "../../features/widths.ts";


/**
 * The features in the order they get events; `metadata` is the controller's own (Remove metadata, also a page
 * command), `sources` what the host gives the sources module
 */
export function featureEntries(metadata: Feature, sources: SourceTables, store: MarkdownStore): readonly FeatureEntry[] {
  const optional = (name: FeatureName, create: (host: TableHost) => AdapterFeature): FeatureEntry => ({ name, create });
  const always = (create: (host: TableHost) => AdapterFeature): FeatureEntry => ({ name: undefined, create });
  return [
    // First: the header moves before what follows it
    optional("sticky", (host) => new Sticky(host)),
    // Before what takes presses: a press while picking where AutoFill to… fills to ends picking (or fills) first;
    // before the selection too: Esc while dragging the fill handle cancels the fill, the selection stays
    optional("autofill", (host) => new AutoFill(host)),
    optional("autoscroll", (host) => new Autoscroll(host)),
    optional("handles", (host) => new Grips(host)),
    optional("widths", (host) => new Widths(host)),
    optional("longText", (host) => new LongText(host)),
    // Before what places rows into the table: it takes them out of the document first
    optional("largeTables", (host) => new LargeTables(host)),
    // Recalculate first in the toolbar
    optional("formulas", (host) => new Formulas(host)),
    optional("pageLinks", (host) => new PageLinks(host)),
    optional("sources", (host) => new Sources(host, sources)),
    // After formulas: a pivot is calculated from its source as formulas left it
    optional("pivot", (host) => new Pivot(host)),
    // Views are calculated by the formulas, through what it offers
    optional("view", (host) => new Views(host)),
    // Before types: Filter right after the sorting in the column menu
    optional("filters", (host) => new Filters(host)),
    // After formulas: a formula's result is shown in its column's type
    optional("columnTypes", (host) => new ColumnTypes(host)),
    // After types: their values are what conditions compare (an offer); its looks over theirs
    optional("conditions", (host) => new Conditions(host)),
    optional("names", (host) => new Names(host)),
    always(() => metadata),
    optional("paste", (host) => new Paste(host)),
    optional("selection", (host) => new Selection(host)),
    optional("lazy", (host) => new Lazy(host)),
    optional("themes", (host) => new Themes(host)),
    optional("export", (host) => new Export(host)),
    optional("excel", (host) => new Excel(host)),
    optional("sheet", (host) => new Sheet(host, store)),
    // Its part in a table's menu: Add to sheet…, Remove from sheet
    optional("sheet", (host) => new Sheets(host)),
    // Its icon last in the toolbar, before the menu
    optional("fullScreen", (host) => new FullScreen(host)),
    // After what moves tables (the held header, the sheet): placed by where they are then
    optional("tableLabels", (host) => new TableLabels(host)),
    always((host) => new Expressions(host)),
    always((host) => new History(host)),
    always((host) => new BesideTables(host, store)),
    // Custom definitions' entries in a row's or a column's menu, after the modules'
    always((host) => new CustomMenus(host)),
    always((host) => new CellPopup(host)),
  ];
}

/** Silverware Table bound to SilverBullet: what the Space Lua API's `init` (api.ts) hands the controller */
export const silverBulletBinding: TableBinding<MarkdownStore> = {
  // The tables kept as markdown in pages, read through the platform as it is now (a new one comes with Space Lua loaded again)
  store: (context) => new MarkdownStore(context.platform, context.register, () => serializerOf(context.setting), context.beforeWrite),
  adapter: (doc, rows, context, store) => new SilverBulletAdapter(doc, rows, context, store),
  features: featureEntries,
  markRendered: (widget, rows, look) => markTable(widget, look(renderedModel(rows))),
  layoutProvider: tablesLayoutProvider,
};
