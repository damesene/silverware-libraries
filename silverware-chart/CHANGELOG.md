# Silverware Chart: changelog

## 2.0.0 (2026-11-25)

- **Breaking:** needs SilverBullet 3.0 or later. On SilverBullet 2.12, use the versions kept for it in the branch `silverbullet-2.12`: add its repository, `https://github.com/damesene/silverware-libraries/blob/silverbullet-2.12/REPO.md` (*Library: Add Repository*), then remove this library and install it again from there (or change `blob/main/` to `blob/silverbullet-2.12/` in the `share.uri` of its page).
- Two charts written the same on one page are each changed as their own wherever the other is, also far up or down the page.

## 1.2.2 (2026-11-25)

- A chart's width set with Silverware Layout is saved again, and its toolbar and the following of its table work, after SilverBullet reloads its scripts without redrawing the page (until now only a reload of the page fixed it).
- On SilverBullet 3.0 the menu SilverBullet shows beside a widget no longer appears beside a chart, which has its own.
- Two charts written the same on one page are each changed as their own: a width, a setting or a table picked for the second one no longer goes to the first, and each reads the table above or below itself.

## 1.2.1 (2026-11-19)

- Panels, menus and dialogs scroll with a thin scrollbar, the same in every Silverware plugin; SilverBullet's own scrollbar is unchanged.

## 1.2.0 (2026-11-17)

- Works with SilverBullet's next version (3.0) as well as 2.12.1; there, custom formats are given in a `space-lua` block on a page under `Library/`.
- With Silverware Layout: a chart placed at the left, in the middle or at the right of the text, from the menu of the bar beside it.
- Menus line up their icons and words, and a row of buttons wraps onto further lines on a narrow screen.

## 1.1.0 (2026-11-12)

- With Silverware Layout: a chart wider or narrower than the text, by the bar beside it; its width a comment of its block (`%% layout.width`).
- A chart's labels, legend and title follow the page's font size.
- Fixed: a chart's toolbar no longer shows over another plugin's full screen (a table's).

## 1.0.0 (2026-11-11)

First versioned release.

- Mermaid charts (bars, lines, pies) drawn with Chart.js in the colors of your theme.
- More chart types and settings in Mermaid's comments; data from a markdown table of the page, followed as you edit it.
