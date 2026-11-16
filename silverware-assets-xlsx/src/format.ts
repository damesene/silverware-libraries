// A cell's value as text, as Excel shows it by its number format, near enough (docs/silverware-viewers.md): decimals,
// thousands' separators, percent, a currency's or any text round the number, dates and times; a formula's result as
// Excel saved it (nothing is calculated). Pure; the locale the browser's (as Excel shows a workbook in its user's).
import { dateTimeFormat, numberFormat } from "../../shared/intl.ts";

/** A value as ExcelJS reads a cell's */
export type CellValue =
  | null
  | undefined
  | number
  | string
  | boolean
  | Date
  | { readonly formula?: string; readonly sharedFormula?: string; readonly result?: unknown }
  | { readonly richText: readonly { readonly text: string }[] }
  | { readonly text: string; readonly hyperlink: string }
  | { readonly error: string };

/** A value's text and whether it is a number (Excel puts numbers at the right) */
export type Shown = { readonly text: string; readonly number: boolean };

const EMPTY: Shown = { text: "", number: false };

/** A cell's value as Excel shows it by its format (`General` where none) */
export function showValue(value: CellValue, format: string | undefined, locale?: string): Shown {
  if (value === null || value === undefined) return EMPTY;
  if (typeof value === "number") return { text: formatNumber(value, format, locale), number: true };
  if (typeof value === "string") return { text: value, number: false };
  if (typeof value === "boolean") return { text: value ? "TRUE" : "FALSE", number: false };
  if (value instanceof Date) return { text: formatDate(value, format, locale), number: true };
  if ("richText" in value) return { text: value.richText.map((part) => part.text).join(""), number: false };
  if ("hyperlink" in value) return { text: value.text, number: false };
  if ("error" in value) return { text: value.error, number: false };
  if ("result" in value || "formula" in value || "sharedFormula" in value) return showValue((value as { result?: CellValue }).result, format, locale);
  return EMPTY;
}

/** Whether a number format is a date's or a time's (its letters outside quotes and brackets) */
export function isDateFormat(format: string | undefined): boolean {
  if (!format) return false;
  const bare = format.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  // (Tenths of a second after seconds, `ss.0`, are a time's, not a number's placeholders)
  return /[dmyhs]/i.test(bare) && !/[0#?]/.test(bare.replace(/s+\.0+/gi, "s").replace(/[dmyhs]+/gi, ""));
}

/** A date by a date's format: with a time where the format has hours, in UTC (Excel's dates have no time zone) */
export function formatDate(date: Date, format: string | undefined, locale?: string): string {
  if (Number.isNaN(date.getTime())) return "";
  const bare = (format ?? "").replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  // Minutes and seconds with no hours, days or years: a time of its own (`mm:ss`, a lap's), not a date
  if (/s/i.test(bare) && !/[hdy]/i.test(bare)) {
    const pad = (value: number) => String(value).padStart(2, "0");
    const tenths = /s\.0/i.test(bare) ? `.${Math.floor(date.getUTCMilliseconds() / 100)}` : "";
    return `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${tenths}`;
  }
  const withTime = /h/i.test(bare);
  const withDate = /[dy]/i.test(bare) || /m{3,}/i.test(bare) || !withTime;
  const options: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
  if (withDate) Object.assign(options, { year: "numeric", month: "numeric", day: "numeric" });
  if (withTime) Object.assign(options, { hour: "numeric", minute: "2-digit", ...(/s/i.test(bare.replace(/m/gi, "")) ? { second: "2-digit" } : {}) });
  return dateTimeFormat(locale, options).format(date);
}

/** A number by a number format: its first section (or the negative's where it has one), decimals, separators, percent, text round it */
export function formatNumber(number: number, format: string | undefined, locale?: string): string {
  if (!Number.isFinite(number)) return String(number);
  const sections = (format ?? "General").split(";");
  const negative = number < 0 && sections.length > 1;
  const section = (negative ? sections[1] : number === 0 && sections.length > 2 ? sections[2] : sections[0])!.trim();
  if (!section || /^general$/i.test(section)) return general(number, locale);
  if (isDateFormat(section)) return formatDate(excelDate(number), section, locale);
  // What is round the number: quoted text, a currency's [$€-407], a symbol; the placeholders between
  const literal = (text: string) =>
    text
      .replace(/\[\$([^-\]]*)(-[^\]]*)?\]/g, "$1")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/"([^"]*)"/g, "$1")
      .replace(/\\(.)/g, "$1")
      .replace(/_./g, " ")
      .replace(/\*./g, "");
  // (The placeholders found outside quoted text and brackets: `[$€-407]`'s digits are none of them)
  const masked = section.replace(/"[^"]*"|\[[^\]]*\]|\\.|_.|\*./g, (part) => "~".repeat(part.length));
  const first = masked.search(/[0#?]/);
  if (first < 0) return literal(section);
  const last = Math.max(masked.lastIndexOf("0"), masked.lastIndexOf("#"), masked.lastIndexOf("?"));
  const body = section.slice(first, last + 1);
  const before = literal(section.slice(0, first));
  const after = literal(section.slice(last + 1).replace(/^,+/, ""));
  // A fraction's (`# ?/?`): shown as General, near enough; scientific (`0.00E+00`): its own
  if (masked.includes("/")) return general(number, locale);
  const exponent = /E[+-]/i.exec(masked);
  if (exponent) return scientific(number, masked.slice(0, exponent.index), locale);
  const percent = masked.includes("%");
  const point = body.indexOf(".");
  const decimals = point < 0 ? 0 : (body.slice(point + 1).match(/[0#?]/g) ?? []).length;
  const least = point < 0 ? 0 : (body.slice(point + 1).match(/0/g) ?? []).length;
  const grouped = (point < 0 ? body : body.slice(0, point)).includes(",");
  // (Commas right after the last placeholder each scale by a thousand: `#,##0,` shows thousands)
  const scaled = /^,+/.exec(masked.slice(last + 1))?.[0].length ?? 0;
  const value = (Math.abs(number) * (percent ? 100 : 1)) / 1000 ** scaled;
  const text = numberFormat(locale, { minimumFractionDigits: least, maximumFractionDigits: decimals, useGrouping: grouped }).format(value);
  // (A negative's own section writes its sign or brackets itself; else the minus before all)
  const sign = number < 0 && !negative ? "-" : "";
  return `${sign}${before}${text}${after}`;
}

/** A number in scientific notation by its mantissa's decimals (`0.00E+00`: 1.23E+04) */
function scientific(number: number, mantissa: string, locale?: string): string {
  const point = mantissa.indexOf(".");
  const decimals = point < 0 ? 0 : (mantissa.slice(point + 1).match(/[0#?]/g) ?? []).length;
  const [digits, power] = number.toExponential(decimals).split("e");
  const exponent = Number(power);
  const shown = numberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(Number(digits));
  return `${shown}E${exponent < 0 ? "-" : "+"}${String(Math.abs(exponent)).padStart(2, "0")}`;
}

/** A number as Excel's General shows it: whole as it is, else up to ten significant digits */
function general(number: number, locale?: string): string {
  if (Number.isInteger(number) && Math.abs(number) < 1e11) return numberFormat(locale, { useGrouping: false }).format(number);
  const rounded = Number(number.toPrecision(10));
  if (Math.abs(rounded) >= 1e11 || (Math.abs(rounded) < 1e-9 && rounded !== 0)) return rounded.toExponential(5).replace("e", "E");
  return numberFormat(locale, { useGrouping: false, maximumFractionDigits: 10 }).format(rounded);
}

/** A date from Excel's serial number (days since 1899-12-30, as Excel counts them) */
export function excelDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000));
}
