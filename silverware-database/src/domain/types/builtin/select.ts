// Select: one of the property's options (`params.options`), or some of them
// where it says `multiple: true` (domain/types/choices.ts). One type with a
// setting, as Notion's Select and Multi-select differ in that alone (decided
// with the user 2026-11-09). A value none of the options is kept and shown
// invalid; sorted in the options' order.
import { choiceType } from "../choices.ts";

export const select = choiceType({ name: "select", label: "Select" });
