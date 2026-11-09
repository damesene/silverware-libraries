// A plugin's own elements (menus, toolbars, dialogs, panels) made in one
// expression: a tag, its class, text or markup, attributes, listeners and
// children. Synchronous, as the code making them measures and places them at
// once. Not for SilverBullet's DOM, which the plugins only decorate. Bundled
// into each plugin apart: nothing is shared at run time.

/** What an element gets; a string in its place is its class */
export type ElementProps = {
  readonly class?: string;
  readonly text?: string;
  // The plugin's own markup only (its icons), never text of a page
  readonly html?: string;
  readonly title?: string;
  // Attributes as written (aria-*, role, data-*, id, tabindex, hidden: ""); one undefined is left out
  readonly attrs?: Readonly<Record<string, string | number | undefined>>;
  readonly on?: { readonly [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
  // A click, its default prevented (a button's: a press in a menu changes nothing else)
  readonly run?: () => void;
};

/** A child to append: an element or a text; nothing for null, undefined or false */
export type ElementChild = Node | string | null | undefined | false;

/** aria-pressed or aria-checked of a state: "true" or "false", none where it has none */
export const pressed = (state: boolean | undefined): string | undefined => (state === undefined ? undefined : String(state));

/** An element of the document; a button is of type button (no form to submit) */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props?: ElementProps | string,
  ...children: readonly ElementChild[]
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (tag === "button") (e as HTMLButtonElement).type = "button";
  const p: ElementProps = typeof props === "string" ? { class: props } : (props ?? {});
  if (p.class) e.className = p.class;
  if (p.html !== undefined) e.innerHTML = p.html;
  if (p.text !== undefined) e.textContent = p.text;
  if (p.title !== undefined) e.title = p.title;
  for (const [name, value] of Object.entries(p.attrs ?? {})) if (value !== undefined) e.setAttribute(name, String(value));
  for (const [type, listener] of Object.entries(p.on ?? {})) e.addEventListener(type, listener as EventListener);
  const run = p.run;
  if (run)
    e.addEventListener("click", (event) => {
      event.preventDefault();
      run();
    });
  for (const child of children) if (child !== null && child !== undefined && child !== false) e.append(child);
  return e;
}

/**
 * A link to a page opened by the plugin itself on a plain click (`open`: the editor's own way, as a page's link), a
 * middle click, Ctrl, Shift or Alt left to the browser (a tab or window of its own, its address the link's)
 */
export function openedHere(link: HTMLAnchorElement, open: () => void): HTMLAnchorElement {
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open();
  });
  return link;
}
