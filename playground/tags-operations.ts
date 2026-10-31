// The tags playground's custom operations, as a space's JS file would give
// them (silverware.tags.defineOperations): the library page's example
import type { HELPERS } from "../silverware-tags/src/custom.ts";

type Context = { readonly tag: string; contexts(tag: string): Readonly<Record<string, readonly string[]>> };

export default (helpers: typeof HELPERS) => [
  // The tag made lower case everywhere (merged with one of that name)
  {
    name: "lowerCase",
    label: "Lower case",
    when: (context: Context) => context.tag !== context.tag.toLowerCase(),
    edit: (text: string, _page: string, context: Context) => helpers.renameTags(text, (name) => (name === context.tag ? name.toLowerCase() : undefined)),
  },
  // The tag given to every page that uses it in a task, as a page's own tag
  {
    name: "promote",
    label: "Make it the page's",
    pages: (context: Context) => context.contexts(context.tag).task ?? [],
    edit: (text: string, _page: string, context: Context) => helpers.addPageTags(text, [context.tag]),
  },
];
