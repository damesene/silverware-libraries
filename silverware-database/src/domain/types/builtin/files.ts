// Files & media (docs/silverware-database-files.md): files of the space and of the web, several in one value, each a
// wiki link or an address in a list (domain/types/files.ts), so the space keeps them as links: listed on the files
// they name, renamed with them. Shown as their previews, edited in a popup of its own; filtered and sorted by their
// names, joined by ", "; never grouped by (a list of files is no group).
import { isEmpty } from "../../../model/database.ts";
import { fileName, readFiles, typedFiles } from "../files.ts";
import { keptText, type PropertyType } from "../type.ts";

export const files: PropertyType = {
  name: "files",
  label: "Files & media",
  editor: "files",
  look: "media",
  lists: true,
  groups: false,
  validate: (value) => {
    if (isEmpty(value)) return undefined;
    const read = readFiles(value);
    if (!read) return "no list of files ([[folder/name.png]] or an address of the web)";
    return new Set(read.map((one) => one.target)).size === read.length ? undefined : "one named twice";
  },
  text: (value) => readFiles(value)?.map(fileName).join(", ") ?? keptText(value),
  parse: (typed) => {
    const read = typedFiles(typed);
    if ("problem" in read) return read;
    return { value: read.written.length ? [...read.written] : null };
  },
};
