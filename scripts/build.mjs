// Bundles each library's src/index.ts into the .js file next to its library page.
// --check builds in memory and fails when a committed bundle differs from its sources, or a style page's shared block
// from its template (scripts/sharedstyles.mjs).
import * as esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { emojiModuleText } from "./icons/emoji.mjs";
import { iconFiles } from "./icons/index.mjs";
import { sharedStyles } from "./sharedstyles.mjs";

const libraries = ["silverware-table", "silverware-toolbar", "silverware-tags", "silverware-chart", "silverware-database"];
// Files bundled beside a library's, loaded by it when needed: Chart.js beside the chart's (src/chartjs.ts)
const beside = [{ entry: "silverware-chart/src/chartjs.ts", outfile: "silverware-chart/silverware-chart-chartjs.js" }];
const watch = process.argv.includes("--watch");
const check = process.argv.includes("--check");

let stale = 0;
for (const { entry, outfile, name } of [...libraries.map((name) => ({ entry: `${name}/src/index.ts`, outfile: `${name}/${name}.js`, name })), ...beside.map((file) => ({ ...file, name: file.entry }))]) {
  const options = {
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    target: "es2022",
    // SilverBullet downloads the bundle as committed: as small as it can be (the playground and tests use src/)
    minify: true,
    legalComments: "inline",
    logLevel: check ? "warning" : "info",
  };
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
  } else if (check) {
    const result = await esbuild.build({ ...options, write: false });
    const built = result.outputFiles[0].text;
    // The working copy may have CRLF line endings on Windows; git commits LF
    const committed = (await readFile(options.outfile, "utf8").catch(() => "")).replaceAll("\r\n", "\n");
    if (built !== committed) {
      console.error(`${options.outfile} does not match ${name}: run npm run build`);
      stale++;
    }
  } else {
    await esbuild.build(options);
  }
}
// The emoji data beside the bundle of each plugin with the emoji picker (shared/emoji.ts; scripts/icons/emoji.mjs), made from
// the package as installed: one each, as a plugin is installed without the others
for (const emojiFile of ["silverware-toolbar/silverware-toolbar-emoji.js", "silverware-database/silverware-database-emoji.js"]) {
  if (check) {
    const committed = (await readFile(emojiFile, "utf8").catch(() => "")).replaceAll("\r\n", "\n");
    if (committed !== emojiModuleText()) {
      console.error(`${emojiFile} does not match emojibase-data: run npm run build`);
      stale++;
    }
  } else await writeFile(emojiFile, emojiModuleText());
}
// Silverware Icons' sets beside its bundle and its manifest (scripts/icons/index.mjs), made from the packages as installed
for (const { path, text } of iconFiles()) {
  if (check) {
    const committed = (await readFile(path, "utf8").catch(() => "")).replaceAll("\r\n", "\n");
    if (committed !== text) {
      console.error(`${path} does not match its set's sources: run npm run build`);
      stale++;
    }
  } else await writeFile(path, text);
}
// The CSS of what shared/ draws, in each plugin's style page (scripts/sharedstyles.mjs)
stale += await sharedStyles(check);
if (stale) process.exit(1);
