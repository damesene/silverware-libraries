// A setting of a chart, as data: what the settings dialog shows and how it
// reads and writes the model. The dialog knows no setting by name: modules
// give the common ones (ChartModule.settings), a type of chart its own
// (ChartType.settings); a setting shows where the chart's type has what it
// `needs` (ChartType.capabilities) and its `when` agrees, and is offered where
// the block's format can write it (ChartFormat.supports). What the chart's
// source is (its table's columns) the dialog gives every setting in a context.
import type { Condition, ChartModel } from "./model.ts";
import type { ChartType } from "./type.ts";

export type SettingValue = string | number | boolean | undefined | readonly Condition[];

/**
 * How a setting is set: a switch, a text, a number, one of choices, a color,
 * a list of conditions (a column, an operator, a value each: its choices the
 * source's columns), one item of all picked (a setting of each item: the
 * item picked set true, the others as that leaves them)
 */
export type SettingControl = "switch" | "text" | "number" | "choice" | "color" | "conditions" | "radio";

export type SettingChoice = { readonly value: string; readonly label: string };

/** What the dialog knows of the chart besides its model: its source's columns, where it has a source the page offers */
export type SettingContext = {
  readonly type: ChartType;
  readonly columns?: readonly { readonly name: string; readonly numeric: boolean }[];
};

type Common = {
  // Its id (dotted: "y.min", "series.kind"), as a format's `supports` is asked about it
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  // The dialog's tab it is on (tabs in the order their first setting comes)
  readonly tab: string;
  readonly control: SettingControl;
  // A choice's choices: as they are, or as the chart offers them (its type's kinds, its source's columns)
  readonly choices?: readonly SettingChoice[] | ((context: SettingContext, model: ChartModel) => readonly SettingChoice[]);
  // What the chart's type must have (a capability) for it to show
  readonly needs?: string;
  // Whether it shows for this chart (left out: always, where its type has what it needs)
  readonly when?: (model: ChartModel, context: SettingContext) => boolean;
};

/** A setting of the chart as a whole */
export type ChartSetting = Common & {
  readonly each?: undefined;
  readonly get: (model: ChartModel, context: SettingContext) => SettingValue;
  readonly set: (model: ChartModel, value: SettingValue, context: SettingContext) => ChartModel;
};

/**
 * A setting of each item, a row of controls each: each series of the block's
 * (a chart of no source), each column of its source's table (one with a
 * source: every column, those off the chart among them), each label (a pie's
 * slices)
 */
export type ItemSetting = Common & {
  readonly each: "series" | "columns" | "labels";
  readonly get: (model: ChartModel, index: number, context: SettingContext) => SettingValue;
  readonly set: (model: ChartModel, index: number, value: SettingValue, context: SettingContext) => ChartModel;
};

export type Setting = ChartSetting | ItemSetting;

/** Whether a setting shows for a chart */
export function settingShown(setting: Setting, context: SettingContext, model: ChartModel): boolean {
  if (setting.needs && !(context.type.capabilities ?? []).includes(setting.needs)) return false;
  // A setting of each column needs the columns; one of each series, a chart drawing no table's (else its columns stand for them)
  if (setting.each === "columns" && !context.columns) return false;
  if (setting.each === "series" && context.columns) return false;
  return !setting.when || setting.when(model, context);
}

/** A choice setting's choices for a chart */
export function choicesOf(setting: Setting, context: SettingContext, model: ChartModel): readonly SettingChoice[] {
  const choices = setting.choices;
  return typeof choices === "function" ? choices(context, model) : (choices ?? []);
}
