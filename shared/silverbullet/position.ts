// Where an element of SilverBullet's editor is in the page's text, as SilverBullet's editor says it (`editor.posAtDOM`,
// public from SilverBullet 3.0, handed over by an init page's Lua): what tells a widget's block from another written
// alike (shared/placed.ts). Probed on 3.0.0 (2026-11-25): a code block's widget (a chart, a database's place) gives its
// block's start, a custom syntax's (a grid) its region's end; an element in a widget its widget's; one outside the
// editor none.
import type { PositionOf } from "../placed.ts";

/** The function the init page's Lua handed over (`editor.posAtDOM`) as a `PositionOf`; none where none was handed over */
export function positionOf(posAtDOM: unknown): PositionOf | undefined {
  if (typeof posAtDOM !== "function") return undefined;
  return async (element) => {
    try {
      const at: unknown = await posAtDOM(element);
      return typeof at === "number" && Number.isInteger(at) && at >= 0 ? at : undefined;
    } catch {
      return undefined;
    }
  };
}
