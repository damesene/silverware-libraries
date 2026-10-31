// Silverware Tags' own elements (its dialogs, their lists and fields) made in
// one expression: a tag, its class, text or markup, attributes, listeners and
// children, as Silverware Table's elements.ts makes its own (bundled into each
// plugin apart: nothing is shared at run time).

/** What an element gets; a string in its place is its class */
export type ElementProps = {
  readonly class?: string;
  readonly text?: string;
  // Silverware Tags' own markup only (its icons), never a page's text
  readonly html?: string;
  readonly title?: string;
  // Attributes as written (aria-*, role, data-*); one undefined is left out
  readonly attrs?: Readonly<Record<string, string | number | undefined>>;
  readonly on?: { readonly [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
  // A click, its default prevented
  readonly run?: () => void;
};

/** A child to append: an element or a text; nothing for null, undefined or false */
export type ElementChild = Node | string | null | undefined | false;

/** An element of the document; a button is of type button (no form to submit) */
export function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, props?: ElementProps | string, ...children: readonly ElementChild[]): HTMLElementTagNameMap[K] {
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
