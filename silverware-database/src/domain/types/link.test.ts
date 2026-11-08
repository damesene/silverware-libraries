import { describe, expect, it } from "vitest";
import { fullAddress, isOpenable, prettyUrl, readLink, writeLink } from "./link.ts";

describe("a link as kept", () => {
  it("reads an address alone, or its text and address as a markdown link", () => {
    expect(readLink("https://silverbullet.md")).toEqual({ url: "https://silverbullet.md" });
    expect(readLink("[Docs](https://silverbullet.md)")).toEqual({ url: "https://silverbullet.md", text: "Docs" });
    expect(readLink("[](https://silverbullet.md)")).toEqual({ url: "https://silverbullet.md" });
    // (An address alone, whatever it holds: the type says whether it is one; an address with a space in it is)
    expect(readLink("https://x.dev/a b")).toEqual({ url: "https://x.dev/a b" });
    expect(readLink("  ")).toBeUndefined();
    expect(readLink(String.raw`[a \[b\]](https://x.dev)`)).toEqual({ url: "https://x.dev", text: "a [b]" });
  });

  it("writes a link with a text as a markdown link, its brackets kept escaped; without one the address alone", () => {
    expect(writeLink("https://x.dev", "[draft] Spec")).toBe(String.raw`[\[draft\] Spec](https://x.dev)`);
    expect(readLink(writeLink("https://x.dev", "[draft] Spec \\"))).toEqual({ url: "https://x.dev", text: "[draft] Spec \\" });
    expect(writeLink(" https://x.dev ", "  ")).toBe("https://x.dev");
  });

  it("makes an address written without its scheme a web one, a mail address mailto; one with a scheme as it is", () => {
    expect(fullAddress("google.com")).toBe("https://google.com");
    expect(fullAddress("www.google.com/maps?q=1")).toBe("https://www.google.com/maps?q=1");
    expect(fullAddress("localhost:3000")).toBe("localhost:3000");
    expect(fullAddress("me@x.dev")).toBe("mailto:me@x.dev");
    expect(fullAddress("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(fullAddress("two words")).toBe("two words");
  });

  it("opens a web or a mail address only, never a script or data", () => {
    expect(["https://x.dev", "http://x.dev", "mailto:a@b.cz"].map(isOpenable)).toEqual([true, true, true]);
    expect(["javascript:alert(1)", "data:text/html,x", "not an address"].map(isOpenable)).toEqual([false, false, false]);
  });

  it("shows an address without its scheme, www and a last slash, its host apart from the rest", () => {
    expect(prettyUrl("https://www.github.com/silverbullet/issues/")).toEqual({ host: "github.com", rest: "/silverbullet/issues" });
    expect(prettyUrl("https://silverbullet.md/")).toEqual({ host: "silverbullet.md", rest: "" });
    expect(prettyUrl("https://x.dev/a?b=1#c")).toEqual({ host: "x.dev", rest: "/a?b=1#c" });
    expect(prettyUrl("mailto:me@x.dev")).toEqual({ host: "me@x.dev", rest: "" });
  });
});
