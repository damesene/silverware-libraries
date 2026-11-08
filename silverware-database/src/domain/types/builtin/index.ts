// The built-in property types, in the order they are offered (decided 2026-11-06: the first seven).
import { checkbox } from "./checkbox.ts";
import { date } from "./date.ts";
import { datetime } from "./datetime.ts";
import { progress } from "./progress.ts";
import { multiSelect } from "./multiselect.ts";
import { number } from "./number.ts";
import { select } from "./select.ts";
import { text } from "./text.ts";
import { url } from "./url.ts";
import type { PropertyType } from "../type.ts";

// (Date and time and progress last: the system properties' own, not offered for one of the user's)
export const BUILT_IN_TYPES: readonly PropertyType[] = [text, number, checkbox, date, select, multiSelect, url, datetime, progress];
