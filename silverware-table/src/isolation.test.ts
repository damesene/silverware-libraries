// The layers' boundaries (docs/silverware-table-isolation.md): the modules in
// src/features/ work in model terms only, nothing of the rendering; the core and
// the adapter name no module. The compiler holds most of it (ModelHost,
// TableInfo); this holds what types cannot: imports and selectors.
import { describe, expect, it } from "vitest";

// (Vite reads the options as written: a literal each time)
const features = import.meta.glob(["./features/*.ts", "!./features/*.test.ts"], { query: "?raw", import: "default", eager: true });
const core = import.meta.glob(["./controller.ts", "./core/**/*.ts", "!./core/**/*.test.ts"], { query: "?raw", import: "default", eager: true });
// SilverBullet's binding (host/silverbullet/): its adapter's modules, and the rest of it but its composition (binding.ts,
// which names the modules in their order by design)
const adapterModules = import.meta.glob(["./host/silverbullet/modules/*.ts", "!./host/silverbullet/modules/*.test.ts"], { query: "?raw", import: "default", eager: true });
const adapter = import.meta.glob(["./host/silverbullet/*.ts", "!./host/silverbullet/*.test.ts", "!./host/silverbullet/binding.ts"], { query: "?raw", import: "default", eager: true });
// The stores (the markdown store writes through the page writer)
const stores = import.meta.glob(["./store/**/*.ts", "!./store/**/*.test.ts"], { query: "?raw", import: "default", eager: true });
// The domains the modules hand data to: their own pure code
const domains = import.meta.glob(
  ["./formulas/**/*.ts", "./calculated/**/*.ts", "./pivot/**/*.ts", "./sheet/**/*.ts", "./excel/**/*.ts", "./export/**/*.ts", "./columntypes/**/*.ts", "./conditions/**/*.ts", "./autofill/**/*.ts", "!./**/*.test.ts"],
  { query: "?raw", import: "default", eager: true },
);
// The model: what a table is, kept by no store in particular
const model = import.meta.glob(["./model/**/*.ts", "!./model/**/*.test.ts"], { query: "?raw", import: "default", eager: true });
// The pivot module's domain, and what it shares with views (calculated tables)
const pivot = import.meta.glob(["./pivot/**/*.ts", "./calculated/**/*.ts", "!./**/*.test.ts"], { query: "?raw", import: "default", eager: true });

/** The lines of each file that match, as `file:line: text` */
function matches(files: Record<string, string>, pattern: RegExp): string[] {
  return Object.entries(files).flatMap(([path, text]) =>
    text.split("\n").flatMap((line, i) => (pattern.test(line) && !/^\s*(\/\/|\*|\/\*\*)/.test(line) ? [`${path}:${i + 1}: ${line.trim()}`] : [])),
  );
}

describe("isolation", () => {
  it("finds the files it checks", () => {
    expect(Object.keys(features).length).toBeGreaterThan(10);
    expect(Object.keys(core)).toContain("./controller.ts");
  });

  it("the modules know nothing of the rendering: its types, the adapter, the DOM of SilverBullet", () => {
    expect(matches(features, /\b(HTMLTable\w*Element|WidgetInfo|TableHost|RenderedEditor|AdapterFeature|CellHit)\b/)).toEqual([]);
    expect(matches(features, /from "\.\.\/(dom\.ts|controller\.ts)"/)).toEqual([]);
    // Of the core, its API (feature.ts) and the helpers in model terms only: structural edits, presses told apart
    expect(matches(features, /from "\.\.\/core\/(?!(feature|structure|press)\.ts")/)).toEqual([]);
    // Their own UI only: no table's rows or cells looked for, nothing of SilverBullet's or CodeMirror's
    expect(matches(features, /(querySelector\w*|closest)\([^)]*(["'`](td|th|tr|table)\b|\bsb-|\bcm-)/)).toEqual([]);
    // Their floating UI made by the core (host.floating, panel, floatingMenu), which knows it so, a download given to it: nothing put into the page apart
    expect(matches(features, /\.body\.(append|prepend|appendChild|insertBefore)\(/)).toEqual([]);
  });

  it("a table's key is made by the core's register only: no module builds one, from a table's place or otherwise", () => {
    // (core/parts.ts makes none: it passes on the key a hook was given)
    const outside = Object.fromEntries(Object.entries({ ...features, ...core, ...adapter, ...adapterModules }).filter(([path]) => path !== "./core/tables.ts" && path !== "./core/parts.ts"));
    expect(matches(outside, /as TableKey\b|`\$\{[^`]*\}#\$\{/)).toEqual([]);
  });

  it("a module keeps no collection of state by table: its part for each table holds it (core/parts.ts)", () => {
    // (The sheet lays several tables out on one board: those are its own, the page's)
    const modules = Object.fromEntries(
      Object.entries({ ...features, ...adapterModules }).filter(([path]) => !path.endsWith("/sheet.ts")),
    );
    expect(matches(modules, /\b(Map|Set|WeakMap)<TableKey\b/)).toEqual([]);
  });

  it("a page is written by the page writer alone: no editor's replace nor space's write in the core, the stores, the modules or SilverBullet's binding (store plan, step 4b)", () => {
    expect(Object.keys(stores)).toContain("./store/markdown/store.ts");
    expect(matches({ ...core, ...stores, ...features, ...adapter, ...adapterModules }, /\b(editor|space)[!?]?\.(replace|write)\(/)).toEqual([]);
  });

  it("the core tells tables by their keys and revisions: it reads no page's text, finds no table in one, makes no store (store plan, step 6)", () => {
    // (The register, core/tables.ts, keys a text's tables: the stores ask it)
    const own = Object.fromEntries(Object.entries(core).filter(([path]) => path !== "./core/tables.ts"));
    expect(matches(own, /\beditor[!?]?\.text\(|\b(findTables|parseTable|locateBy\w*|tablesIn|keysOf)\(/)).toEqual([]);
    expect(matches(own, /from "[./]*store\/markdown\/(store|tableparts|pageformulas)\.ts"|new MarkdownStore\b/)).toEqual([]);
  });

  it("the modules work on the model: nothing of the markdown's form (its tables, cells, tags and operations)", () => {
    expect(matches(features, /from "[./]*(markdown|tags|ops)\.ts"/)).toEqual([]);
    expect(matches(features, /\basModel\(/)).toEqual([]);
  });

  it("the domains and the model work on the model too: nothing of the markdown's form, no cell escaped or unescaped", () => {
    expect(Object.keys(domains)).toEqual(expect.arrayContaining(["./formulas/help.ts", "./columntypes/registry.ts", "./conditions/rule.ts", "./autofill/series.ts", "./pivot/pivot.ts"]));
    expect(Object.keys(model)).toContain("./model/rules.ts");
    // (The markdown's files are the folder above: the model has an ops.ts of its own)
    expect(matches({ ...domains, ...model }, /from "(\.\.\/)+(markdown|tags|ops)\.ts"|\b(escapeCell|unescapeCell)\b/)).toEqual([]);
  });

  it("what tables keep is read and written through the host: no module nor domain names an attribute or reads the metadata itself", () => {
    // (Remove metadata is the core's, core/metadata.ts: it names whose each attribute is)
    const modules = { ...features, ...adapterModules };
    // A guard against calling them by mistake: a module could keep its data elsewhere, which nothing here prevents
    expect(matches(modules, /from "[./]*(meta|metanames|names|tagvalues)\.ts"/)).toEqual([]);
    expect(matches(modules, /\bmetaAttribute\b/)).toEqual([]);
    expect(matches(domains, /from "[./]*(meta|metanames|names|tagvalues)\.ts"|\bmetaAttribute\b|[\w)\]?]\.meta\b/)).toEqual([]);
  });

  it("the domains of calculated tables import no module", () => {
    expect(Object.keys(pivot)).toContain("./calculated/table.ts");
    expect(matches(pivot, /from "[./]*(features|core)\//)).toEqual([]);
  });

  it("the modules and the pivot's domain use the formulas through their API (formulas/index.ts), not their files", () => {
    // (The formulas module is theirs: it uses their parts)
    const users = Object.fromEntries(Object.entries({ ...features, ...pivot }).filter(([path]) => path !== "./features/formulas.ts"));
    expect(Object.keys(users)).toContain("./pivot/definition.ts");
    expect(matches(users, /from "[./]*formulas\/(?!index\.ts")/)).toEqual([]);
  });

  it("SilverBullet's side (its platform, its binding, the sources of the space) is the entry's only: no other file imports host/, no domain the sources", () => {
    // (The tests' page stands for the entry: it makes the platform of its bridge and binds the core as the entry does; the core is
    // handed its binding, core/binding.ts)
    expect(Object.keys(adapterModules)).toContain("./host/silverbullet/modules/sheet.ts");
    expect(Object.keys(adapter)).toContain("./host/silverbullet/adapter.ts");
    const all = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./index.ts", "!./host/**", "!./testing/**"], { query: "?raw", import: "default", eager: true });
    expect(Object.keys(all)).toContain("./features/sources.ts");
    expect(matches(all, /from "[./]*host\//)).toEqual([]);
    // (The domains get tables, never the provider nor the offer)
    expect(matches({ ...domains, ...pivot }, /from "[./]*(sources|features\/sources)\.ts"/)).toEqual([]);
  });

  it("no module reaches the platform: what it needs is a host function (docs/silverware-table-store-plan.md, step 1)", () => {
    // (bridge.ts' settings and module names are no part of the bridge: imported by name, the file's name allowed)
    expect(matches(features, /\bbridge\b(?!\.ts")|\bBridge\b|core\/platform\.ts"|shared\/platform\.ts"/)).toEqual([]);
  });

  it("modules get tables through the host, never from a page's text: no markdown read, no table's place (store plan, step 2)", () => {
    // (What a module still takes of markdown.ts until step 3 puts a cell's content and the codec in the store: types, a
    // cell's escapes, two tables compared, Copy as Markdown's serializer)
    expect(matches(features, /\b(parseTable|findTables|locateBySource|pageTablesOf|cellSourceOffset|minimalEdit|tablePlace)\b|host\.(pageText|pageTextNow|tableKeys)\b|\.hint\b|\binfo\.source\b/)).toEqual([]);
  });

  it("the core and the adapter name no module", () => {
    const named = { ...core, ...adapter, ...adapterModules };
    expect(matches(named, /from "[./]*features\//)).toEqual([]);
    expect(matches(named, /moduleOn\("/)).toEqual([]);
  });
});
