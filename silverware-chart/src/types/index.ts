// The built-in types of charts, in the order the menu offers them
import type { ChartType } from "../core/type.ts";
import { DOUGHNUT, PIE, POLAR_AREA, RADAR } from "./round.ts";
import { AREA, BAR, LINE, SCATTER } from "./xy.ts";

export const BUILTIN_TYPES: readonly ChartType[] = [BAR, LINE, AREA, SCATTER, PIE, DOUGHNUT, POLAR_AREA, RADAR];
