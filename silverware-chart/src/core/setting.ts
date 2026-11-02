// A setting of a chart, as data: what the settings dialog shows and how it
// reads and writes the model. The dialog knows no setting by name: modules
// give the common ones (ChartModule.settings), a type of chart its own
// (ChartType.settings); a setting shows where the chart's type has what it
// `needs` (ChartType.capabilities) and its `when` agrees, and is offered where
// the block's format can write it (ChartFormat.supports).
import type { ChartModel } from "./model.ts";
import type { ChartType } from "./type.ts";

export type SettingValue = string | number | boolean | undefined;

/** How a setting is set: a switch, a text, a number, one of choices, a color */
export type SettingControl = "switch" | "text" | "number" | "choice" | "color";

export type SettingChoice = { readonly value: string; readonly label: string };

type Common = {
  // Its id (dotted: "y.min", "series.kind"), as a format's `supports` is asked about it
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  // The dialog's tab it is on (tabs in the order their first setting comes)
  readonly tab: string;
  readonly control: SettingControl;
  // A choice's choices: as they are, or as the chart's type offers them (a series' kinds)
  readonly choices?: readonly SettingChoice[] | ((type: ChartType, model: ChartModel) => readonly SettingChoice[]);
  // What the chart's type must have (a capability) for it to show
  readonly needs?: string;
  // Whether it shows for this chart (left out: always, where its type has what it needs)
  readonly when?: (model: ChartModel, type: ChartType) => boolean;
};

/** A setting of the chart as a whole */
export type ChartSetting = Common & {
  readonly each?: undefined;
  readonly get: (model: ChartModel) => SettingValue;
  readonly set: (model: ChartModel, value: SettingValue) => ChartModel;
};

/** A setting of each series (a row each), or of each label (a pie's slices) */
export type ItemSetting = Common & {
  readonly each: "series" | "labels";
  readonly get: (model: ChartModel, index: number) => SettingValue;
  readonly set: (model: ChartModel, index: number, value: SettingValue) => ChartModel;
};

export type Setting = ChartSetting | ItemSetting;

/** Whether a setting shows for a chart of this type */
export function settingShown(setting: Setting, type: ChartType, model: ChartModel): boolean {
  return (!setting.needs || (type.capabilities ?? []).includes(setting.needs)) && (!setting.when || setting.when(model, type));
}

/** A choice setting's choices for a chart */
export function choicesOf(setting: Setting, type: ChartType, model: ChartModel): readonly SettingChoice[] {
  const choices = setting.choices;
  return typeof choices === "function" ? choices(type, model) : (choices ?? []);
}
