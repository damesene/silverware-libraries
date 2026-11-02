// What a menu holds (its entries, a detail, a submenu's way back, its naming),
// as the modules give it: data, made into a menu by the core (core/menu.ts,
// TableHost.floatingMenu). The plugins share them (shared/menu.ts).
export { type MenuBack, type MenuDetail, type MenuEntry, type MenuNaming, namingThatCloses, wrapRuns } from "../../shared/menu.ts";
