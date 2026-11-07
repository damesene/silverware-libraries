// The built-in views, in the switcher's order: made through the view API alone,
// as a user's view is (views import only types from the core: isolation.test.ts).
import type { ViewDefinition } from "../../core/view.ts";
import { KANBAN_VIEW } from "./kanban.ts";
import { LIST_VIEW } from "./list.ts";
import { TABLE_VIEW } from "./table.ts";

export const BUILT_IN_VIEWS: readonly ViewDefinition[] = [TABLE_VIEW, LIST_VIEW, KANBAN_VIEW];
