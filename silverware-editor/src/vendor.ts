// CodeMirror as a file of its own beside Silverware Editor's bundle (silverware-editor-codemirror.js, built by
// scripts/build.mjs), loaded as Space Lua starts, once the browser is idle (src/index.ts `loadCodeMirror`): never imported by the bundle
// itself, only its types (src/codemirror.ts).
import { cssLanguage } from "@codemirror/lang-css";
import { htmlLanguage } from "@codemirror/lang-html";
import { javascriptLanguage, jsxLanguage, tsxLanguage, typescriptLanguage } from "@codemirror/lang-javascript";
import { type Language, LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";
import { c, cpp, csharp, dart, java, kotlin, objectiveC, objectiveCpp, scala } from "@codemirror/legacy-modes/mode/clike";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { go } from "@codemirror/legacy-modes/mode/go";
import { json } from "@codemirror/legacy-modes/mode/javascript";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { python } from "@codemirror/legacy-modes/mode/python";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { pgSQL, standardSQL } from "@codemirror/legacy-modes/mode/sql";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { tcl } from "@codemirror/legacy-modes/mode/tcl";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { xml } from "@codemirror/legacy-modes/mode/xml";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";

export { Compartment, EditorSelection, EditorState, Prec, StateField, Transaction } from "@codemirror/state";
export { Decoration, drawSelection, EditorView, keymap, placeholder, WidgetType } from "@codemirror/view";
export { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
export { insertNewlineContinueMarkupCommand, markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
export { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
export { autocompletion, closeBrackets, closeBracketsKeymap, closeCompletion, completionKeymap, completionStatus } from "@codemirror/autocomplete";
export { highlightTree, tagHighlighter, tags } from "@lezer/highlight";

// A fenced code block's languages, by the names SilverBullet's editor highlights (its client/languages.ts, 2026-11-15:
// the same modes, Lua's the legacy mode in place of its own parser); each made as a block of it is first highlighted
const stream =
  <T>(parser: StreamParser<T>) =>
  (): Language =>
    StreamLanguage.define(parser);
const LANGUAGES: readonly (readonly [names: readonly [string, ...string[]], language: () => Language])[] = [
  [["yaml", "yml", "meta", "include", "space-config", "data", "toc"], stream(yaml)],
  [["lua", "space-lua", "page-lua"], stream(lua)],
  [["javascript", "js", "space-script"], () => javascriptLanguage],
  [["jsx"], () => jsxLanguage],
  [["typescript", "ts"], () => typescriptLanguage],
  [["tsx"], () => tsxLanguage],
  [["css", "space-style"], () => cssLanguage],
  [["html"], () => htmlLanguage],
  [["tex", "latex"], stream(stex)],
  [["json"], stream(json)],
  [["sql"], stream(standardSQL)],
  [["postgresql", "pgsql", "postgres"], stream(pgSQL)],
  [["python", "py"], stream(python)],
  [["rust", "rs"], stream(rust)],
  [["r"], stream(r)],
  [["shell", "sh", "bash", "zsh", "fish"], stream(shell)],
  [["go", "golang"], stream(go)],
  [["xml"], stream(xml)],
  [["swift"], stream(swift)],
  [["toml"], stream(toml)],
  [["protobuf", "proto"], stream(protobuf)],
  [["diff"], stream(diff)],
  [["powershell"], stream(powerShell)],
  [["perl"], stream(perl)],
  [["ruby"], stream(ruby)],
  [["tcl"], stream(tcl)],
  [["verilog"], stream(verilog)],
  [["vhdl"], stream(vhdl)],
  [["dockerfile"], stream(dockerFile)],
  [["cmake"], stream(cmake)],
  [["erlang"], stream(erlang)],
  [["c"], stream(c)],
  [["cpp", "c++", "cxx"], stream(cpp)],
  [["java"], stream(java)],
  [["csharp", "cs", "c#"], stream(csharp)],
  [["scala"], stream(scala)],
  [["kotlin"], stream(kotlin)],
  [["objc", "objective-c", "objectivec"], stream(objectiveC)],
  [["objcpp", "objective-cpp", "objectivecpp", "objective-c++", "objectivec++"], stream(objectiveCpp)],
  [["dart"], stream(dart)],
];

const descriptions: readonly LanguageDescription[] = LANGUAGES.map(([[name, ...alias], language]) =>
  LanguageDescription.of({ name, alias, load: async () => new LanguageSupport(language()) }),
);
// (A tag's data block's: YAML, found by its name)
const tagged = LanguageDescription.matchLanguageName(descriptions, "yaml", false)!;

/**
 * The language a fenced code block is highlighted in, by its info's first word (`markdown`'s `codeLanguages`): its name or an alias,
 * a tag's data block (`#tag`) YAML, as SilverBullet's editor has it
 */
export function codeLanguage(info: string): LanguageDescription | null {
  // (Its first word exactly, as SilverBullet's editor reads it: `text` is no `tex`, `jsonc` no `json`)
  const name = info.trim().split(/\s/)[0] ?? "";
  return name.startsWith("#") ? tagged : LanguageDescription.matchLanguageName(descriptions, name, false);
}
