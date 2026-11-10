---
tags: meta
---
# Silverware Icons style

The look of [Silverware Icons](silverware-icons.md): an icon in the plugins' buttons and lists, and an icon that is missing. It is installed with the library.

```space-style
/* Silverware Icons (prefix swi-): an icon drawn in a box of the text's size, in the
   text's color; the plugins size the box for their places (their <base>-icon) */
.swi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  line-height: 1;
  vertical-align: -0.125em;
}
.swi-icon > svg {
  width: 100%;
  height: 100%;
}
/* An icon no set has (its title says why): a dotted box in its place */
.swi-icon.swi-missing {
  box-sizing: border-box;
  border: 1px dashed currentColor;
  border-radius: 3px;
  opacity: 0.5;
}
```
