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
});
