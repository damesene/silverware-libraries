// Silverware Core's bundle (silverware-core.js): one module per window, imported by every plugin's bundle and by its
// API page's gate (`js.importFromSpace`), evaluated once (docs/silverware-core.md, *Probes*). Exports what api.ts
// does: the plugins' bundles take this file as their `silverware-core` module.
export * from "./api.ts";
