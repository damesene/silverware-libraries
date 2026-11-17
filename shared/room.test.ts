// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { roomVariable, setRoom } from "./room.ts";

describe("the room a bar docked at an edge takes", () => {
  it("is set on the root as a length, and given back", () => {
    setRoom(document, "bottom", 48);
    expect(document.documentElement.style.getPropertyValue(roomVariable("bottom"))).toBe("48px");
    setRoom(document, "bottom", undefined);
    expect(document.documentElement.style.getPropertyValue("--sw-room-bottom")).toBe("");
  });
});
