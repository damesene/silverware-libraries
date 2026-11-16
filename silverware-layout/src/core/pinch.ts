// Two fingers on the page (docs/silverware-layout-font-size.md, *Pinch*): what they do, told by how they move. A tap
// (both lifted soon, hardly moved) is the host's own gesture, given back to it; a pinch (the distance between them
// changed) zooms the font, as the fingers spread or close; a move of both together (the distance kept) is the page's
// scroll, nothing of ours. Pure: the points and times are the touch events'.

/** A finger's place in the window (px) */
export type Point = { readonly x: number; readonly y: number };

/** What two fingers are doing, as far as can be told yet */
export type TwoFingers = "undecided" | "pinch" | "pan";

// How far a finger moves and still taps (px), how much the distance between them changes before it is a pinch (px),
// how long a tap lasts at most (ms)
export const TAP_MOVE_PX = 10;
export const PINCH_PX = 12;
export const TAP_MS = 300;

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const middle = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * What two fingers that started at `start` and are at `now` are doing: a pinch once the distance between them changed
 * by more than PINCH_PX (one finger moved alone too: the distance changes as it moves, their middle half as much); a
 * pan once their middle moved more than TAP_MOVE_PX with the distance kept; else undecided (a tap yet, where they are
 * lifted soon). Asked again as they move: a pan becomes a pinch once they spread (a hand moved a little first)
 */
export function twoFingers(start: readonly [Point, Point], now: readonly [Point, Point]): TwoFingers {
  if (Math.abs(distance(now[0], now[1]) - distance(start[0], start[1])) > PINCH_PX) return "pinch";
  if (distance(middle(start[0], start[1]), middle(now[0], now[1])) > TAP_MOVE_PX) return "pan";
  return "undecided";
}

/** Whether two fingers lifted after `ms` were a tap: soon, and never more than undecided */
export const wasTap = (seen: TwoFingers, ms: number): boolean => seen === "undecided" && ms <= TAP_MS;

/**
 * The font size a pinch gives: the size it started at, as the distance between the fingers grows or shrinks (spread to
 * twice as far, twice the size), whole px, held within `limits`
 */
export function pinchedSize(from: number, start: readonly [Point, Point], now: readonly [Point, Point], limits: { readonly min: number; readonly max: number }): number {
  const before = distance(start[0], start[1]);
  const scale = before > 0 ? distance(now[0], now[1]) / before : 1;
  return Math.max(limits.min, Math.min(limits.max, Math.round(from * scale)));
}
