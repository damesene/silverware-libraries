# UI without a framework (decided 2026-11-02)

The plugins build their own UI with `el()` (shared/elements.ts) and shared
components in `shared/`, not with a UI framework. This records why, what was
measured, and when to look at it again.

## What the UI is

Two kinds, with different needs:

1. **SilverBullet's DOM, decorated**: tables, CodeMirror, code widgets.
   SilverBullet owns it and renders it anew on every write; the plugins mark it
   and measure it right away. A framework owns nothing here, so it has nothing
   to render. About half of Silverware Table's code.
2. **The plugins' own islands**: dialogs, menus, panels, toolbars, the tags
   workspace. Most are built once and barely change (in the chart's settings
   dialog only the tab picked and the list of conditions change); others swap
   a whole view (a submenu), which `replaceChildren` does as well as a diff.

What they need: building synchronously and measuring at once (a menu placed
as it is made), no Shadow DOM (themes and the user's `space-style` restyle
them), nothing global that two plugins could fight over, small, and typed by
`tsc`.

## What was measured

**Svelte 5 (5.57.3)**, a pilot on the branch `pilot/svelte-chart-settings`:
the chart's settings dialog (tabs, panels, controls, conditions) as components,
its frame and saving left in TS. Its unit tests and its UI tests against
SilverBullet passed, the DOM as before.

| | main | Svelte pilot |
|---|---|---|
| silverware-chart.js | 65 kB (22 kB gzip) | 128 kB (46 kB gzip) |
| The dialog's lines | 254 | 341 |
| Its components' types checked | by `tsc` | not at all |

- The runtime is 60 kB minified, as much as the rest of the plugin; the
  `production` condition takes nothing off (its errors and warnings stay).
  Each plugin would carry its own.
- `svelte-check` needs TypeScript 5 or 6 (its JS API) and does not install
  beside TypeScript 7: the components' props go unchecked (`Component<any>`).
- Listeners are delegated to the component's root: tests have to dispatch
  bubbling events (as browsers do). Harmless between plugins (the root is the
  plugin's own element).
- Updates come in a microtask: `flushSync` after `mount` and after adding a
  condition's row, else what comes next does not find it.
- No line saved: a dialog mostly static has little for a template to spare.
- The build was easy: esbuild-svelte and the vite plugin, two lines each.

**Preact 11.1.1** (not piloted; a minimal app of components, state and a list,
bundled by esbuild, minified): with hooks 13.5 kB (5.7 kB gzip), with
@preact/signals 21 kB (8.3 kB gzip). `.tsx` checked by `tsc` 7, JSX by esbuild
itself.

## Why none

The gain would be in the few places with a list that changes while it is
shown; the cost a second way to build UI beside `el()`, components' lifecycle
beside SilverBullet's DOM, and for Svelte a doubled bundle and unchecked types.
The duplication that costs work today is in components (three menus, two
copies of `el()`), not in the lack of reactivity: that goes to `shared/`.

## When to look again

When a plugin's own UI has a large part that changes often with its state,
and redrawing it loses focus, a field's text or a scroll (the tags workspace is
the nearest). Preact first: small, no compiler, typed by `tsc`.
