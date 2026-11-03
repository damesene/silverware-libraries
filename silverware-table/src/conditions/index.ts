// Conditional formatting's domain, its API for the rest of Silverware Table:
// rules (rule.ts), the definitions there are (registry.ts, custom.ts), their
// evaluation (evaluate.ts), styles as the core's looks (style.ts). Pure.
export type { Cell, Color, ConditionDefinition, Context, FormatDefinition, ParamSpec, ParamSpecs, Params, Scope, Style } from "./api.ts";
export { evaluateRules, type Evaluated, type Placed, type RowFormula, type RuleCells } from "./evaluate.ts";
export { cssColor, HELPERS, isPaletteName, PALETTE_NAMES, type PaletteName } from "./helpers.ts";
export { readParams, storedParams } from "./params.ts";
export {
  allConditions,
  allFormats,
  BUILT_IN_PROBLEMS,
  clearCustomDefinitions,
  conditionNamed,
  customDefinitionsAnew,
  defineCustomConditions,
  defineCustomFormats,
  definitionsVersion,
  formatNamed,
} from "./registry.ts";
export { checkedConditions, checkedFormats } from "./custom.ts";
export { inOrder, isUnread, numbered, type Ref, type Rule, type RuleScope, rulesOf, rulesText, type StoredRule, type UnreadRule } from "./rule.ts";
export { cellOf, scopeOf } from "./scope.ts";
export { checkStyle, colorProblem, styleLook } from "./style.ts";
