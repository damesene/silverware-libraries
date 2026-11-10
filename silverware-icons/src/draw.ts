// Icons as markup (docs/silverware-icons.md, *The API other plugins get*): the plugins draw their icons as markup, so
// an icon is markup too. Text (an emoji, "H1") is itself; an icon of a set its SVG where its set is loaded, else a
// placeholder of its size, which this file fills once the set is in: one pass over the page as a set loads (or a
// user's set is defined), and while a set loads a watch of what is added to the page (markup made before the set
// was in, inserted after the pass), ended LINGER_MS after the last load. A plugin knows nothing of loading.
import { iconLabelOf, referenceOf } from "../../shared/icons.ts";
import type { Registry } from "./registry.ts";
import { ALLOWED_ATTRIBUTES, ALLOWED_ELEMENTS, type IconNode } from "./set.ts";

const STATE = "data-swi-state";
const ICON = "data-swi-icon";
// Markup made while a set loaded may reach the page a moment after it is in (a toolbar built, then shown)
const LINGER_MS = 1000;
const BASE_RE = /^[a-z][a-z0-9-]*$/;

export class Drawing {
  private watch: MutationObserver | undefined;
  private lingering = 0;

  constructor(
    private readonly registry: Registry,
    private readonly doc: () => Document | undefined,
  ) {}

  /** A value's markup in `<base>-icon` (an emoji as text; a set's icon its SVG, a placeholder or a stand-in) */
  markup(value: string, base: string): string {
    const box = BASE_RE.test(base) ? `${base}-icon swi-icon` : "swi-icon";
    const reference = referenceOf(value);
    if (!reference) return `<span class="${box}">${escape(value)}</span>`;
    const found = this.registry.find(reference);
    const at = `${ICON}="${escape(value)}"`;
    if ("nodes" in found) return `<span class="${box}" ${at} ${STATE}="drawn">${svgOf(found.nodes)}</span>`;
    if ("loading" in found) return `<span class="${box}" ${at} ${STATE}="pending"></span>`;
    return `<span class="${box} swi-missing" ${at} ${STATE}="missing" title="${escape(found.missing)}"></span>`;
  }

  /** A value as text: itself, an icon its label (its set's, else made of its name) */
  text(value: string): string {
    const reference = referenceOf(value);
    if (!reference) return value;
    const own = this.registry.search(reference.set)?.icons.find((icon) => icon[0] === reference.name);
    return own?.[1] ?? iconLabelOf(reference.name);
  }

  /** Every icon of a set in `root` drawn as it is now (a set loaded, a user's defined, replaced) */
  fill(root: ParentNode | undefined = this.doc()): void {
    if (!root) return;
    for (const element of root.querySelectorAll<HTMLElement>(`[${ICON}]`)) this.redraw(element);
  }

  /** While a set loads: what is added to the page with placeholders filled as soon as their set is in */
  loading(on: boolean): void {
    const doc = this.doc();
    const win = doc?.defaultView;
    if (!doc?.body || !win?.MutationObserver) return;
    if (on) {
      win.clearTimeout(this.lingering);
      this.watch ??= new win.MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            const element = node as Element;
            if (element.matches(`[${STATE}="pending"]`)) this.redraw(element as HTMLElement);
            for (const one of element.querySelectorAll<HTMLElement>(`[${STATE}="pending"]`)) this.redraw(one);
          }
      });
      this.watch.observe(doc.body, { childList: true, subtree: true });
    } else {
      win.clearTimeout(this.lingering);
      this.lingering = win.setTimeout(() => {
        this.watch?.disconnect();
        this.watch = undefined;
      }, LINGER_MS);
    }
  }

  /** An icon's element drawn anew from its value, its classes and place kept */
  private redraw(element: HTMLElement): void {
    const value = element.getAttribute(ICON) ?? "";
    const reference = referenceOf(value);
    if (!reference) return;
    const found = this.registry.find(reference);
    const state = "nodes" in found ? "drawn" : "loading" in found ? "pending" : "missing";
    if (state === "pending" && element.getAttribute(STATE) === "pending") return;
    element.setAttribute(STATE, state);
    element.classList.toggle("swi-missing", state === "missing");
    if ("missing" in found) element.title = found.missing;
    else element.removeAttribute("title");
    element.innerHTML = "nodes" in found ? svgOf(found.nodes) : "";
  }
}

/** An icon's SVG: 24×24, stroked in the text's color, its nodes of the elements and attributes allowed only */
export function svgOf(nodes: readonly IconNode[]): string {
  const body = nodes
    .map((node) => {
      const [tag, attrs] = typeof node === "string" ? ["path", { d: node }] : node;
      if (!ALLOWED_ELEMENTS.has(tag)) return "";
      const own = Object.entries(attrs)
        .filter(([key]) => ALLOWED_ATTRIBUTES.has(key))
        .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
        .join("");
      return `<${tag}${own}/>`;
    })
    .join("");
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
