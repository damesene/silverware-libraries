// URL: a web address (http, https) or a mail address (mailto); what a browser
// opens. Typed without its scheme (`www.example.com`), https is meant.
import { isEmpty } from "../../../model/database.ts";
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
  validate: (value) => (isEmpty(value) || (typeof value === "string" && isUrl(value)) ? undefined : "no web address (https://…)"),
  text: keptText,
  parse: (typed) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    const url = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
    return isUrl(url) ? { value: url } : { problem: `"${trimmed}" is no web address (https://…)` };
  },
};
