// The browser's formatters of numbers and dates, each made once per locale and options and kept: making one is slow (a
// formatter made for each cell of a sheet, each day of an axis, was most of drawing them), using one is not. Pure.

// A key of a locale and options telling apart all that the browser takes apart: no locale from an empty one (which it
// refuses), a number that is no number (NaN, Infinity, which it refuses) from `null`
const keyOf = (locale: string | undefined, options: object) => JSON.stringify([locale ?? null, options], (_key, value: unknown) => (typeof value === "number" && !Number.isFinite(value) ? `#${value}` : value));

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A number formatter of a locale (none: the browser's) and options, the same one each time they are the same */
export function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = keyOf(locale, options);
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
}

/** A date formatter of a locale (none: the browser's) and options, the same one each time they are the same */
export function dateTimeFormat(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = keyOf(locale, options);
  let format = dateFormats.get(key);
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat(locale, options)));
  return format;
}
