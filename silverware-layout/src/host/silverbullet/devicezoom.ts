// This device's font zoom (docs/silverware-layout-font-size.md): kept in the browser's local storage, as the browser
// keeps its own zoom, never in the space. Storage may be refused (a private window, blocked site data): then the zoom
// lasts until the page is reloaded.
import { readFontSize } from "../../model/settings.ts";

const KEY = "silverware.layout.fontZoom";

/** The font size zoomed to on this device (px); none: not zoomed */
export function readDeviceZoom(win: Window): number | undefined {
  try {
    return readFontSize(win.localStorage.getItem(KEY) ?? undefined);
  } catch {
    return undefined;
  }
}

/** This device's zoom kept (none: taken off) */
export function keepDeviceZoom(win: Window, size: number | undefined): void {
  try {
    if (size === undefined) win.localStorage.removeItem(KEY);
    else win.localStorage.setItem(KEY, String(size));
  } catch {
    // (Not kept: it holds until a reload)
  }
}
