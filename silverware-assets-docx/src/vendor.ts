// docx-preview (with JSZip) as a file of its own beside Silverware Assets DOCX's bundle (silverware-assets-docx-docxpreview.js, built
// by scripts/build.mjs), loaded the first time a document is drawn (src/load.ts): never imported by the bundle itself.
export { renderAsync } from "docx-preview";
