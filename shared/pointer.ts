// How a device is worked: by a finger or by a mouse and keys.

/**
 * Whether this device is worked by a finger (its main pointer coarse: a phone, a tablet); a laptop's touch screen is
 * not (its touchpad is its main pointer)
 */
export function byTouch(win: Window | null | undefined): boolean {
  return !!win?.matchMedia?.("(pointer: coarse)").matches;
}
