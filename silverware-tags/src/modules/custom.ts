// The custom module: the user's own operations (custom.ts, given from Space
// Lua with silverware.tags.defineOperations) as actions on a tag, after the
// built-in ones; off, none is offered (their definitions are kept).
import type { ModuleHost, TagsModule } from "../core/module.ts";
import { customActions } from "../custom.ts";

export function customModule(_host: ModuleHost): TagsModule {
  return {
    // Asked for each time a tag is shown: definitions made later count
    tagActions: () => customActions(),
  };
}
