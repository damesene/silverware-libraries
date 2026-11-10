# AutoFill (Silverware Table): series and custom series

The domain of AutoFill (the `autofill` module, `features/autofill.ts`, is its UI): a series is found by `match(values)` once and gives a generator by index (0..k-1 the values given, k… after, -1… before); a line nothing matches repeats its values.

## Decisions

- **Custom series** (`silverware.table.defineSeries`, the API page) are JS, as custom functions are: the same API block, replaced as Space Lua loads again. A definition is data, `words` to go round (`alone: false` for words also used otherwise), or a series of its own (`match`), never both.
- **Tried before the built-in ones**, a custom one of a built-in one's name in its place: a user's words are meant to win (Q1 … Q4 go round, not on to Q5).
- Nothing is checked again when they change: a fill reads them as it starts.
- A cell another part claims (`ModelHost.fillCell`: a formula, the formulas module's copy) is copied over, its references moved, rather than continued as a series.
