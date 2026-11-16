// HTML from outside the code made safe before it is shown in the page: a document's drawing (Silverware Assets DOCX), a
// preview kept in the space (docs/silverware-assets-stored-previews.md), which anyone who can write the space can write.
// Nothing that runs is kept: no element that runs, loads a document of its own or animates an attribute (an SVG
// animation can set a link's address after it was checked), no `on…` attribute, no value that is a script's URL, nothing
// loaded from elsewhere by its styles (a style sheet imported, a URL that is not data); a link the web's or mail's
// alone, opened in a new tab. Style sheets kept only where asked (a document shown in a shadow root of its own): in
// the page's own tree a style sheet would restyle all of it.

// What a link may open
const SAFE_LINK = /^(https?:|mailto:)/i;
// Elements that run, load a document of their own, send a form, change how the page reads its URLs, or animate an
// attribute (SVG's)
const UNSAFE = "script, iframe, object, embed, frame, frameset, base, meta, link, form, noscript, template, portal, animate, set, animateMotion, animateTransform, discard";
// A value that is a script's URL (spaces and control characters, which a browser skips, taken out first)
const SCRIPT_URL = /^(javascript|vbscript):/i;
// Attributes that hold a document of their own
const DOCUMENT_ATTRIBUTES = new Set(["srcdoc"]);
// A URL in a style that is not data (loaded from elsewhere: what was shown told to another server)
const OUTSIDE_URL = /url\(\s*(['"]?)(?!\s*data:)[^)]*\)/gi;

/** What may stay: style sheets (none: taken out, the drawing shown in the page's own tree) */
export type SafeOptions = { readonly styleSheets?: boolean };

/** A style's text with nothing brought in from elsewhere */
const ownStyle = (text: string) => text.replace(/@import[^;]*;?/gi, "").replace(OUTSIDE_URL, "none");

/** A drawn document made safe, in place: nothing that runs, its links the web's and mail's alone (opened in a new tab) */
export function madeSafe(root: ParentNode, options: SafeOptions = { styleSheets: true }): void {
  for (const element of root.querySelectorAll(UNSAFE)) element.remove();
  if (!options.styleSheets) for (const style of root.querySelectorAll("style")) style.remove();
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    for (const attribute of [...element.attributes]) {
      const value = attribute.value.replace(/[\s\u0000-\u001f]+/g, "");
      if (/^on/i.test(attribute.name) || DOCUMENT_ATTRIBUTES.has(attribute.name.toLowerCase()) || SCRIPT_URL.test(value)) element.removeAttribute(attribute.name);
      else if (attribute.name.toLowerCase() === "style" && OUTSIDE_URL.test(attribute.value)) element.setAttribute("style", ownStyle(attribute.value));
      OUTSIDE_URL.lastIndex = 0;
    }
  }
  for (const style of root.querySelectorAll("style")) style.textContent = ownStyle(style.textContent ?? "");
  // (An HTML link's and an SVG one's, `href` or `xlink:href`; an SVG link's target set as an attribute, its property read-only)
  for (const link of root.querySelectorAll<Element>("a[href], a[*|href]")) {
    const hrefs = link.getAttributeNames().filter((name) => name === "href" || name.endsWith(":href"));
    const safe = hrefs.every((name) => SAFE_LINK.test((link.getAttribute(name) ?? "").trim()));
    if (!safe) {
      for (const name of hrefs) link.removeAttribute(name);
      continue;
    }
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }
}

/** HTML as text made into the document's nodes, safe: read where nothing runs and nothing loads, made safe, then taken in */
export function safeHtml(doc: Document, html: string, options?: SafeOptions): DocumentFragment {
  const Parser = doc.defaultView?.DOMParser ?? DOMParser;
  const parsed = new Parser().parseFromString(`<!doctype html><body>${html}`, "text/html");
  madeSafe(parsed.body, options);
  const fragment = doc.createDocumentFragment();
  for (const node of [...parsed.body.childNodes]) fragment.append(doc.importNode(node, true));
  return fragment;
}
