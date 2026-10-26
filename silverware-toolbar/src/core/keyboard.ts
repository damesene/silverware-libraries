// The on-screen keyboard hidden, the page's text keeping the keyboard focus and
// its selection (nothing unselected, the docked toolbar staying): the
// VirtualKeyboard API (Chrome on Android) hides it only for an element that
// shows it by hand (`virtualKeyboardPolicy` manual), so the page's text is
// made one until its next tap, which shows the keyboard again and gives it
// back to the browser. Without the API (Safari on iOS) the page's text is left
// (blurred): the keyboard goes, the editor keeps its selection, the toolbar
// shown always goes with the focus. The selection is set again once the
// keyboard has gone (the view resized, else a moment after): a phone may drop
// the page's selection as its keyboard goes, which the emulation of one does not.

type VirtualKeyboard = { hide(): void; show(): void };
type Policied = HTMLElement & { virtualKeyboardPolicy?: string };

// How long the keyboard is given to go, at most, before the selection is set again
const GONE_MS = 500;

export function hideKeyboard(content: HTMLElement | null, again: () => void): void {
  if (!content) return;
  const win = content.ownerDocument.defaultView!;
  const keyboard = (win.navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }).virtualKeyboard;
  const element = content as Policied;
  if (!keyboard || !("virtualKeyboardPolicy" in element)) {
    element.blur();
    return;
  }
  element.virtualKeyboardPolicy = "manual";
  keyboard.hide();
  // Once it has gone: the selection as it was
  const view = win.visualViewport;
  let timer = 0;
  const gone = () => {
    view?.removeEventListener("resize", gone);
    win.clearTimeout(timer);
    again();
  };
  view?.addEventListener("resize", gone);
  timer = win.setTimeout(gone, GONE_MS);
  // The next tap in the text: the keyboard shown again (a tap is the user's activation show needs), the browser's again
  const tapped = (e: PointerEvent) => {
    if (!(e.target instanceof Node) || !element.contains(e.target)) return;
    win.removeEventListener("pointerup", tapped, true);
    keyboard.show();
    element.virtualKeyboardPolicy = "auto";
  };
  win.addEventListener("pointerup", tapped, true);
}
