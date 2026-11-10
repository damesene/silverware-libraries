import { afterEach, describe, expect, it } from "vitest";
import { ICONS_VERSION } from "../../shared/icons.ts";
import { actionsOf, customActionsAnew, defineCustomActions, resetCustomActions, withCustomActions } from "./actions.ts";
import { type Action, type ActionEditor, type Context, NO_ARGS } from "./core/action.ts";
import { contextOf } from "./core/context.ts";

afterEach(() => resetCustomActions());

const builtIn = (id: string): Action => ({ id, label: id, icon: "", group: "Format" });

describe("Custom actions", () => {
  it("are actions.<name>, after the modules' ones; one of a built-in action's name in its place", () => {
    const { actions, problems } = actionsOf([
      { name: "upper", label: "Upper case", edit: () => undefined },
      { name: "clear", label: "My clear", edit: () => undefined },
    ]);
    expect(problems).toEqual([]);
    defineCustomActions(actions);
    expect(withCustomActions([builtIn("actions.clear"), builtIn("formats.bold")]).map((a) => [a.id, a.label])).toEqual([
      ["actions.clear", "My clear"],
      ["formats.bold", "formats.bold"],
      ["actions.upper", "Upper case"],
    ]);
  });

  it("give the text replacing a part of the page; a function given the helpers marks the cursor", () => {
    const { actions } = actionsOf((helpers: { cursor(): string }) => ({
      name: "wrap",
      label: "Wrap",
      edit: (context: { from: number; to: number }) => ({ from: context.from, to: context.to, text: `<${helpers.cursor()}>` }),
    }));
    const change = actions[0]!.edit!(contextOf("a b", 1, 2), NO_ARGS);
    expect(change).toMatchObject({ from: 1, to: 2 });
    expect(change?.insert).toMatch(/^<.+>$/u);
  });

  it("are refused with what is wrong; an edit giving the wrong thing or failing fails the action", () => {
    const { actions, problems } = actionsOf([{ name: "x" }, { name: "y", label: "Y" }, { name: "bad", label: "Bad", edit: () => ({ from: 0, to: 99, text: "" }) }]);
    expect(problems).toEqual(["action x: it has no label", "action y: it has none of edit, perform and choices"]);
    expect(() => actions[0]!.edit!(contextOf("abc", 0, 1), NO_ARGS)).toThrow("bad's edit did not give { from, to, text } within the page");
    const failing = actionsOf({ name: "boom", label: "Boom", edit: () => { throw new Error("no"); } }).actions[0]!;
    expect(() => failing.edit!(contextOf("abc", 0, 1), NO_ARGS)).toThrow("boom's edit failed: no");
  });

  it("perform: something done with the context and the editor's API, awaited; its failure named; not with edit too", async () => {
    const done: string[] = [];
    const editor: ActionEditor = { invokeCommand: async (name) => void done.push(`command ${name}`), navigate: async (page) => void done.push(`open ${page}`), flash: () => {}, select: () => {}, hideKeyboard: () => {}, write: async () => {}, startCompletion: async () => {}, completes: true };
    const { actions, problems } = actionsOf([
      { name: "open", label: "Open selected", listed: false, perform: async (c: Context, e: ActionEditor) => e.navigate(c.text.slice(c.from, c.to)) },
      { name: "both", label: "Both", edit: () => undefined, perform: () => undefined },
      { name: "shown", label: "Shown", listed: "no", perform: () => undefined },
      { name: "boom", label: "Boom", perform: async () => { throw new Error("no page"); } },
    ]);
    expect(problems).toEqual(["action both: it has more than one of edit, perform and choices", "action shown: its listed is not true or false"]);
    const [open, boom] = actions;
    expect(open!.listed).toBe(false);
    expect(open!.edit).toBeUndefined();
    await open!.perform!(contextOf("see Notes here", 4, 9), editor, NO_ARGS);
    expect(done).toEqual(["open Notes"]);
    expect(boom!.listed).toBeUndefined();
    await expect(boom!.perform!(contextOf("x", 0, 0), editor, NO_ARGS)).rejects.toThrow("boom's perform failed: no page");
  });

  it("offer choices: a list as Turn into is, each choice an action of its own", () => {
    const { actions, problems } = actionsOf({
      name: "size",
      label: "Size",
      mixed: "Mixed sizes",
      choices: [
        { name: "small", label: "Small", edit: () => undefined },
        { name: "large", label: "Large", active: () => true, edit: () => undefined },
      ],
    });
    expect(problems).toEqual([]);
    expect(actions[0]).toMatchObject({ id: "actions.size", mixed: "Mixed sizes" });
    expect(actions[0]!.choices!.map((c) => c.id)).toEqual(["actions.small", "actions.large"]);
    expect(actions[0]!.choices![1]!.active!(contextOf("x", 0, 1), NO_ARGS)).toBe(true);
    expect(actionsOf({ name: "bad", label: "Bad", choices: [{ name: "c" }] }).problems).toEqual(["action bad: its choice 1: it has no label"]);
  });

  it("offer choices that are any actions, nothing of formats: one editing, one running a command (a Space Lua one too), as the library page's example", async () => {
    const run: string[] = [];
    const editor: ActionEditor = { invokeCommand: async (name) => void run.push(name), navigate: async () => {}, flash: () => {}, select: () => {}, hideKeyboard: () => {}, write: async () => {}, startCompletion: async () => {}, completes: true };
    const { actions, problems } = actionsOf({
      name: "tools",
      label: "Tools",
      mixed: "Tools",
      choices: [
        { name: "upper", label: "Upper case", edit: (c: Context) => ({ from: c.from, to: c.to, text: c.text.slice(c.from, c.to).toUpperCase() }) },
        { name: "hello", label: "Say hello", perform: (_c: Context, e: ActionEditor) => e.invokeCommand("Say hello") },
      ],
    });
    expect(problems).toEqual([]);
    const [upper, hello] = actions[0]!.choices!;
    expect(upper!.edit!(contextOf("a word", 2, 6), NO_ARGS)).toMatchObject({ from: 2, to: 6, insert: "WORD" });
    await hello!.perform!(contextOf("x", 0, 0), editor, NO_ARGS);
    expect(run).toEqual(["Say hello"]);
  });

  it("are replaced by the definitions made after Space Lua loads again; a name defined twice is said", () => {
    const one = actionsOf({ name: "a", label: "A", edit: () => undefined }).actions;
    expect(defineCustomActions(one)).toEqual([]);
    expect(defineCustomActions(one)).toEqual(["a"]);
    customActionsAnew();
    defineCustomActions(actionsOf({ name: "b", label: "B", edit: () => undefined }).actions);
    expect(withCustomActions([]).map((a) => a.id)).toEqual(["actions.b"]);
  });

  it("take parameters (texts typed or picked from choices), their values given to their functions, named by them; parameters not right refused", async () => {
    const done: unknown[] = [];
    const { actions, problems } = actionsOf({
      name: "template",
      label: "Template",
      params: [{ key: "name", label: "Template", choices: ["Meeting", { value: "daily", label: "Daily note" }] }, { key: "note", label: "Note", placeholder: "Any" }],
      describe: (args: { name?: string }) => (args.name ? `Template: ${args.name}` : undefined),
      perform: (_context: unknown, _editor: unknown, args: unknown) => void done.push(args),
    });
    expect(problems).toEqual([]);
    const [template] = actions;
    expect(template!.params!.map((param) => [param.key, param.choices?.()])).toEqual([["name", [{ value: "Meeting", label: "Meeting" }, { value: "daily", label: "Daily note" }]], ["note", undefined]]);
    expect(template!.describe!({ name: "daily" })).toBe("Template: daily");
    await template!.perform!(contextOf("", 0, 0), {} as ActionEditor, { name: "daily" });
    await template!.perform!(contextOf("", 0, 0), {} as ActionEditor, NO_ARGS);
    expect(done).toEqual([{ name: "daily" }, {}]);
    expect(actionsOf({ name: "x", label: "X", params: [{ key: "a b", label: "A" }], edit: () => undefined }).problems[0]).toContain("its param 1");
    expect(actionsOf({ name: "x", label: "X", params: [{ key: "a", label: "A" }, { key: "a", label: "B" }], edit: () => undefined }).problems[0]).toContain("twice");
    expect(actionsOf({ name: "x", label: "X", params: [{ key: "a", label: "A" }], choices: [{ name: "y", label: "Y", edit: () => undefined }] }).problems[0]).toContain("params and choices");
  });
});

describe("A custom action's icon of Silverware Icons", () => {
  it("drawn as an own icon is, where the modules offer their actions; an SVG as it is", async () => {
    const { createModules } = await import("./modules.ts");
    const icons = { version: ICONS_VERSION, markup: (value: string, base: string) => `<i class="${base}-icon">${value}</i>`, text: (value: string) => value, pick: () => () => undefined };
    defineCustomActions(actionsOf([{ name: "rocket", label: "Rocket", icon: "lucide:rocket", edit: () => undefined }, { name: "plain", label: "Plain", icon: "<svg></svg>", edit: () => undefined }]).actions);
    const offered = createModules(new Set(), { icons }).actions();
    expect(offered.map((a) => a.icon)).toEqual(['<i class="swb-own-icon">lucide:rocket</i>', "<svg></svg>"]);
  });
});
