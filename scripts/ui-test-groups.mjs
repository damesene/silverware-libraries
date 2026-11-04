// The groups the interaction tests run in, a CI job each (integration-tests.yml),
// as JSON for its matrix: each plugin's (a folder with ui-tests/) specs in
// ui-tests/ itself one group, its name the plugin's; each folder under ui-tests/
// holding specs a group of its own (silverware-table/ui-tests/sheet/: the sheet
// view's), so a plugin parts an area of its tests by a folder, nothing else
// changed. Each group: `name` (the job's), `id` (its artifacts'), `filter` (the
// test files' paths, as Playwright takes a regular expression of them).
//   node scripts/ui-test-groups.mjs
import { readdirSync } from "node:fs";
import { join } from "node:path";

const specs = (folder) => readdirSync(folder).filter((file) => file.endsWith(".spec.ts"));
const groups = [];
for (const plugin of readdirSync(".", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const tests = join(plugin, "ui-tests");
  let entries;
  try {
    entries = readdirSync(tests, { withFileTypes: true });
  } catch {
    continue;
  }
  if (specs(tests).length) groups.push({ name: plugin, id: plugin, filter: `${plugin}/ui-tests/[^/]+\\.spec\\.ts$` });
  for (const area of entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    if (specs(join(tests, area)).length) groups.push({ name: `${plugin} ${area}`, id: `${plugin}-${area}`, filter: `${plugin}/ui-tests/${area}/` });
  }
}
console.log(JSON.stringify(groups));
