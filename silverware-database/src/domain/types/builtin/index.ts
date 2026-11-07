// The built-in property types, in the order they are offered (decided 2026-11-06: the first seven).
import { checkbox } from "./checkbox.ts";
import { date } from "./date.ts";
import { multiSelect } from "./multiselect.ts";
import { number } from "./number.ts";
import { select } from "./select.ts";
import { text } from "./text.ts";
import { url } from "./url.ts";
import type { PropertyType } from "../type.ts";

export const BUILT_IN_TYPES: readonly PropertyType[] = [text, number, checkbox, date, select, multiSelect, url];
