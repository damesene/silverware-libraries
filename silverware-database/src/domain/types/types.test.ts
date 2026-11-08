import { describe, expect, it } from "vitest";
import { isEmpty, validatePropertyKey } from "../../model/database.ts";
import { TypeRegistry } from "./registry.ts";
import type { PropertyType } from "./type.ts";

const types = new TypeRegistry();
const type = (name: string) => types.named(name)!;

describe("property keys", () => {
  it("are what Space Lua reads bare: lower case letters, digits and _, starting with a letter", () => {
    for (const key of ["status", "due_date", "q3"]) expect(validatePropertyKey(key), key).toBeUndefined();
    for (const key of ["due-date", "Due", "3d", "_database", "", "name"]) expect(validatePropertyKey(key), key).toBeDefined();
  });
  it("tell an empty value", () => {
    expect([null, "", [], undefined, 0, false, "x"].map((value) => isEmpty(value))).toEqual([true, true, true, true, false, false, false]);
  });
});

describe("the built-in types", () => {
  it("are in their order, a day, a time and both side by side; progress, a system property's own, offered for no property of the user's", () => {
    expect(types.all().map((one) => one.name)).toEqual(["text", "number", "checkbox", "date", "time", "datetime", "select", "multi-select", "url", "reference", "progress"]);
    expect(types.all().filter((one) => one.offered === false).map((one) => one.name)).toEqual(["progress"]);
  });

  it("read a time of day, kept with two digits each, and a date and time of a real day", () => {
    const time = type("time");
    expect(time.parse("9:05", {})).toEqual({ value: "09:05" });
    expect(time.parse("23:59:30", {})).toEqual({ value: "23:59:30" });
    expect(time.parse("24:00", {})).toHaveProperty("problem");
    expect(time.validate("9:05", {})).toBe("no time (HH:MM)");
    const moment = type("datetime");
    expect(moment.parse("2026-11-08T14:30", {})).toEqual({ value: "2026-11-08T14:30" });
    expect(moment.parse("2026-02-30 10:00", {})).toHaveProperty("problem");
    expect([type("date").editor, time.editor, moment.editor, type("url").editor]).toEqual(["date", "time", "datetime-local", "link"]);
    expect([type("select").look, type("multi-select").look, type("progress").look, type("url").look]).toEqual(["options", "options", "share", "link"]);
    // (A checkbox by its kinds too: turned by a press, drawn as a box; the views know no type by name)
    expect([type("checkbox").editor, type("checkbox").look]).toEqual(["toggle", "check"]);
  });

  it("read a link as an address alone or with its text, as a markdown link; its text what is filtered", () => {
    const link = type("url");
    expect(link.parse("www.example.com", {})).toEqual({ value: "https://www.example.com" });
    expect(link.parse("google.com", {})).toEqual({ value: "https://google.com" });
    expect(link.parse("[Maps](google.com/maps)", {})).toEqual({ value: "[Maps](https://google.com/maps)" });
    expect(link.parse("me@x.dev", {})).toEqual({ value: "mailto:me@x.dev" });
    // (Written without its scheme by hand: read so)
    expect(link.validate("google.com", {})).toBeUndefined();
    expect(link.parse("no address", {})).toHaveProperty("problem");
    expect(link.parse("[Docs](https://silverbullet.md/x)", {})).toEqual({ value: "[Docs](https://silverbullet.md/x)" });
    expect(link.parse("[Docs](javascript:alert(1))", {})).toHaveProperty("problem");
    expect(link.validate("[Docs](https://silverbullet.md)", {})).toBeUndefined();
    expect(link.text("[Docs](https://silverbullet.md)", {})).toBe("Docs");
    expect(link.text("https://silverbullet.md", {})).toBe("https://silverbullet.md");
  });

  it("show a share done as a percent, sort it as its number, read one typed as a share or a percent", () => {
    const done = type("progress");
    expect(done.text(0.6667, {})).toBe("67%");
    expect(done.validate(1.5, {})).toBe("no share (0 to 1)");
    expect(done.parse("50 %", {})).toEqual({ value: 0.5 });
    expect(done.parse("0,25", {})).toEqual({ value: 0.25 });
    expect(done.parse("150%", {})).toHaveProperty("problem");
    for (const loose of ["0x1", "1e-1", ".5", "Infinity", "50"]) expect(done.parse(loose, {})).toHaveProperty("problem");
    // 100% only when all is done, 0% only when none is
    expect([0.995, 0.0033, 1, 0].map((share) => done.text(share, {}))).toEqual(["99%", "1%", "100%", "0%"]);
    expect(done.sortKey!(0.05, {}) < done.sortKey!(0.5, {}) && done.sortKey!(0.5, {}) < done.sortKey!(1, {})).toBe(true);
  });

  it("show a date and time to the minute, sort it as kept, read one typed with a space or a T", () => {
    const moment = type("datetime");
    expect(moment.text("2026-11-08T14:30:05.123", {})).toBe("2026-11-08 14:30");
    expect(moment.validate("2026-11-08T14:30:05.123", {})).toBeUndefined();
    expect(moment.validate("2026-11-08 14:30", {})).toBeUndefined();
    expect(moment.validate("2026-11-08T25:00", {})).toBe("no date and time (YYYY-MM-DD HH:MM)");
    expect(moment.parse("2026-11-08 14:30", {})).toEqual({ value: "2026-11-08T14:30" });
    expect(moment.sortKey!("2026-11-08T09:05", {}) < moment.sortKey!("2026-11-08T14:30:05.123", {})).toBe(true);
  });

  it("a date and a date and time read each other's values, so a change of type between them loses nothing", () => {
    const [day, moment] = [type("date"), type("datetime")];
    // A date and time's value as a date: its day shown, its time kept
    expect(day.validate("2026-11-08T14:30", {})).toBeUndefined();
    expect(day.text("2026-11-08T14:30", {})).toBe("2026-11-08");
    // Another day picked: the time it had kept; a day and time typed whole: as typed
    expect(day.parse("2026-11-12", {}, "2026-11-08T14:30")).toEqual({ value: "2026-11-12T14:30" });
    expect(day.parse("2026-11-12", {}, "2026-11-08")).toEqual({ value: "2026-11-12" });
    expect(day.parse("2026-11-12 09:00", {}, "2026-11-08T14:30")).toEqual({ value: "2026-11-12T09:00" });
    // A date's value as a date and time: its day, no midnight made up for it
    expect(moment.validate("2026-11-08", {})).toBeUndefined();
    expect(moment.text("2026-11-08", {})).toBe("2026-11-08");
    expect(moment.parse("2026-11-08", {})).toEqual({ value: "2026-11-08" });
    // A time takes a date and time's time, its day left (a change of type to a time)
    expect(type("time").parse("2026-11-08T14:30", {})).toEqual({ value: "14:30" });
    expect(type("time").parse("2026-11-08", {})).toHaveProperty("problem");
    // (A page's Created, to the millisecond: sorted so, its day changed keeping it; a time takes it to the second)
    expect(moment.sortKey!("2026-11-08T14:30:05.123", {}) < moment.sortKey!("2026-11-08T14:30:05.9", {})).toBe(true);
    expect(day.parse("2026-11-12", {}, "2026-11-08T14:30:05.123")).toEqual({ value: "2026-11-12T14:30:05.123" });
    expect(type("time").parse("2026-11-08T14:30:05.123", {})).toEqual({ value: "14:30:05" });
  });

  it("read typed text as their values, or say why not", () => {
    expect(type("number").parse("2,5", {})).toEqual({ value: 2.5 });
    expect(type("number").parse("3 kg", {})).toEqual({ problem: '"3 kg" is no number' });
    expect(type("number").parse(" ", {})).toEqual({ value: null });
    expect(type("checkbox").parse("Yes", {})).toEqual({ value: true });
    expect(type("checkbox").parse("maybe", {})).toHaveProperty("problem");
    expect(type("date").parse("2026-11-10", {})).toEqual({ value: "2026-11-10" });
    expect(type("date").parse("2026-02-30", {})).toHaveProperty("problem");
    expect(type("multi-select").parse("a, b, a,", {})).toEqual({ value: ["a", "b"] });
    expect(type("url").parse("https://silverbullet.md", {})).toEqual({ value: "https://silverbullet.md" });
    expect(type("url").parse("javascript:alert(1)", {})).toHaveProperty("problem");
  });

  it("say why a value kept does not read as them, an empty one always reading", () => {
    const options = { options: ["Todo", "Doing", "Done"] };
    expect(type("select").validate("Doing", options)).toBeUndefined();
    expect(type("select").validate("Later", options)).toBe('"Later" is none of its options');
    expect(type("multi-select").validate(["Todo", "X", "Y"], options)).toBe('"X", "Y" are none of its options');
    expect(type("number").validate("12", {})).toBe("no number");
    for (const one of types.all()) expect(one.validate(null, options), one.name).toBeUndefined();
  });

  it("show and sort their values", () => {
    const options = { options: ["Todo", "Doing", "Done"] };
    const order = ["Done", "Later", "Todo", "Doing"].sort((a, b) => type("select").sortKey!(a, options).localeCompare(type("select").sortKey!(b, options)));
    expect(order).toEqual(["Todo", "Doing", "Done", "Later"]);
    expect(type("multi-select").text(["a", "b"], {})).toBe("a, b");
    expect(type("checkbox").text(true, {})).toBe("true");
  });

  it("take an empty value as reading, whatever the type", () => {
    for (const one of types.all()) for (const empty of [null, "", []]) expect(one.validate(empty, {}), `${one.name} ${JSON.stringify(empty)}`).toBeUndefined();
  });

  it("show a value that does not read as they are as it is kept, never blank", () => {
    expect(type("number").text("12 pcs", {})).toBe("12 pcs");
    expect(type("text").text(2026, {})).toBe("2026");
    expect(type("date").text("soon", {})).toBe("soon");
    expect(type("multi-select").text(["a", "b"], {})).toBe("a, b");
  });

  it("refuse what reads two ways or would be lost in typing", () => {
    expect(type("number").parse("1,000", {})).toHaveProperty("problem");
    expect(type("number").parse("1,5", {})).toEqual({ value: 1.5 });
    expect(type("url").parse("www.example.com", {})).toEqual({ value: "https://www.example.com" });
    expect(type("url").parse("https:foo", {})).toHaveProperty("problem");
    expect(type("multi-select").validate(["a", "a"], { options: ["a"] })).toBe("an option twice");
    expect(type("multi-select").validateParams!({ options: ["a, b"] })).toBeDefined();
    expect(type("select").validateParams!({ options: ["a, b"] })).toBeUndefined();
  });

  it("check a select's options", () => {
    expect(type("select").validateParams!({ options: ["a", "b"] })).toBeUndefined();
    expect(type("select").validateParams!({ options: ["a", "a"] })).toBe("its options repeat one");
    expect(type("select").validateParams!({ options: "a, b" })).toBe("its options are no list of texts");
  });
});

describe("the registry", () => {
  it("puts a type defined of a built-in name in its place, the others after", () => {
    const registry = new TypeRegistry();
    const mine: PropertyType = { name: "date", label: "My date", validate: () => undefined, text: String, parse: (text) => ({ value: text }) };
    const stars: PropertyType = { name: "stars", label: "Stars", validate: () => undefined, text: String, parse: (text) => ({ value: text }) };
    registry.define([stars, mine]);
    expect(registry.all().map((one) => one.label)).toEqual(["Text", "Number", "Checkbox", "My date", "Time", "Date & time", "Select", "Multi-select", "URL", "Reference", "Progress", "Stars"]);
    registry.define([]);
    expect(registry.named("date")!.label).toBe("Date");
    expect(registry.named("stars")).toBeUndefined();
  });
});
