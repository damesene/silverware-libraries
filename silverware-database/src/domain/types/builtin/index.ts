// The built-in property types, in the order they are offered (decided 2026-11-06: the first seven).
import { checkbox } from "./checkbox.ts";
import { date } from "./date.ts";
import { datetime } from "./datetime.ts";
import { progress } from "./progress.ts";
import { reference } from "./reference.ts";
import { tags } from "./tags.ts";
import { time } from "./time.ts";
import { multiSelect } from "./multiselect.ts";
import { number } from "./number.ts";
import { select } from "./select.ts";
import { text } from "./text.ts";
import { url } from "./url.ts";
import type { PropertyType } from "../type.ts";

// (A day, a time, both side by side; references after a URL; tags and progress last: the system properties Tags' and Task
// progress's own, offered for no property of the user's: the system property Task progress's own, not offered for one of the user's)
export const BUILT_IN_TYPES: readonly PropertyType[] = [text, number, checkbox, date, time, datetime, select, multiSelect, url, reference, tags, progress];
