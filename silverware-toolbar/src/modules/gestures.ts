// The gestures module: a kind of favourite, the gesture button
// (`{ type = "gesture", tap = <an action's id>, up = <another's>, show }`), two
// actions in one. A click (a tap) runs `tap`; dragged up, its content rolls up
// as a reel under the pointer, `up`'s coming from below, and let go past half
// of it (or flicked up) runs `up`; dragged back, nothing runs. `up`'s icon, small
// above the button's, says what a swipe runs, lit while it would. Both faces share one
// cell, so the button is as wide as the wider and never changes as it rolls.
// Mouse, pen and touch alike (pointer events); a sideways move is not the
// gesture's: the toolbar docked at the bottom scrolls (touch-action: pan-x
// leaves it to the browser, which cancels the press).
import type { Action, ToolbarModule } from "../core/action.ts";
import type { ItemHost, ItemKind, ShownItem } from "../core/items.ts";
import { ICONS } from "../icons.ts";

// How far a press moves before it is a drag (px)
const SLOP = 5;
// Let go past this share of the button's height: up runs
const ARM_AT = 0.5;
// Flicked up this fast (px/ms) at its end, past FLICK_AT: up runs too
const FLICK_SPEED = 0.5;
const FLICK_AT = 0.2;
// A move this long before the release still counts for a flick (ms)
const FLICK_MS = 80;
// The reel settling once let go (ms): the CSS's transition, kept in step
const SETTLE_MS = 180;
// Up's face kept a moment after it ran, then rolled back
const HOLD_MS = 260;

// Gesture buttons whose up ran a moment ago, by their favourite (the same object while the settings are): the
// toolbar shown anew after the action draws its button anew, which goes on from where the one before was
const fired = new WeakMap<object, { readonly at: number; readonly from: number }>();

export function gesturesModule(): ToolbarModule {
  return { actions: () => [], itemKinds: () => [GESTURE] };
}

const GESTURE: ItemKind = {
  type: "gesture",
  label: "Gesture button",
  icon: ICONS.gesture,
  slots: [
    { key: "tap", label: "Click" },
    { key: "up", label: "Swipe up" },
  ],
  render,
};

function render(shown: ShownItem, host: ItemHost): HTMLButtonElement {
  const { doc } = host;
  const tap = shown.actions.tap!;
  const up = shown.actions.up!;
  const tapState = host.state(tap);
  const upState = host.state(up);
  const button = host.button();
  button.classList.add("swb-gesture");
  if (shown.labeled) button.classList.add("swb-labeled");
  button.dataset.swbGesture = tap.id;
  button.dataset.swbUp = up.id;
  const label = `${tap.label} (swipe up: ${up.label})`;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(tapState.active));
  // Not disabled: up may still be swiped to
  if (!tapState.enabled) button.setAttribute("aria-disabled", "true");

  const reel = doc.createElement("span");
  reel.className = "swb-gesture-reel";
  const face = (action: Action, which: string, state: { active: boolean; enabled: boolean }) => {
    const element = host.content(action, shown.labeled);
    element.classList.add("swb-gesture-face", which);
    element.classList.toggle("swb-off", !state.enabled);
    element.classList.toggle("swb-on", state.active);
    return element;
  };
  // What a swipe up runs, small above the icon
  const hint = doc.createElement("span");
  hint.className = "swb-gesture-hint";
  hint.innerHTML = up.icon;
  hint.setAttribute("aria-hidden", "true");
  reel.append(face(tap, "swb-gesture-tap", tapState), face(up, "swb-gesture-up", upState));
  button.append(reel, hint);

  const roll = rolling(button);
  // Up ran a moment ago (the toolbar drawn anew after it): on from where the button before was
  const last = fired.get(shown.item);
  if (last && performance.now() - last.at < SETTLE_MS + HOLD_MS) roll.afterRun(last);

  let press: Press | undefined;
  // A drag ended: the click the browser may send after it is no click
  let dragged = false;
  button.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
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
    press.share = Math.max(0, Math.min(1, dy / press.height));
    roll.to(press.share, press.share >= ARM_AT && upState.enabled);
    e.preventDefault();
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!press || e.pointerId !== press.id) return;
    const { dragging, share, speed, lastT } = press;
    press = undefined;
    if (!dragging) return;
    const flicked = share >= FLICK_AT && speed >= FLICK_SPEED && e.timeStamp - lastT < FLICK_MS;
    if (cancelled || !upState.enabled || (share < ARM_AT && !flicked)) {
      roll.settle(0);
      return;
    }
    const run = { at: performance.now(), from: share };
    fired.set(shown.item, run);
    roll.afterRun(run);
    host.activate(up, button);
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
  // How far it is rolled: 0 tap's face, 1 up's
  share: number;
  lastY: number;
  lastT: number;
  // Upward (px/ms), smoothed
  speed: number;
  readonly height: number;
};

/** A gesture button's reel: following the pointer (no transition), settling (the CSS's transition), and after up ran */
function rolling(button: HTMLButtonElement) {
  const win = button.ownerDocument.defaultView!;
  let timer = 0;
  const set = (share: number) => button.style.setProperty("--swb-roll", String(share));
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
    button.classList.toggle("swb-armed", share === 1);
    set(share);
  };
  return {
    follow,
    to,
    settle,
    /** Up ran: rolled on to its face, kept a moment, rolled back (from where it was let go, the time it ran) */
    afterRun(run: { readonly at: number; readonly from: number }) {
      follow();
      to(run.from, true);
      // Laid out where it was (a button drawn anew: once in the page) before the transition takes it on
      win.requestAnimationFrame(() => {
        void button.offsetWidth;
        settle(1);
        const back = Math.max(0, run.at + SETTLE_MS + HOLD_MS - performance.now());
        timer = win.setTimeout(() => settle(0), back);
      });
    },
  };
}
