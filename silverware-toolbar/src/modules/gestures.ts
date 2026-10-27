// The gestures module: a kind of favourite, the gesture button
// (`{ type = "gesture", tap = <an action's id>, up = <another's>, down = <another's>, show }`,
// `up` and `down` each optional): several actions in one. A click (a tap) runs
// `tap`; dragged up, its content rolls up as a reel under the pointer, `up`'s
// coming from below, and let go past half of it (or flicked) runs `up`; dragged
// down the same for `down`, its face coming from above; dragged back, nothing
// runs. `up`'s icon, small in its top right corner (`down`'s the bottom right), says what a
// swipe runs, on where that action is on (a swipe turns it off); the button is
// tinted while letting go would run one. The faces share one cell, so the
// button is as wide as the widest and never changes as it rolls. Mouse, pen and
// touch alike (pointer events); a sideways move is not the gesture's: the
// toolbar docked at the bottom scrolls (touch-action: pan-x leaves it to the
// browser, which cancels the press).
import type { Action, ToolbarModule } from "../core/action.ts";
import type { ItemHost, ItemKind, ShownItem } from "../core/items.ts";
import { ICONS } from "../icons.ts";

// How far a press moves before it is a drag (px)
const SLOP = 5;
// Let go past this share of the button's height: the swipe's action runs
const ARM_AT = 0.5;
// Flicked this fast (px/ms) at its end, past FLICK_AT: it runs too
const FLICK_SPEED = 0.5;
const FLICK_AT = 0.2;
// A move this long before the release still counts for a flick (ms)
const FLICK_MS = 80;
// The reel settling once let go (ms): the CSS's transition, kept in step
const SETTLE_MS = 180;
// The swipe's face kept a moment after its action ran, then rolled back
const HOLD_MS = 260;

// Up 1, down -1: the sign of the reel's roll
type Way = 1 | -1;

type Run = { readonly at: number; readonly from: number; readonly way: Way };

// Gesture buttons whose swipe ran a moment ago, by their favourite (the same object while the settings are): the
// toolbar shown anew after the action draws its button anew, which goes on from where the one before was
const fired = new WeakMap<object, Run>();

export function gesturesModule(): ToolbarModule {
  return { actions: () => [], itemKinds: () => [GESTURE] };
}

const GESTURE: ItemKind = {
  type: "gesture",
  label: "Gesture button",
  description: "Several actions in one",
  icon: ICONS.gesture,
  slots: [
    { key: "tap", label: "Click" },
    { key: "up", label: "Swipe up", optional: true },
    { key: "down", label: "Swipe down", optional: true },
  ],
  render,
};

type State = { readonly active: boolean; readonly enabled: boolean };

function render(shown: ShownItem, host: ItemHost): HTMLButtonElement {
  const { doc } = host;
  const tap = shown.actions.tap!;
  const { up, down } = shown.actions;
  const tapState = host.state(tap);
  const swipes = new Map<Way, { readonly action: Action; readonly state: State }>();
  if (up) swipes.set(1, { action: up, state: host.state(up) });
  if (down) swipes.set(-1, { action: down, state: host.state(down) });
  const button = host.button();
  button.classList.add("swb-gesture");
  if (shown.labeled) button.classList.add("swb-labeled");
  button.dataset.swbGesture = tap.id;
  if (up) button.dataset.swbUp = up.id;
  if (down) button.dataset.swbDown = down.id;
  const ways = [up ? `swipe up: ${up.label}` : "", down ? `swipe down: ${down.label}` : ""].filter(Boolean);
  const label = ways.length ? `${tap.label} (${ways.join(", ")})` : tap.label;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(tapState.active));
  // Not disabled: a swipe's action may still run
  if (!tapState.enabled) button.setAttribute("aria-disabled", "true");

  const reel = doc.createElement("span");
  reel.className = "swb-gesture-reel";
  const face = (action: Action, which: string, state: State) => {
    const element = host.content(action, shown.labeled);
    element.classList.add("swb-gesture-face", which);
    element.classList.toggle("swb-off", !state.enabled);
    element.classList.toggle("swb-on", state.active);
    return element;
  };
  // What a swipe runs, small in the top right corner (up) or the bottom right (down), on where it is on for the selection (a swipe turns it off)
  const hint = (action: Action, which: string, state: State) => {
    const element = doc.createElement("span");
    element.className = `swb-gesture-hint ${which}`;
    element.classList.toggle("swb-on", state.active);
    element.innerHTML = action.icon;
    element.setAttribute("aria-hidden", "true");
    return element;
  };
  reel.append(face(tap, "swb-gesture-tap", tapState));
  button.append(reel);
  for (const [way, { action, state }] of swipes) {
    const which = way === 1 ? "up" : "down";
    button.classList.add(`swb-has-${which}`);
    reel.append(face(action, `swb-gesture-${which}`, state));
    button.append(hint(action, `swb-hint-${which}`, state));
  }

  const roll = rolling(button);
  // A swipe ran a moment ago (the toolbar drawn anew after it): on from where the button before was
  const last = fired.get(shown.item);
  if (last && swipes.has(last.way) && performance.now() - last.at < SETTLE_MS + HOLD_MS) roll.afterRun(last);

  let press: Press | undefined;
  // A drag ended: the click the browser may send after it is no click
  let dragged = false;
  button.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !e.isPrimary || !swipes.size) return;
    dragged = false;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, share: 0, lastY: e.clientY, lastT: e.timeStamp, speed: 0, height: reel.getBoundingClientRect().height || button.offsetHeight || 30 };
  });
  button.addEventListener("pointermove", (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    const dy = press.y - e.clientY;
    if (!press.dragging) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // Sideways: not the gesture (the docked toolbar scrolls)
      if (Math.abs(dx) > Math.abs(dy)) {
        press = undefined;
        return;
      }
      press.dragging = true;
      dragged = true;
      try {
        button.setPointerCapture(e.pointerId);
      } catch {
        // (Released already: the next move or the release ends it)
      }
      roll.follow();
    }
    const dt = e.timeStamp - press.lastT;
    if (dt > 0) press.speed = 0.6 * ((press.lastY - e.clientY) / dt) + 0.4 * press.speed;
    press.lastY = e.clientY;
    press.lastT = e.timeStamp;
    // Only the ways it has a swipe for
    press.share = Math.max(swipes.has(-1) ? -1 : 0, Math.min(swipes.has(1) ? 1 : 0, dy / press.height));
    const way: Way = press.share < 0 ? -1 : 1;
    roll.to(press.share, Math.abs(press.share) >= ARM_AT && !!swipes.get(way)?.state.enabled);
    e.preventDefault();
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!press || e.pointerId !== press.id) return;
    const { dragging, share, speed, lastT } = press;
    press = undefined;
    if (!dragging) return;
    const way: Way = share < 0 ? -1 : 1;
    const swipe = swipes.get(way);
    const flicked = Math.abs(share) >= FLICK_AT && speed * way >= FLICK_SPEED && e.timeStamp - lastT < FLICK_MS;
    if (cancelled || !swipe?.state.enabled || (Math.abs(share) < ARM_AT && !flicked)) {
      roll.settle(0);
      return;
    }
    const run: Run = { at: performance.now(), from: share, way };
    fired.set(shown.item, run);
    roll.afterRun(run);
    host.activate(swipe.action, button);
  };
  button.addEventListener("pointerup", (e) => end(e, false));
  button.addEventListener("pointercancel", (e) => end(e, true));
  button.addEventListener("click", (e) => {
    e.preventDefault();
    if (dragged) {
      dragged = false;
      return;
    }
    if (tapState.enabled) host.activate(tap, button);
  });
  return button;
}

type Press = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  dragging: boolean;
  // How far it is rolled: 0 tap's face, 1 up's, -1 down's
  share: number;
  lastY: number;
  lastT: number;
  // Upward (px/ms; down negative), smoothed
  speed: number;
  readonly height: number;
};

/** A gesture button's reel: following the pointer (no transition), settling (the CSS's transition), and after a swipe ran */
function rolling(button: HTMLButtonElement) {
  const win = button.ownerDocument.defaultView!;
  let timer = 0;
  const set = (share: number) => {
    button.style.setProperty("--swb-roll", String(share));
    // How far, either way (the hints fade by it)
    button.style.setProperty("--swb-rolled", String(Math.abs(share)));
  };
  const follow = () => {
    win.clearTimeout(timer);
    button.classList.add("swb-rolling");
  };
  const to = (share: number, armed: boolean) => {
    set(share);
    button.classList.toggle("swb-armed", armed);
  };
  const settle = (share: number) => {
    button.classList.remove("swb-rolling");
    button.classList.toggle("swb-armed", share !== 0);
    set(share);
  };
  return {
    follow,
    to,
    settle,
    /** A swipe ran: rolled on to its face, kept a moment, rolled back (from where it was let go, the time it ran) */
    afterRun(run: Run) {
      follow();
      to(run.from, true);
      // Laid out where it was (a button drawn anew: once in the page) before the transition takes it on
      win.requestAnimationFrame(() => {
        void button.offsetWidth;
        settle(run.way);
        const back = Math.max(0, run.at + SETTLE_MS + HOLD_MS - performance.now());
        timer = win.setTimeout(() => settle(0), back);
      });
    },
  };
}
