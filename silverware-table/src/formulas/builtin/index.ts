// The built-in functions formulas can call, one per file in this folder: only
// functions, what they share is in the folder above (arguments.ts, values.ts).
//
// To add one: copy a file such as sum.ts (a function taking grids, as filter.ts, says `grids: true`), change its name, syntax, description
// and call, import it here and add it to the list. Then add its syntax and
// description to the Functions table in silverware-table.md (a test checks that).
import sum from "./sum.ts";
import average from "./average.ts";
import min from "./min.ts";
import max from "./max.ts";
import product from "./product.ts";
import count from "./count.ts";
import counta from "./counta.ts";
import round from "./round.ts";
import abs from "./abs.ts";
import if_ from "./if.ts";
import iferror from "./iferror.ts";
import and_ from "./and.ts";
import or_ from "./or.ts";
import not_ from "./not.ts";
import concat from "./concat.ts";
import today from "./today.ts";
import now from "./now.ts";
import date from "./date.ts";
import time from "./time.ts";
import int from "./int.ts";
import text from "./text.ts";
import xlookup from "./xlookup.ts";
import dateadd from "./dateadd.ts";
import datedif from "./datedif.ts";
import year from "./year.ts";
import month from "./month.ts";
import day from "./day.ts";
import hour from "./hour.ts";
import minute from "./minute.ts";
import second from "./second.ts";
import weekday from "./weekday.ts";
import row from "./row.ts";
import sumifs from "./sumifs.ts";
import countifs from "./countifs.ts";
import averageifs from "./averageifs.ts";
import maxifs from "./maxifs.ts";
import minifs from "./minifs.ts";
import sumproduct from "./sumproduct.ts";
import median from "./median.ts";
import large from "./large.ts";
import small from "./small.ts";
import rank from "./rank.ts";
import stdev from "./stdev.ts";
import mod from "./mod.ts";
import roundup from "./roundup.ts";
import rounddown from "./rounddown.ts";
import ceiling from "./ceiling.ts";
import floor from "./floor.ts";
import mround from "./mround.ts";
import len from "./len.ts";
import mid from "./mid.ts";
import upper from "./upper.ts";
import lower from "./lower.ts";
import proper from "./proper.ts";
import trim from "./trim.ts";
import substitute from "./substitute.ts";
import search from "./search.ts";
import regextest from "./regextest.ts";
import textjoin from "./textjoin.ts";
import isnumber from "./isnumber.ts";
import networkdays from "./networkdays.ts";
import workday from "./workday.ts";
import isoweeknum from "./isoweeknum.ts";
import eomonth from "./eomonth.ts";
import filter from "./filter.ts";
import sort from "./sort.ts";
import sortby from "./sortby.ts";
import unique from "./unique.ts";
import choosecols from "./choosecols.ts";
import take from "./take.ts";
import drop from "./drop.ts";
import type { AnyFunction } from "../function.ts";

const ALL: readonly AnyFunction[] = [
  sum,
  average,
  min,
  max,
  product,
  count,
  counta,
  round,
  abs,
  if_,
  iferror,
  and_,
  or_,
  not_,
  concat,
  today,
  now,
  date,
  time,
  dateadd,
  datedif,
  year,
  month,
  day,
  hour,
  minute,
  second,
  weekday,
  int,
  text,
  xlookup,
  row,
  sumifs,
  countifs,
  averageifs,
  maxifs,
  minifs,
  sumproduct,
  median,
  large,
  small,
  rank,
  stdev,
  mod,
  roundup,
  rounddown,
  ceiling,
  floor,
  mround,
  len,
  mid,
  upper,
  lower,
  proper,
  trim,
  substitute,
  search,
  regextest,
  textjoin,
  isnumber,
  networkdays,
  workday,
  isoweeknum,
  eomonth,
  filter,
  sort,
  sortby,
  unique,
  choosecols,
  take,
  drop,
];

/** The built-in functions by name */
export const BUILT_IN_FUNCTIONS: Readonly<Record<string, AnyFunction>> = Object.fromEntries(ALL.map((f) => [f.name, f]));
