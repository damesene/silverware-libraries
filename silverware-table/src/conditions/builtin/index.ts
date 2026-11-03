// The built-in conditions and formats, in the order the dialog offers them: one per file,
// each written against api.ts alone as a user's definition is (a function given the helpers).
import type { ConditionDefinition, Defined, FormatDefinition } from "../api.ts";
import c_greater from "./conditions/greater.ts";
import c_less from "./conditions/less.ts";
import c_between from "./conditions/between.ts";
import c_equal from "./conditions/equal.ts";
import c_notequal from "./conditions/notequal.ts";
import c_contains from "./conditions/contains.ts";
import c_notcontains from "./conditions/notcontains.ts";
import c_startswith from "./conditions/startswith.ts";
import c_endswith from "./conditions/endswith.ts";
import c_matches from "./conditions/matches.ts";
import c_empty from "./conditions/empty.ts";
import c_notempty from "./conditions/notempty.ts";
import c_duplicate from "./conditions/duplicate.ts";
import c_unique from "./conditions/unique.ts";
import c_top from "./conditions/top.ts";
import c_bottom from "./conditions/bottom.ts";
import c_aboveaverage from "./conditions/aboveaverage.ts";
import c_belowaverage from "./conditions/belowaverage.ts";
import c_datein from "./conditions/datein.ts";
import c_formula from "./conditions/formula.ts";
import f_redfill from "./formats/redfill.ts";
import f_yellowfill from "./formats/yellowfill.ts";
import f_greenfill from "./formats/greenfill.ts";
import f_bluefill from "./formats/bluefill.ts";
import f_redtext from "./formats/redtext.ts";
import f_bold from "./formats/bold.ts";
import f_custom from "./formats/custom.ts";
import f_bypattern from "./formats/bypattern.ts";
import f_byrange from "./formats/byrange.ts";
import f_colorscale from "./formats/colorscale.ts";
import f_levels from "./formats/levels.ts";
import f_heatmap from "./formats/heatmap.ts";
import f_traffic from "./formats/traffic.ts";
import f_databar from "./formats/databar.ts";
import f_arrows from "./formats/arrows.ts";
import f_dots from "./formats/dots.ts";

export const BUILT_IN_CONDITIONS = [c_greater, c_less, c_between, c_top, c_bottom, c_aboveaverage, c_belowaverage, c_equal, c_notequal, c_contains, c_notcontains, c_startswith, c_endswith, c_matches, c_empty, c_notempty, c_duplicate, c_unique, c_datein, c_formula] as readonly Defined<ConditionDefinition>[];

export const BUILT_IN_FORMATS = [f_redfill, f_yellowfill, f_greenfill, f_bluefill, f_redtext, f_bold, f_custom, f_bypattern, f_byrange, f_colorscale, f_levels, f_heatmap, f_traffic, f_databar, f_arrows, f_dots] as readonly Defined<FormatDefinition>[];
