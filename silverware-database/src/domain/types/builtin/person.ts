// Person: one of the people the property lists (`params.options`), or some of
// them with Multiple (decided with the user 2026-11-09): a select of people,
// each shown as SilverBullet writes a mention (`@ada`) and kept by the name
// alone (`owner: ada`, `owner: [ada, bob]`: `@` cannot start a value YAML
// reads bare). Anyone (`anyone: true`) takes a name none of the options too,
// the list then only offered; else such a name is kept and shown invalid.
import { choiceType } from "../choices.ts";

export const person = choiceType({
  name: "person",
  label: "Person",
  icons: { several: "person-multiple" },
  shown: (name) => `@${name}`,
  mentions: true,
  // (Typed or pasted as shown: `@ada` is ada)
  read: (typed) => typed.replace(/^@/, ""),
  validateOption: (name) => (name.startsWith("@") ? "write the name without @ (it shows with it)" : undefined),
  anyone: { param: "anyone", label: "Anyone", hint: "A name none of the options is valid too; off: shown invalid" },
});
