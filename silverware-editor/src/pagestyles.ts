// The page's rules an embed drawn in the editor needs (shared/editor.ts `EditorEmbed`): the editor is drawn in a shadow
// root of its own, so that SilverBullet's rules for its editor do not reach it (CLAUDE.md, *Verified*), and so do the
// rules of what a plugin draws there. The rules naming the prefixes of the classes and data attributes drawn (`swa-` of
// `swa-frame`, of `data-swa-view`) are put in the root, the editor's own (`swe-`, `cm-`) left out; again as an embed
// draws one of another prefix, or the page's style sheets change.

// Prefixes never taken from the page: the editor's own, CodeMirror's
const OWN = new Set(["swe-", "cm-"]);
// A class's prefix, a data attribute's
const CLASS_PREFIX = /^([a-z]+-)/;
const DATA_PREFIX = /^data-([a-z]+-)/;

/** What the page's rules are put into a root by: the prefixes taken, what was put */
type RootStyles = { readonly prefixes: Set<string>; readonly style: HTMLStyleElement; signature: string };
const roots = new WeakMap<ShadowRoot, RootStyles>();

/** The prefixes of the classes and data attributes in an element and those under it */
export function prefixesIn(element: Element): Set<string> {
  const found = new Set<string>();
  for (const one of [element, ...element.querySelectorAll("*")]) {
    for (const name of one.classList) {
      const prefix = CLASS_PREFIX.exec(name)?.[1];
      if (prefix && !OWN.has(prefix)) found.add(prefix);
    }
    for (const attribute of one.getAttributeNames()) {
      const prefix = DATA_PREFIX.exec(attribute)?.[1];
      if (prefix && !OWN.has(prefix)) found.add(prefix);
    }
  }
  return found;
}

/** The text of a rule list's rules naming one of the prefixes (a group, `@media`, kept round those of it that do) */
export function rulesNaming(rules: CSSRuleList | readonly CSSRule[], prefixes: ReadonlySet<string>): string[] {
  const names = (text: string) => [...prefixes].some((prefix) => text.includes(prefix));
  const kept: string[] = [];
  for (const rule of Array.from(rules)) {
    const style = rule as Partial<CSSStyleRule> & Partial<CSSGroupingRule> & { name?: string };
    if (typeof style.selectorText === "string") {
      // (A rule with rules nested in it, `.x { & .swa-frame {…} }`: kept whole where one of them names a prefix)
      if (names(style.selectorText) || (style.cssRules?.length && rulesNaming(style.cssRules, prefixes).length)) kept.push(rule.cssText);
    } else if (style.cssRules && rule.cssText.includes("{")) {
      const inner = rulesNaming(style.cssRules, prefixes);
      if (inner.length) kept.push(`${rule.cssText.slice(0, rule.cssText.indexOf("{"))}{\n${inner.join("\n")}\n}`);
    } else if (typeof style.name === "string" && names(style.name)) kept.push(rule.cssText);
  }
  return kept;
}

/** The page's style sheets' rules, each sheet's (one of another origin, whose rules cannot be read, left out) */
function pageRules(doc: Document): CSSRule[] {
  const all: CSSRule[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      all.push(...Array.from(sheet.cssRules));
    } catch {
      // (Its rules not readable: none of ours)
    }
  }
  return all;
}

/** What tells the page's style sheets changed: their count, each one's rules and its text's length (a `<style>`'s: a style page edited) */
function signatureOf(doc: Document): string {
  return Array.from(doc.styleSheets)
    .map((sheet) => {
      try {
        return `${sheet.cssRules.length}:${sheet.ownerNode?.textContent?.length ?? 0}`;
      } catch {
        return "0";
      }
    })
    .join(",");
}

/**
 * The page's rules for what is drawn in `element` put into the shadow root it is in, kept as it is drawn further (its
 * content put in later: a preview drawn once read) until the signal ends. Outside a shadow root: nothing (the page's
 * rules reach it)
 */
export function keepPageStyles(element: HTMLElement, signal: AbortSignal): void {
  const update = () => {
    const root = element.getRootNode();
    const doc = element.ownerDocument;
    const Shadow = doc.defaultView?.ShadowRoot;
    if (!Shadow || !(root instanceof Shadow)) return;
    const shadow = root;
    let styles = roots.get(shadow);
    if (!styles) {
      const style = doc.createElement("style");
      style.setAttribute("data-swe-page-styles", "");
      shadow.append(style);
      styles = { prefixes: new Set(), style, signature: "" };
      roots.set(shadow, styles);
    }
    const before = styles.prefixes.size;
    for (const prefix of prefixesIn(element)) styles.prefixes.add(prefix);
    const signature = signatureOf(doc);
    if (styles.prefixes.size === before && styles.signature === signature) return;
    styles.signature = signature;
    styles.style.textContent = rulesNaming(pageRules(doc), styles.prefixes).join("\n");
  };
  // (Its element put into the editor's root after it is made: looked at again then)
  update();
  queueMicrotask(() => !signal.aborted && update());
  const win = element.ownerDocument.defaultView;
  if (!win?.MutationObserver) return;
  const observer = new win.MutationObserver(update);
  observer.observe(element, { childList: true, subtree: true, attributes: true });
  signal.addEventListener("abort", () => observer.disconnect());
}
