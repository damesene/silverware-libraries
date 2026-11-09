// A link as a value keeps it: an address alone (`https://silverbullet.md`), or
// with the text it shows as a markdown link (`[Docs](https://silverbullet.md)`),
// so a page read by hand or by a query has it as markdown has a link. Its
// address shown without what says nothing to a reader (the scheme, `www.`, a
// last `/`): the host, then the rest apart, to be shown quieter.

// Its text (a bracket or a backslash in it escaped), then its address
const MARKDOWN_LINK_RE = /^\[((?:\\.|[^\]\\])*)\]\((\S+)\)$/;

/** A link's address and its text (none: the address is shown), or undefined where it is empty */
export function readLink(value: string): { readonly url: string; readonly text?: string } | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const m = MARKDOWN_LINK_RE.exec(trimmed);
  // (An address alone, whatever it holds: the type says whether it is one)
  if (!m) return { url: trimmed };
  const text = m[1]!.replace(/\\(.)/g, "$1").trim();
  return text ? { url: m[2]!, text } : { url: m[2]! };
}

/** A link as kept: its address alone where it has no text, else as a markdown link, a bracket or a backslash in its text escaped */
export function writeLink(url: string, text?: string): string {
  const shown = text?.trim();
  return shown ? `[${shown.replace(/[\\[\]]/g, "\\$&")}](${url.trim()})` : url.trim();
}

// An address without its scheme: a host with a dot (`google.com`, `www.google.com/maps`), a mail address (`me@x.dev`)
const BARE_HOST_RE = /^[^\s/@:]+\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;
const BARE_MAIL_RE = /^[^\s/@:]+@[^\s/@:]+\.[a-z]{2,}$/i;

/** An address as a browser opens it: one written without its scheme a web one (https), a mail address mailto; else as it is */
export function fullAddress(url: string): string {
  const trimmed = url.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (BARE_MAIL_RE.test(trimmed)) return `mailto:${trimmed}`;
  return BARE_HOST_RE.test(trimmed) ? `https://${trimmed}` : trimmed;
}

/** Whether an address is one a link may open: a web or a mail address, never a script or data */
export function isOpenable(url: string): boolean {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** An address as read: its host without `www.`, the rest (a path, a query) without a last `/`; a mail address its address */
export function prettyUrl(url: string): { readonly host: string; readonly rest: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "mailto:") return { host: parsed.pathname, rest: "" };
    const rest = `${parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")}${parsed.search}${parsed.hash}`;
    return { host: parsed.host.replace(/^www\./i, ""), rest };
  } catch {
    return { host: url, rest: "" };
  }
}
