// Silverware Assets' binding to SilverBullet: what its init page starts, handed SilverBullet's API (and Silverware
// Layout's, where it is installed). Being split out of Silverware Layout (docs/silverware-assets-split.md): it loads,
// doing nothing yet.

/** What the init page hands over */
export type Bridge = {
  readonly getCurrentPage: () => unknown;
  readonly getText: () => unknown;
  readonly flash: (message: string, type?: "info" | "error") => unknown;
  // Silverware Layout's API, where it is installed
  readonly layout?: unknown;
};

/** Silverware Assets' API, as its API page hands it to other plugins (`silverware.assets.api`) */
export const api = {};

/** Started by the init page (again as Space Lua loads again) */
export function init(_bridge: Bridge): void {
  // (Nothing yet: the assets come from Silverware Layout in the next steps)
}
