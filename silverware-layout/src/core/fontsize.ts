// The editor's font size (docs/silverware-layout-font-size.md): which applies (this device's zoom, else the setting,
// else none: the theme's), a zoom's step, and a wheel's turns counted in steps. Pure.
import { FONT_SIZE_LIMITS } from "../model/settings.ts";

/** The font size shown: this device's zoom, else the setting; none: the theme's */
export const fontSizeShown = (zoom: number | undefined, setting: number | undefined): number | undefined => zoom ?? setting;

/** A font size `steps` pixels on (back where negative), held within the limits */
export const zoomedBy = (from: number, steps: number): number => Math.max(FONT_SIZE_LIMITS.min, Math.min(FONT_SIZE_LIMITS.max, Math.round(from) + steps));

// How far a wheel turns for a step (px of deltaY): a mouse's notch is about 100, a touchpad's small deltas summed
const STEP_DELTA = 50;

/**
 * A wheel's turns as steps of the font size, up (larger) for a turn away (deltaY below 0), as a browser zooms. A notch
 * is a step; a touchpad's small deltas are summed until they make one. Lines or pages (deltaMode 1, 2) a step each.
 */
export class WheelSteps {
  private sum = 0;

  steps(deltaY: number, deltaMode = 0): number {
    if (!deltaY) return 0;
    const sign = deltaY < 0 ? 1 : -1;
    if (deltaMode !== 0 || Math.abs(deltaY) >= STEP_DELTA) {
      this.sum = 0;
      return sign;
    }
    // (A turn the other way starts again)
    if (this.sum && Math.sign(this.sum) !== Math.sign(deltaY)) this.sum = 0;
    this.sum += deltaY;
    if (Math.abs(this.sum) < STEP_DELTA) return 0;
    this.sum = 0;
    return sign;
  }
}
