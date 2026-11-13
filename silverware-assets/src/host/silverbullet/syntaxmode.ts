// SilverBullet's elements its markdown shown as written is followed by (shared/syntaxmode.ts; 2.12.1,
// `client/codemirror/clean.ts`, `pluginsNeededEvenWhenRenderingSyntax`: an embed's widget and a custom syntax's are
// drawn in that mode still, anew as it changes): its widgets, the editor's text and what in it is no text of the page
import type { SyntaxModePage } from "../../../../shared/syntaxmode.ts";

export const SILVERBULLET_SYNTAX_PAGE: SyntaxModePage = {
  widgets: ".sb-inline-content, .sb-lua-directive-block",
  text: "#sb-main .cm-content",
  notText: '[contenteditable="false"], .sb-lua-directive-block, .sb-inline-content, .cm-widgetBuffer',
};

/** The UI option telling whether SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax Rendering) */
export const SYNTAX_OPTION = "markdownSyntaxRendering";
