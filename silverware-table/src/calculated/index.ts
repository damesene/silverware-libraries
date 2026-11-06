// The shared part of tables calculated from sources (the pivot's, views'): its API for the modules
export { type Calculated, type CalculatedColumn, calculatedTable, movedRenames, type PinsAccess, readRenames, renamedIn, type Renames, sameCells, storedRenames } from "./table.ts";
export { renamedViewIds, viewCalculated } from "./view.ts";
