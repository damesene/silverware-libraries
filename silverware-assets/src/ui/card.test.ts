// A card's size and date as read.
import { describe, expect, it } from "vitest";
import { dateText, sizeText } from "./card.ts";

describe("a card's fields", () => {
  it("say a size in B, KB, MB, GB, one decimal under 10", () => {
    expect([0, 512, 1024, 1536, 10_240, 2_621_440, 5 * 1024 ** 3].map(sizeText)).toEqual(["0 B", "512 B", "1 KB", "1.5 KB", "10 KB", "2.5 MB", "5 GB"]);
  });

  it("say a date of an ISO text or milliseconds, none of what is no time", () => {
    expect(dateText("2026-11-13T10:00:00Z", "en-GB")).toBe("13 Nov 2026");
    expect(dateText(Date.UTC(2026, 0, 2, 12), "en-GB")).toBe("2 Jan 2026");
    expect(dateText("never")).toBeUndefined();
  });
});
