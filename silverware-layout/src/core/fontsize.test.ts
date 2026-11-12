import { describe, expect, it } from "vitest";
import { fontSizeShown, WheelSteps, zoomedBy } from "./fontsize.ts";

describe("the font size", () => {
  it("this device's zoom, else the setting, else none (the theme's)", () => {
    expect(fontSizeShown(20, 16)).toBe(20);
    expect(fontSizeShown(undefined, 16)).toBe(16);
    expect(fontSizeShown(undefined, undefined)).toBeUndefined();
  });

  it("zoomed a pixel a step, held within 5 to 40 px", () => {
    expect(zoomedBy(18, 1)).toBe(19);
    expect(zoomedBy(18, -2)).toBe(16);
    expect(zoomedBy(40, 1)).toBe(40);
    expect(zoomedBy(5, -1)).toBe(5);
    expect(zoomedBy(17.6, 1)).toBe(19);
  });

  it("a wheel's notch a step, larger turned away; a touchpad's small deltas summed into one; turned back, started again", () => {
    const wheel = new WheelSteps();
    expect(wheel.steps(-100)).toBe(1);
    expect(wheel.steps(120)).toBe(-1);
    expect([-10, -10, -10, -10].map((d) => wheel.steps(d))).toEqual([0, 0, 0, 0]);
    expect(wheel.steps(-10)).toBe(1);
    expect(wheel.steps(-30)).toBe(0);
    expect(wheel.steps(30)).toBe(0);
    expect(wheel.steps(30)).toBe(-1);
    // Lines (Firefox): a step each
    expect(wheel.steps(3, 1)).toBe(-1);
    expect(wheel.steps(0)).toBe(0);
  });
});
