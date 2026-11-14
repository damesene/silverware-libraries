// Bundles each library's src/index.ts into the .js file next to its library page.
// --check builds in memory and fails when a committed bundle differs from its sources, or a style page's shared block
// from its template (scripts/sharedstyles.mjs). Both fail where a plugin's version has no changelog entry (scripts/versions.mjs).
import * as esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { iconFiles } from "./icons/index.mjs";
import { sharedStyles } from "./sharedstyles.mjs";
import { checkVersions } from "./versions.mjs";

const libraries = ["silverware-table", "silverware-toolbar", "silverware-tags", "silverware-chart", "silverware-database", "silverware-icons", "silverware-layout", "silverware-assets", "silverware-assets-pdf", "silverware-assets-docx", "silverware-assets-xlsx", "silverware-editor"];
// Files bundled beside a library's, loaded by it when needed: Chart.js beside the chart's (src/chartjs.ts), docx-preview
// and JSZip beside Silverware Assets DOCX's, ExcelJS beside Silverware Assets XLSX's (each src/vendor.ts)
const beside = [
  { entry: "silverware-chart/src/chartjs.ts", outfile: "silverware-chart/silverware-chart-chartjs.js" },
  { entry: "silverware-assets-docx/src/vendor.ts", outfile: "silverware-assets-docx/silverware-assets-docx-docxpreview.js" },
  { entry: "silverware-assets-xlsx/src/vendor.ts", outfile: "silverware-assets-xlsx/silverware-assets-xlsx-exceljs.js" },
  { entry: "silverware-editor/src/vendor.ts", outfile: "silverware-editor/silverware-editor-codemirror.js" },
];
// Files copied unchanged beside a library's from a package, loaded by it when needed: pdf.js and its worker beside
// Silverware Assets PDF's (silverware-assets-pdf/src/pdfjs/load.ts)
const copied = [
  { from: "node_modules/pdfjs-dist/build/pdf.min.mjs", to: "silverware-assets-pdf/silverware-assets-pdf-pdfjs.js" },
  { from: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs", to: "silverware-assets-pdf/silverware-assets-pdf-pdfjs-worker.js" },
];
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
// The files copied from packages, as the package installed has them
for (const { from, to } of copied) {
  const text = (await readFile(from, "utf8")).replaceAll("\r\n", "\n");
  if (check) {
    const committed = (await readFile(to, "utf8").catch(() => "")).replaceAll("\r\n", "\n");
    if (committed !== text) {
      console.error(`${to} does not match ${from}: run npm run build`);
      stale++;
    }
  } else await writeFile(to, text);
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
// Each plugin's version and its changelog's entry (scripts/versions.mjs)
if (!watch) stale += await checkVersions(libraries);
if (stale) process.exit(1);
