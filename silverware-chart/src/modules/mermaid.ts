// The mermaid module: the Mermaid format (formats/mermaid.ts)
import type { ChartModule } from "../core/module.ts";
import { MERMAID_FORMAT } from "../formats/mermaid.ts";

export function mermaidModule(): ChartModule {
  return { formats: () => [MERMAID_FORMAT] };
}
