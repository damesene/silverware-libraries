import type { ConditionDefinition, Helpers } from "../../api.ts";

// The periods, in the order the dialog offers them
const PERIODS = ["today", "yesterday", "tomorrow", "last7", "next7", "thisWeek", "lastWeek", "nextWeek", "thisMonth", "lastMonth", "nextMonth", "thisYear", "past", "future"];
const LABELS = ["Today", "Yesterday", "Tomorrow", "In the last 7 days", "In the next 7 days", "This week", "Last week", "Next week", "This month", "Last month", "Next month", "This year", "Before today", "After today"];

export default ({ today, DAY }: Helpers): ConditionDefinition<{ period: string }> => ({
  name: "dateIn",
  label: "Date occurring",
  description: "Cells whose date is in a period around today (weeks start on Monday)",
  params: { period: { kind: "choice", label: "When", values: PERIODS, labels: LABELS, default: "today" } },
  test: (cell, { params }) => {
    if (cell.date === undefined) return false;
    const now = today();
    const day = Math.floor(cell.date / DAY) * DAY;
    const d = new Date(now);
    const monday = now - ((d.getUTCDay() + 6) % 7) * DAY;
    const month = (by: number) => [Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by, 1), Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + by + 1, 1)] as const;
    const within = ([from, to]: readonly [number, number]) => day >= from && day < to;
    switch (params.period) {
      case "today":
        return day === now;
      case "yesterday":
        return day === now - DAY;
      case "tomorrow":
        return day === now + DAY;
      case "last7":
        return within([now - 6 * DAY, now + DAY]);
      case "next7":
        return within([now, now + 7 * DAY]);
      case "thisWeek":
        return within([monday, monday + 7 * DAY]);
      case "lastWeek":
        return within([monday - 7 * DAY, monday]);
      case "nextWeek":
        return within([monday + 7 * DAY, monday + 14 * DAY]);
      case "thisMonth":
        return within(month(0));
      case "lastMonth":
        return within(month(-1));
      case "nextMonth":
        return within(month(1));
      case "thisYear":
        return new Date(day).getUTCFullYear() === d.getUTCFullYear();
      case "past":
        return day < now;
      case "future":
        return day > now;
      default:
        return false;
    }
  },
  excel: (params, at) => {
    const day = `FLOOR(${at},1)`;
    const period = (name: string, formula: string) => ({ type: "timePeriod", attrs: { timePeriod: name }, formulas: [formula] });
    const isDate = (test: string) => ({ type: "expression", formulas: [`AND(ISNUMBER(${at}),${test})`] });
    const month = (by: number) => `AND(MONTH(${at})=MONTH(EDATE(TODAY(),${by})),YEAR(${at})=YEAR(EDATE(TODAY(),${by})))`;
    // Weeks from Monday (Excel's own periods start on Sunday)
    const monday = (date: string) => `${date}-WEEKDAY(${date},2)`;
    switch (params.period) {
      case "today":
        return period("today", `${day}=TODAY()`);
      case "yesterday":
        return period("yesterday", `${day}=TODAY()-1`);
      case "tomorrow":
        return period("tomorrow", `${day}=TODAY()+1`);
      case "last7":
        return period("last7Days", `AND(TODAY()-${day}<=6,${day}<=TODAY())`);
      case "thisMonth":
        return period("thisMonth", month(0));
      case "lastMonth":
        return period("lastMonth", month(-1));
      case "nextMonth":
        return period("nextMonth", month(1));
      case "thisWeek":
        return isDate(`${monday(day)}=${monday("TODAY()")}`);
      case "lastWeek":
        return isDate(`${monday(day)}=${monday("TODAY()")}-7`);
      case "nextWeek":
        return isDate(`${monday(day)}=${monday("TODAY()")}+7`);
      case "next7":
        return isDate(`${day}>=TODAY(),${day}<TODAY()+7`);
      case "thisYear":
        return isDate(`YEAR(${at})=YEAR(TODAY())`);
      case "past":
        return isDate(`${day}<TODAY()`);
      case "future":
        return isDate(`${day}>TODAY()`);
      default:
        return "a period Excel has no form of";
    }
  },
});
