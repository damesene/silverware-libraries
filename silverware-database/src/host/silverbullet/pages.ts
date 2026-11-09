// What SilverBullet's index and space say of a page, in the platform's terms
// (shared/platform.ts): a page object's own keys, its dates, its tasks, what
// a page's name cannot be. The one place that knows SilverBullet's names for
// them; the store asks the platform.
import { isMetaTag } from "../../../../shared/pages/tags/names.ts";
import type { DocumentDates, IndexedObject, TaskCount } from "../../../../shared/platform.ts";

/** Keys SilverBullet's page objects have beside a page's frontmatter (probe 1, plugs/index/page.ts): none can be a property's */
export const PAGE_KEYS: ReadonlySet<string> = new Set(["name", "tags", "tag", "itags", "ref", "range", "aliases", "displayName", "lastModified", "created", "perm", "contentType", "size", "pageDecoration"]);

/** A page object's dates: when its file was made and last written (`created`, `lastModified`: local ISO text, client/space.ts) */
export function pageDates(object: IndexedObject): DocumentDates {
  const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  const created = text(object.created);
  const modified = text(object.lastModified);
  return { ...(created ? { created } : {}), ...(modified ? { modified } : {}) };
}

/** The tasks of the pages given, from SilverBullet's `task` objects (each its `page` and `done`, plugs/index/item.ts) */
export function tasksOfPages(objects: readonly IndexedObject[], pages: ReadonlySet<string>): Map<string, TaskCount> {
  const counts = new Map<string, { done: number; total: number }>();
  for (const task of objects) {
    const page = typeof task.page === "string" ? task.page : undefined;
    if (page === undefined || !pages.has(page)) continue;
    const count = counts.get(page) ?? { done: 0, total: 0 };
    count.total++;
    if (task.done === true) count.done++;
    counts.set(page, count);
  }
  return counts;
}

/** Why a name cannot be a page's (SilverBullet's `isValidName`): undefined where it can */
export function validatePageName(name: string): string | undefined {
  if (/[@#|<>$]/.test(name) || name.includes("[[") || name.includes("]]")) return `"${name}" holds a character a page's name cannot: @ # | < > $ [[ ]]`;
  if (/^[.^]/.test(name)) return `"${name}" starts with . or ^, which a page's name cannot`;
  if (/\.[A-Za-z0-9]+$/.test(name)) return `"${name}" ends as a file's extension would, which makes it no page`;
  return undefined;
}

/** The pages a reference may name, by name in order: the index's pages but meta ones (a library, CONFIG: a tag `meta` or under it) */
export function referablePages(objects: readonly IndexedObject[]): string[] {
  const pages = objects.filter((page) => typeof page.name === "string" && !(Array.isArray(page.tags) && page.tags.some((tag) => typeof tag === "string" && isMetaTag(tag))));
  return pages.map((page) => page.name as string).sort((a, b) => a.localeCompare(b));
}
