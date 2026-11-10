---
tags: meta
---
# Silverware Icons style

The look of [Silverware Icons](silverware-icons.md): an icon in the plugins' buttons and lists, an icon that is missing, and the picker. It is installed with the library.

```space-style
/* Silverware Icons (prefix swi-): an icon drawn in a box of the text's size, in the
   text's color; the plugins size the box for their places (their <base>-icon). Text
   ("H1", an emoji) as wide as it is, an icon of a set a square */
.swi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1em;
  height: 1em;
  line-height: 1;
  vertical-align: -0.125em;
}
.swi-icon[data-swi-icon] {
  width: 1em;
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

/* The picker (in a plugin's panel or popover, which gives its box): the sets as tabs, the groups as a row of icons
   or a dropdown, the search, the icons, the current one's name. In SilverBullet's colors, as the plugins' menus; its
   parts under .swi-picker, so a host's rule for its buttons (a dialog's `button { font: inherit }`) does not win */
.swi-picker {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: inherit;
  font: inherit;
}
.swi-picker .swi-sets {
  display: flex;
  gap: 2px;
  padding: 6px 6px 0;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
}
.swi-picker .swi-set {
  padding: 4px 10px;
  font: inherit;
  font-size: 13px;
  color: inherit;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0;
  opacity: 0.7;
  cursor: pointer;
}
.swi-picker .swi-set:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swi-picker .swi-set[aria-selected="true"] {
  border-bottom-color: var(--ui-accent-color, #464cfc);
  opacity: 1;
  font-weight: 600;
}
.swi-picker .swi-groups {
  display: flex;
  padding: 6px 6px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.swi-picker .swi-groups::-webkit-scrollbar {
  display: none;
}
.swi-picker .swi-groups[hidden] {
  display: none;
}
.swi-picker .swi-group {
  /* All of them in the picker's width, sharing what is left */
  flex: 1 0 auto;
  min-width: 28px;
  height: 30px;
  padding: 0 3px;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: inherit;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
}
.swi-picker .swi-group:first-child {
  font-size: 12px;
  font-weight: 600;
}
.swi-picker .swi-group:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swi-picker .swi-group[aria-checked="true"] {
  border-bottom-color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 10%, transparent);
}
.swi-picker .swi-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
}
.swi-picker .swi-search-label {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.swi-picker .swi-search-label > svg {
  flex: none;
  width: 16px;
  height: 16px;
  opacity: 0.6;
}
.swi-picker .swi-field {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  font: inherit;
  font-size: 14px;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
}
.swi-picker .swi-group-select {
  flex: none;
  max-width: 45%;
  padding: 2px 4px;
  font: inherit;
  font-size: 13px;
  color: inherit;
  background: var(--root-background-color, transparent);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  border-radius: 6px;
}
.swi-picker .swi-section {
  padding: 8px 2px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.swi-picker .swi-none {
  padding: 12px 8px;
  opacity: 0.6;
}
.swi-picker .swi-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 6px 6px;
}
.swi-picker .swi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
}
.swi-picker .swi-item {
  height: 36px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
/* An SVG icon a little smaller than an emoji of the same box, as it fills it whole */
.swi-picker .swi-item .swi-icon[data-swi-icon] {
  font-size: 20px;
}
.swi-picker .swi-item.swi-current {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 16%, transparent);
}
.swi-picker .swi-name {
  min-height: 1.3em;
  padding: 6px 10px;
  border-top: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  opacity: 0.75;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```
