// Silverware Table entry point, loaded by the init page's Space Lua:
//   js.importFromSpace("Library/damesene/silverware-table.js").init({ ... editor functions ... })
// The functions the Lua calls are SilverBullet's binding's (host/silverbullet/api.ts), exported here by their names.
export * from "./host/silverbullet/api.ts";
