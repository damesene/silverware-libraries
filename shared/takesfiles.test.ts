// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { markTakesFiles, TAKES_FILES_ATTRIBUTE, takesFilesAt, takesFilesOf } from "./takesfiles.ts";

describe("An element that takes files itself", () => {
  afterEach(() => document.body.replaceChildren());

  it("is the marked element a node is in, none once its mark is off", () => {
    const cell = document.createElement("td");
    const inner = document.createElement("span");
    inner.append("text");
    cell.append(inner);
    document.body.append(cell);
    expect(takesFilesOf(inner)).toBeUndefined();
    markTakesFiles(cell, true);
    expect(cell.hasAttribute(TAKES_FILES_ATTRIBUTE)).toBe(true);
    expect(takesFilesOf(inner)).toBe(cell);
    expect(takesFilesOf(inner.firstChild)).toBe(cell);
    markTakesFiles(cell, false);
    expect(takesFilesOf(inner)).toBeUndefined();
  });

  it("is found past a shadow root to its host", () => {
    const host = document.createElement("div");
    markTakesFiles(host, true);
    document.body.append(host);
    const field = document.createElement("p");
    host.attachShadow({ mode: "open" }).append(field);
    expect(takesFilesOf(field)).toBe(host);
  });

  it("is found for an event at an element marked in a shadow root, though the document's target is its host", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const marked = document.createElement("p");
    markTakesFiles(marked, true);
    host.attachShadow({ mode: "open" }).append(marked);
    let seen: { target: EventTarget | null; found: Element | undefined } | undefined;
    document.addEventListener("drop", (event) => (seen = { target: event.target, found: takesFilesAt(event) }), { capture: true, once: true });
    marked.dispatchEvent(new Event("drop", { bubbles: true, composed: true }));
    expect(seen?.target).toBe(host);
    expect(seen?.found).toBe(marked);
  });

  it("is none for no node, or one not in an element", () => {
    expect(takesFilesOf(null)).toBeUndefined();
    expect(takesFilesOf(undefined)).toBeUndefined();
    expect(takesFilesOf(document)).toBeUndefined();
  });
});
