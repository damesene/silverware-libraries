// What several column types share
import { asNumber } from "../../../shared/filter.ts";
import { numberFormat } from "../../../shared/intl.ts";

/** A cell's text as a number, read as for sorting (`12,99`, `1 000`, `15 %`) */
export function numberOf(text: string): number | undefined {
  return asNumber(text);
}

export function notANumber(text: string): string | undefined {
  return numberOf(text) === undefined ? `"${text}" is not a number` : undefined;
}

export function formatNumber(n: number, locale: string | undefined, options: Intl.NumberFormatOptions = {}): string {
  return numberFormat(locale, options).format(n);
}
