// URL: a web address (http, https) or a mail address (mailto); what a browser
// opens. Typed without its scheme (`google.com`, `www.example.com/docs`),
// https is meant and kept with it; a mail address (`me@x.dev`) mailto. One
// written without it by hand reads and opens so too. A link
// may have a text of its own, shown in its place: kept as a markdown link
// (`[Docs](https://silverbullet.md)`, domain/types/link.ts).
import { isEmpty } from "../../../model/database.ts";
import { fullAddress, readLink, writeLink } from "../link.ts";
import { keptText, type PropertyType } from "../type.ts";

/** Whether a text is an address this type opens */
function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    if (url.protocol === "mailto:") return url.pathname !== "";
    return (url.protocol === "http:" || url.protocol === "https:") && url.host !== "" && /^https?:\/\//i.test(text);
  } catch {
    return false;
  }
}


export const url: PropertyType = {
  name: "url",
  label: "URL",
  editor: "link",
  look: "link",
  validate: (value) => {
    if (isEmpty(value)) return undefined;
    const link = typeof value === "string" ? readLink(value) : undefined;
    return link && isUrl(fullAddress(link.url)) ? undefined : "no web address (google.com, https://…)";
  },
  // (Its text where it has one, else its address: what is filtered and sorted; a value that is no link of it as kept)
  text: (value) => {
    const link = typeof value === "string" ? readLink(value) : undefined;
    return link && isUrl(fullAddress(link.url)) ? (link.text ?? link.url) : keptText(value);
  },
  parse: (typed) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    const link = readLink(trimmed);
    const address = link && fullAddress(link.url);
    return link && address && isUrl(address) ? { value: writeLink(address, link.text) } : { problem: `"${trimmed}" is no web address (google.com, https://…)` };
  },
};
