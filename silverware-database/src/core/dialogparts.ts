// What the core's dialogs share of how they are put together.

/** A dialog's buttons as its foot takes them: the shared dialog puts them in its own foot (a foot of their own drew a second line in it) */
export function buttons(doc: Document, ...elements: readonly HTMLElement[]): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  fragment.append(...elements);
  return fragment;
}
