import { describe, expect, it } from "vitest";
import { silverBulletsOwnError } from "./silverbullet-noise.ts";

describe("SilverBullet's own errors in the console", () => {
  it("are told by what SilverBullet logs, as CI's runs had them", () => {
    expect(silverBulletsOwnError("[Client] Error while dispatching event document:index : Error: Request timed out after 30000ms")).toBe(true);
    expect(silverBulletsOwnError("Error dispatching event document:index to index.indexDocument: Request timed out after 30000ms")).toBe(true);
    expect(
      silverBulletsOwnError(
        "[Client] Error during : TypeError: Cannot read properties of undefined (reading 'dispatch')\n    at commandsUpdated (http://127.0.0.1:3010/.client/client.js:228:14900)\n    at Bc.emit (http://127.0.0.1:3010/.client/client.js:92:11944)",
      ),
    ).toBe(true);
  });

  it("are not a plugin's errors, nor the same message from elsewhere", () => {
    expect(silverBulletsOwnError("TypeError: Cannot read properties of undefined (reading 'dispatch')\n    at draw (http://127.0.0.1:3010/.fs/Library/damesene/silverware-database.js:1:200)")).toBe(false);
    expect(silverBulletsOwnError("Silverware Database: the view failed")).toBe(false);
    expect(silverBulletsOwnError("Failed to load resource: the server responded with a status of 404 (Not Found)")).toBe(false);
  });
});
