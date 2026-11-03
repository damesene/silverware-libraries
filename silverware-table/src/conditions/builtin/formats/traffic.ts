import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette, levels }: Helpers): FormatDefinition => ({
  name: "traffic",
  label: "Traffic light",
  description: "The numbers in three equal ranges: red, yellow, green from the smallest",
  look: levels([{ fill: palette.red }, { fill: palette.yellow }, { fill: palette.green }]),
  excel: () => "levels have no Excel form",
});
