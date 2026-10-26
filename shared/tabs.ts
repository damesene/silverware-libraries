// Tabs over panels, for any of the plugins: a bar of buttons (`${base}-tabs`,
// each `${base}-tab` with `aria-selected` and `data-<prefix>-tab`) and the
// panels (`${base}-panel`, `data-<prefix>-panel`), all hidden but the one
// picked, the first at the start. The caller puts the bar and the panels where
// it wants them (a dialog's bar and body).

export type Tab = {
  readonly id: string;
  readonly title: string;
  readonly panel: HTMLElement;
};

export type Tabs = {
  readonly bar: HTMLElement;
  readonly panels: readonly HTMLElement[];
  // The tab picked, as a click picks it
  select(id: string): void;
};

export function tabs(doc: Document, base: string, prefix: string, list: readonly Tab[]): Tabs {
  const bar = doc.createElement("div");
  bar.className = `${base}-tabs`;
  bar.setAttribute("role", "tablist");
  const buttons = list.map((tab) => {
    const button = doc.createElement("button");
    button.className = `${base}-tab`;
    button.type = "button";
    button.textContent = tab.title;
    button.setAttribute("role", "tab");
    button.setAttribute(`data-${prefix}-tab`, tab.id);
    tab.panel.classList.add(`${base}-panel`);
    tab.panel.setAttribute("role", "tabpanel");
    tab.panel.setAttribute(`data-${prefix}-panel`, tab.id);
    button.addEventListener("click", () => select(tab.id));
    bar.append(button);
    return button;
  });
  const select = (id: string) => {
    const at = list.findIndex((tab) => tab.id === id);
    if (at < 0) return;
    buttons.forEach((button, i) => button.setAttribute("aria-selected", String(i === at)));
    list.forEach((tab, i) => (tab.panel.hidden = i !== at));
    // (The bar scrolled sideways where it is wider than its box: the tab picked wholly in it)
    buttons[at]!.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  buttons.forEach((button, i) => button.setAttribute("aria-selected", String(i === 0)));
  list.forEach((tab, i) => (tab.panel.hidden = i !== 0));
  return { bar, panels: list.map((tab) => tab.panel), select };
}
