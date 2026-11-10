---
name: Library/damesene/silverware-icons
tags: meta/library
description: "Silverware Icons: monochrome icons (Lucide) and emoji for the other Silverware plugins, drawn in the colors of your theme, and sets of icons of your own."
files:
- silverware-icons.js
- silverware-icons-lucide.js
- silverware-icons-lucide-search.js
- silverware-icons-emoji-search.js
- silverware-icons-api.md
- silverware-icons-style.md
---
# Silverware Icons

Icons for the other Silverware plugins: where one of them lets you give something an icon of your own (a button of Silverware Toolbar, an item of Silverware Database), you can pick a monochrome icon instead of an emoji. Icons are drawn in the color of the text around them, so they fit your theme, light or dark, and show a button's state as its text does.

It comes with [Lucide](https://lucide.dev)'s icons (over 2,000, in categories) and the emoji. Install it beside the plugins that use it; they work without it, but their pickers then say it is needed.

## How an icon is written

An icon of a set is written as the set's name and the icon's: `lucide:house`. An emoji is written as itself: `🏠`. So in your CONFIG:

```lua
{ id = "formats.bold", icon = "lucide:bold" }
```

The names are Lucide's (search them on [lucide.dev](https://lucide.dev/icons)); a name Lucide had before it renamed an icon still works. An icon whose set or name is not there shows as a dotted box, its tooltip saying why.

## A set of your own

A set is a JavaScript file of your space, given to `silverware.icons.defineSets` in Space Lua:

```lua
silverware.icons.defineSets(js.importFromSpace("Library/mine/my-icons.js"))
```

```js
export default {
  name: "mine",            // its icons are written mine:<name>
  label: "Mine",           // its tab in the picker
  kind: "svg",             // "svg" icons drawn from nodes, or "text": characters, written as themselves
  groups: [{ id: "shapes", label: "Shapes", icon: "mine:star" }],
  icons: [
    {
      name: "star",
      keywords: ["favourite"],
      groups: ["shapes"],
      // On a 24×24 grid, drawn with lines in the text's color: a path's d alone, or [element, attributes]
      nodes: ["M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z", ["circle", { cx: 12, cy: 12, r: 2 }]],
    },
  ],
};
```

An icon is drawn of `path`, `circle`, `rect`, `line`, `polyline`, `polygon` and `ellipse` and their shapes' attributes (with `fill`, `stroke` and `opacity`), nothing else. A set of the name of a built-in one (`lucide`, `emoji`) takes its place. A set or an icon that is wrong is said in a notification and left out. Your sets are defined again each time Space Lua loads.

## Sets and licenses

- **Icons** (`lucide`): [Lucide](https://lucide.dev), ISC license.
- **Emoji**: names and keywords from [emojibase](https://emojibase.dev) (MIT) and Unicode CLDR; drawn by your system's emoji font.
