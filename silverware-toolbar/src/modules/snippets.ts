// The snippets module: a kind of favourite, the text snippet
// (`{ type = "snippet", icon = "📌", label = "Comment", text = "%%{s}%%", show }`):
// a button showing a character of the user's (an emoji too) that writes its
// text at the cursor. Its icon and label are an item's own (`ownLook`, set in
// the item's panel as an action's are); its text its field. `{s}` in the text
// stands for the text selected (none: the selection is replaced), `{c}` for
// where the cursor goes; without `{c}`,
// what `{s}` wrote stays selected (nothing selected: the cursor there), and
// without either the cursor goes to the text's end. `{{s}}` and `{{c}}` write
// `{s}` and `{c}` as they are. Its text is the kind's field (`fields`), which
// the settings dialog edits knowing nothing of what it is for.
import type { Action, Change, Context, ToolbarModule } from "../core/action.ts";
import { cursor } from "../core/cursor.ts";
import { iconOf } from "../core/favorites.ts";
import type { ItemHost, ItemKind, ShownItem } from "../core/items.ts";
import { ICONS } from "../icons.ts";

export function snippetsModule(): ToolbarModule {
  return { actions: () => [], itemKinds: () => [SNIPPET] };
}

const SNIPPET: ItemKind = {
  type: "snippet",
  label: "Text snippet",
  description: "Your text written at the cursor",
  icon: ICONS.snippet,
  slots: [],
  fields: [{ key: "text", label: "Text", placeholder: "Written at the cursor: %%{s}%% ({s} the text selected, {c} the cursor)", multiline: true }],
  ownLook: true,
  check: (item) => (typeof item.text === "string" && item.text ? undefined : "No text yet"),
  render,
};

// The placeholders and their escapes, as the text has them
const TOKENS = /\{\{[sc]\}\}|\{[sc]\}/g;

/**
 * The change a snippet's text makes of the selection: `{s}` the text
 * selected, `{c}` the cursor; the first `{c}` places the cursor, else the
 * first `{s}` is what is selected after it, else the cursor goes to its end
 */
export function snippetChange(text: string, context: Context): Change {
  const selected = context.text.slice(context.from, context.to);
  // The placeholders as they are, not their escapes
  const tokens = [...text.matchAll(TOKENS)].map((m) => m[0]);
  const caret = tokens.includes("{c}") ? "c" : tokens.includes("{s}") ? "s" : undefined;
  let marked = false;
  const insert = text.replace(TOKENS, (token) => {
    if (token === "{{s}}") return "{s}";
    if (token === "{{c}}") return "{c}";
    if (token === "{c}") {
      if (marked || caret !== "c") return "";
      marked = true;
      return cursor();
    }
    if (!marked && caret === "s") {
      marked = true;
      return cursor(selected);
    }
    return selected;
  });
  return { from: context.from, to: context.to, insert: caret ? insert : insert + cursor() };
}

/** A text as HTML, its characters as they are */
function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(shown: ShownItem, host: ItemHost): HTMLButtonElement {
  const { icon, label } = shown.item;
  // (Its text there: `check`)
  const text = shown.item.text as string;
  const glyph = (typeof icon === "string" && iconOf(icon)) || "✎";
  const name = typeof label === "string" && label.trim() ? label.trim() : text;
  const action: Action = {
    id: "snippets.item",
    label: name,
    // Its character as the icon a toolbar's button shows
    icon: `<span class="swb-glyph">${escaped(glyph)}</span>`,
    group: "Snippets",
    edit: (context) => snippetChange(text, context),
  };
  const button = host.button();
  button.classList.add("swb-snippet");
  if (shown.labeled) button.classList.add("swb-labeled");
  button.append(host.content(action, shown.labeled));
  button.title = name;
  button.setAttribute("aria-label", name);
  button.addEventListener("click", (e) => {
    e.preventDefault();
    host.activate(action, button);
  });
  return button;
}
