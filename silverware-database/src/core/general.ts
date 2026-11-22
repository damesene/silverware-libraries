// Silverware Database's own settings, for every database, beside its views' and modules' (the settings dialog's
// General tab, `silverware.database.<key>`): how many items a view shows at first (docs/silverware-database-load-more.md).
import type { Settings } from "../../../shared/platform.ts";
import type { ViewSetting } from "./view.ts";

/** Where a setting of Silverware Database's own is kept */
export const generalSettingPath = (key: string) => `silverware.database.${key}`;

/** How many items a view (each group of it) shows at first, and Load more shows more by */
export const PAGE_SIZE: ViewSetting = {
  key: "pageSize",
  label: "Items shown at first",
  hint: "In each view and each group of it; Load more shows as many more. 10 to 10,000",
  control: "number",
  default: 50,
  min: 10,
  max: 10_000,
  whole: true,
};

/** Silverware Database's own settings, in the order the dialog shows them */
export const GENERAL_SETTINGS: readonly ViewSetting[] = [PAGE_SIZE];

/** Why a number is no value of a number setting (outside its range, not whole where it must be), none where it is one */
export function validateNumberSetting(setting: ViewSetting, value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return "no number";
  if (setting.whole && !Number.isInteger(value)) return "a whole number";
  if (setting.min !== undefined && value < setting.min) return `${setting.min} or more`;
  if (setting.max !== undefined && value > setting.max) return `${setting.max} or less`;
  return undefined;
}

/**
 * A setting as configured, a view's, a module's or Silverware Database's own: a number one outside its range (or no
 * number: a hand's edit of the configuration) its default, as its declaration says it is never otherwise
 */
export async function settingValue(settings: Pick<Settings, "get">, setting: ViewSetting, path: string): Promise<unknown> {
  const value = await settings.get(path, setting.default);
  return setting.control === "number" && validateNumberSetting(setting, value) !== undefined ? setting.default : value;
}

/** How many items a view shows at first, as configured (50 where it is none of 10 to 10,000) */
export const pageSize = async (settings: Pick<Settings, "get">): Promise<number> => (await settingValue(settings, PAGE_SIZE, generalSettingPath(PAGE_SIZE.key))) as number;
