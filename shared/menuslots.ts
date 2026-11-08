// Entries put into a menu by what they do, never by where: a plugin names the
// slots of one of its menus (a table's row menu: clipboard, edit, insert…; a
// database's: view, data, source…) and decides where each shows; whoever adds
// entries (a module, a view, a definition of the user's) is given a builder
// for that menu as it opens, and gives back groups, each in a slot or in a
// section of its own (`custom`: by its name, its position and priority).
// Generic: no slot named here, no plugin's names. Bundled into each plugin
// apart, and of no state of its own (a builder is made for a menu, its groups
// asked as that menu opens): nothing one plugin adds can reach another's menus.
import { type MenuEntry, menuActions, menuItem, menuSegmented, menuSeparator } from "./menu.ts";

/**
 * A section of its own in a menu, by its name: the blocks of one name are one
 * section, by `priority` (lower higher; equal: as they came), the sections as
 * their names first came; `position`, what its actions are among the menu's:
 * primary (often used, near the top) or secondary (the others', the default)
 */
export type MenuSection = { readonly name: string; readonly position?: "primary" | "secondary"; readonly priority?: number };

/** Entries in a slot of a menu, or in a section of their own */
export type MenuGroup<S extends string> =
  | { readonly slot: S; readonly entries: readonly MenuEntry[] }
  | { readonly slot: "custom"; readonly custom: MenuSection; readonly entries: readonly MenuEntry[] };

/** A group made for each slot of a menu by its name, and a section of its own (`custom`) */
export type MenuSlots<S extends string> = { readonly [K in S]: (entries: readonly MenuEntry[]) => MenuGroup<S> } & {
  readonly custom: (section: MenuSection, entries: readonly MenuEntry[]) => MenuGroup<S>;
};

type EntryOf<K extends MenuEntry["kind"]> = Omit<Extract<MenuEntry, { readonly kind: K }>, "kind">;

/**
 * What a menu gives those adding entries to it: its slots, the entries (values,
 * as the menu shows them), a submenu in the menu's place. Given, not imported,
 * so a definition outside the plugin's bundle can use it too
 */
export type MenuBuilder<S extends string, Slots extends MenuSlots<S> = MenuSlots<S>> = {
  readonly slot: Slots;
  readonly item: (item: EntryOf<"item">) => MenuEntry;
  /** An item showing `entries` in the menu's place (titled by its label, a way back), made as it is chosen */
  readonly submenu: (item: Omit<EntryOf<"item">, "run" | "submenu">, entries: () => readonly MenuEntry[]) => MenuEntry;
  readonly segmented: (row: EntryOf<"segmented">) => MenuEntry;
  readonly actions: (bar: EntryOf<"actions">) => MenuEntry;
  readonly separator: () => MenuEntry;
  /** Shows `entries` in the menu's place, titled `title` (a list a row's button opens) */
  readonly open: (title: string, entries: readonly MenuEntry[]) => void;
};

/** A menu's builder, its slots those named; `open` shows entries in the menu's place */
export function menuBuilder<S extends string>(slots: readonly S[], open: (title: string, entries: readonly MenuEntry[]) => void): MenuBuilder<S> {
  const made = Object.fromEntries(slots.map((name) => [name, (entries: readonly MenuEntry[]): MenuGroup<S> => ({ slot: name, entries })]));
  return {
    slot: { ...made, custom: (custom: MenuSection, entries: readonly MenuEntry[]): MenuGroup<S> => ({ slot: "custom", custom, entries }) } as MenuSlots<S>,
    item: menuItem,
    submenu: (item, entries) => menuItem({ ...item, submenu: true, run: () => open(item.label, entries()) }),
    segmented: menuSegmented,
    actions: menuActions,
    separator: menuSeparator,
    open,
  };
}

type CustomGroup = Extract<MenuGroup<string>, { readonly custom: MenuSection }>;

/** Whether a group is a section of its own (told by its section, whatever the slots are called) */
const isCustom = (group: MenuGroup<string>): group is CustomGroup => "custom" in group;

/** The entries groups put in one slot, in the groups' order */
export function slotEntries<S extends string>(groups: readonly MenuGroup<S>[], slot: S): MenuEntry[] {
  return groups.flatMap((group) => (!isCustom(group) && group.slot === slot ? group.entries : []));
}

/**
 * The sections of their own (`custom`) of a position (primary, secondary),
 * each its entries: one per name, as the names first came; a section's
 * blocks by priority (lower first; equal: as they came)
 */
export function customSections<S extends string>(groups: readonly MenuGroup<S>[], position: "primary" | "secondary"): MenuEntry[][] {
  const blocks = groups.flatMap((group) => (isCustom(group) && (group.custom.position ?? "secondary") === position ? [group] : []));
  const names = [...new Set(blocks.map((block) => block.custom.name))];
  return names
    .map((name) =>
      blocks
        .filter((block) => block.custom.name === name)
        // (A stable sort)
        .sort((a, b) => (a.custom.priority ?? 0) - (b.custom.priority ?? 0))
        .flatMap((block) => block.entries),
    )
    .filter((entries) => entries.length > 0);
}
