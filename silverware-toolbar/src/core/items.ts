// Kinds of favourites a module gives, beyond the core's own (an action, a
// separator): a module turned off, its kind is unknown and its favourites are
// left out. The core reads what every favourite has (`type`, `show`) and the
// kind's slots (fields holding an action's id, which the settings dialog
// fills from its search of actions, knowing nothing of what they are for);
// the kind draws its button in the toolbar and reads any other field it knows.
import type { Action } from "./action.ts";

/**
 * A slot of a kind of favourite: a field holding an action's id, and what it
 * is for, as the settings dialog names it; `optional`: it may hold none (the
 * dialog offers None), and one whose action is not there is left out alone
 */
export type ItemSlot = { readonly key: string; readonly label: string; readonly optional?: boolean };

/**
 * A field of a kind of favourite holding a text of the user's (a snippet's
 * icon, label, text), which the settings dialog edits knowing nothing of what
 * it is for; `multiline`: a text of several lines
 */
export type ItemField = { readonly key: string; readonly label: string; readonly placeholder?: string; readonly multiline?: boolean };

/** A favourite of a kind a module gives, as the toolbar shows it now: its kind, its slots' actions (every one needed found; an optional one's where it is), its look */
export type ShownItem = {
  readonly kind: ItemKind;
  readonly actions: Readonly<Record<string, Action>>;
  readonly labeled: boolean;
  // The favourite as configured, its fields the kind may read
  readonly item: Readonly<Record<string, unknown>>;
};

/** What the toolbar gives a kind to draw its button with */
export type ItemHost = {
  readonly doc: Document;
  // Docked at the bottom (a phone)
  readonly docked: boolean;
  readonly state: (action: Action) => { readonly active: boolean; readonly enabled: boolean };
  // An action run, or its choices opened (Turn into) by the element
  readonly activate: (action: Action, anchor: HTMLButtonElement) => void;
  // An action's content as a button of the toolbar has it: its icon, and its label where labeled
  readonly content: (action: Action, labeled: boolean) => HTMLElement;
  // A button of the toolbar, empty (its class, its type)
  readonly button: () => HTMLButtonElement;
};

export type ItemKind = {
  // Its favourites' `type`
  readonly type: string;
  // As the settings dialog offers it (Add) and names it, what it is beside it
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  // Every one not optional needed: a favourite without one of them, or with an id no action has, is left out
  readonly slots: readonly ItemSlot[];
  // Texts of the user's it holds besides (a kind reads what is not right in them itself)
  readonly fields?: readonly ItemField[];
  // What is wrong with an item, where it cannot show (a snippet without its text): left out, the settings say why
  readonly check?: (item: Readonly<Record<string, unknown>>) => string | undefined;
  // Its button in the toolbar
  readonly render: (shown: ShownItem, host: ItemHost) => HTMLButtonElement;
};
