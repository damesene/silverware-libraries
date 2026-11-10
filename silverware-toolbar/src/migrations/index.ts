// Migrations of the settings as configured: what a space wrote for an older
// model of them, made what the toolbar reads now. Each migration is a file of
// its own (one change of the model), listed here in its order; it knows the
// settings by their paths only and gives what to write, so adding one is a
// file and a line, and removing one (once no space can have its older model)
// is taking that line and its file out. The model's version is
// `silverware.toolbar.version`: a migration runs where the space's
// is lower than its own, and the changes are written back with the version,
// so what is set in the new model is never migrated again. A space that set
// nothing has nothing to migrate: nothing is written.
import { toolbars } from "./2-toolbars.ts";

/** The setting holding the model's version (not set: 1, the model before any migration) */
export const VERSION_PATH = "silverware.toolbar.version";

/** A setting as configured, by its path (undefined: not set) */
export type ReadSetting = (path: string) => Promise<unknown>;

/** One change of the model: its version (the model it leads to), what it is, and what it writes, by path (nothing: none to change) */
export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly migrate: (read: ReadSetting) => Promise<Readonly<Record<string, unknown>>>;
};

/** In the order they run, their versions rising */
export const MIGRATIONS: readonly Migration[] = [toolbars];

/** The model's version now: the last migration's */
export const SETTINGS_VERSION = MIGRATIONS.reduce((version, m) => Math.max(version, m.version), 1);

/**
 * What the migrations a space's settings need write, by path, with the
 * version they lead to; nothing where none changes anything (the version is
 * then left as it is: nothing is written for it alone)
 */
export async function migrate(read: ReadSetting, migrations: readonly Migration[] = MIGRATIONS): Promise<Readonly<Record<string, unknown>>> {
  const stored = await read(VERSION_PATH);
  const from = typeof stored === "number" && Number.isFinite(stored) ? stored : 1;
  const changes: Record<string, unknown> = {};
  // (Each reads what those before it wrote)
  const now: ReadSetting = async (path) => (path in changes ? changes[path] : read(path));
  for (const migration of migrations) {
    if (migration.version <= from) continue;
    try {
      Object.assign(changes, await migration.migrate(now));
    } catch (e) {
      // Settings read as they are: the toolbar still starts
      console.error(`Silverware Toolbar: migrating the settings (${migration.name}) failed`, e);
      return {};
    }
  }
  if (!Object.keys(changes).length) return {};
  return { ...changes, [VERSION_PATH]: migrations.reduce((version, m) => Math.max(version, m.version), from) };
}
