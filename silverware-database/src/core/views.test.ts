import { describe, expect, it } from "vitest";
import type { ViewDefinition } from "./view.ts";
import { validateView } from "./views.ts";

const VIEW: ViewDefinition = { name: "mine", label: "Mine", icon: "M", render: () => {} };

describe("a view's definition", () => {
  it("takes properties as false or { hiddenByDefault }, colors as false, and says what else is wrong", () => {
    expect(validateView(VIEW)).toBeUndefined();
    expect(validateView({ ...VIEW, properties: false, colors: false })).toBeUndefined();
    expect(validateView({ ...VIEW, properties: { hiddenByDefault: true } })).toBeUndefined();
    expect(validateView({ ...VIEW, properties: null as unknown as false })).toMatch(/its properties is false or \{ hiddenByDefault/);
    expect(validateView({ ...VIEW, properties: { hiddenByDefault: "yes" } as unknown as false })).toMatch(/its properties/);
    expect(validateView({ ...VIEW, colors: true as unknown as false })).toMatch(/its colors is false/);
  });
});
