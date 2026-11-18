// Embedded media decorated (docs/silverware-assets.md): the host draws an embed (SilverBullet its widget, its
// own <img>, <video>, <object>, or "Unsupported content"); each drawn is found in the page's text (its target, its
// order among those of the same target), its type matched, its view chosen, and it is left as the host drew it (a view
// the type renders none of), replaced by the type's rendering, or by the card. A click on a card or a preview runs the
// action the user set for it. A render that fails shows the host's drawing (else the card) with an error mark.
import { type ActionContext, type Asset, assetName, type AssetType, type Capabilities, type RenderContext, type Viewport } from "../../shared/assets.ts";
import { type Embed, type EmbedChanges, embedAsLink, isFileTarget, type Link, linkAsEmbed, linkAsText, linkWithText, readEmbeds, readLinks, writeEmbed } from "../../shared/markdown/embed.ts";
import { renamable } from "./core/rename.ts";
import { actionFor, mimeOf, typeFor, viewFor } from "./core/choose.ts";
import { closestContext, embedAt, type LineContext, linkAt, outside, placeAmong, type Placed, type Range, sameTarget, writtenContext } from "./core/locate.ts";
import { metadataOf } from "./core/metadata.ts";
import { forgetPreviews, type PreviewFiles, storedPreview } from "./core/stored.ts";
import type { AssetRegistry } from "./core/registry.ts";
import { type AssetSettings, fullHeight, type Gesture, insertAsFor, labelFor, previewSize, type View, VIEWS } from "./model/settings.ts";
import { addCardFields, dateText, drawCard, iconElement, markFailed, menuMarker, sizeText } from "./ui/card.ts";
import { drawLabelLine, labelTexts, type LabelValues } from "./ui/label.ts";
import { opensMenu } from "../../shared/popupmenu.ts";
import { writeClipboard, writeClipboardLater } from "../../shared/clipboard.ts";
import { addMoreButton, type MoreMenu, popupOf, type ShowAs } from "./ui/moremenu.ts";
import { VIEW_CARD, VIEW_FULL, VIEW_LINK, VIEW_PREVIEW } from "../../shared/glyphs.ts";
import type { EditorEmbed, EmbedEdit, FieldDrawing } from "../../shared/editor.ts";
import { CONTENT_SCALE, scaledPx } from "../../shared/contentscale.ts";
import { hasPlainMedium, plainMedium } from "./ui/plainmedium.ts";
import type { InsertType } from "./ui/insertdialog.ts";
import type { SheetArea } from "../../shared/sheetarea.ts";
import { Dialogs } from "../../shared/dialog.ts";
import { DIALOG_LOOK } from "./ui/dialoglook.ts";
import { openRenameDialog } from "./ui/renamedialog.ts";

// The popup menu's classes: Silverware Assets'
const POPUP = { base: "swa" } as const;
// How long a burst of types registered is waited out before a file in an editor's field is drawn again (ms)
const TYPES_SETTLE_MS = 50;
// The highest a file is drawn in the insert dialog (px)
const SAMPLE_HEIGHT = 320;
/** An item of a file's menu */
type MenuItem = { readonly label: string; readonly run: () => void };
// How a file can be shown, as a file's menu names and draws each (docs/silverware-assets-menu.md)
const VIEW_NAMES: Readonly<Record<View, string>> = { card: "Card", preview: "Preview", full: "Full" };
const VIEW_ICONS: Readonly<Record<View, string>> = { card: VIEW_CARD, preview: VIEW_PREVIEW, full: VIEW_FULL };

/** An embed as the host drew it: its frame, its target as drawn (a path of the space or a URL), its own media element */
export type DrawnEmbed = {
  readonly frame: HTMLElement;
  readonly target: string;
  readonly native: HTMLElement | undefined;
  // Where it is in the page, where the host knows (a medium in markdown rendered outside the editor: as told by the one drawing it)
  readonly position?: () => number | undefined;
  // The box it is drawn in, where it is not the page's text (a grid's cell): a width given to it a share of that
  readonly room?: () => HTMLElement | undefined;
  // Its file's size and date where they are known already (a file not written yet, drawn in the insert dialog): not
  // asked of the host
  readonly info?: FileInfo;
};

/** A link drawn by the host (`[[report.pdf]]`, `[the report](report.pdf)`): its element, its target as written, its form */
export type DrawnLink = {
  readonly element: HTMLElement;
  readonly target: string;
  readonly style: "wiki" | "markdown";
  // Where it is in the page, where the host knows (a link in markdown rendered outside the editor)
  readonly position?: () => number | undefined;
};

/** An embed or a link to write as the other, found by its text as read and its place among those alike */
export type FormWrite = { readonly text: string; readonly occurrence: number; readonly of: number };

/** A file's size in bytes and when it was last changed (a time the host gives: an ISO text or milliseconds) */
export type FileInfo = { readonly size?: number; readonly modified?: string | number };

/** An embed to write: found by its text as read and its place among those alike */
export type EmbedWrite = { readonly text: string; readonly occurrence: number; readonly of: number; readonly changes: EmbedChanges };

/** What the assets ask of the host whose page they are in */
export type AssetHost = {
  /** Told of the embeds drawn, those there now and each drawn after */
  watch(drawn: (embeds: readonly DrawnEmbed[]) => void): unknown;
  /** Told of the links drawn, those there now and each drawn after (none: links are not decorated) */
  watchLinks?(drawn: (links: readonly DrawnLink[]) => void): unknown;
  /** A link's asset, where it links a file of the space (a page, a site: none) */
  linkAsset?(link: DrawnLink, page: string): Asset | undefined;
  /** The ranges of the page's text (as read) rendered outside the editor (a grid's), drawn now or not: their embeds are no widget of the host's */
  renderedRanges(text: string): readonly Range[];
  /** How far down the page an element of the host's is (0 its top, 1 its end; none: not known), a widget's place where several fit */
  placeOf?(element: HTMLElement): number | undefined;
  /** The text drawn around a widget of the host's or a link in its text (the lines before, a link's own, after); none: not known */
  contextOf?(element: HTMLElement): LineContext | undefined;
  /** Where a widget of the host's or a link in its text is in the page's text, where the host can say (checked against the text before it is taken) */
  positionOf?(element: HTMLElement): number | undefined;
  pageText(): Promise<string>;
  pageName(): Promise<string>;
  /** An embed's target as the host draws it (resolved from the page), to find a drawn one by */
  resolved(embed: Embed, page: string): string;
  /** An embed's asset */
  assetOf(embed: Embed, page: string): Asset;
  settings(): Promise<AssetSettings>;
  /** A file's size (bytes) and when it was last changed, where the host knows them (its card shows them) */
  fileInfo?(asset: Asset): Promise<FileInfo | undefined>;
  writeEmbed(write: EmbedWrite): Promise<string | undefined>;
  /** An embed written as a link to its file, a link as an embed of it (none: neither is offered); why not, as text */
  embedToLink?(write: FormWrite): Promise<string | undefined>;
  linkToEmbed?(write: FormWrite & { readonly changes?: EmbedChanges }): Promise<string | undefined>;
  /**
   * A file of the space deleted, and its embed taken out of the page (a link to it written as its text), each found as
   * `embedToLink` finds it; asked first (`confirm`). None: no Delete in the menus. Why not, as text
   */
  deleteFile?(path: string): Promise<string | undefined>;
  removeEmbed?(write: FormWrite): Promise<string | undefined>;
  linkToText?(write: FormWrite): Promise<string | undefined>;
  /** A link given another text it shows (`shown`), found as `linkToText` finds it (none: a link in the page has no Rename) */
  writeLinkText?(write: FormWrite & { readonly shown: string }): Promise<string | undefined>;
  /**
   * A file of the space renamed, the links to it in every page written anew (SilverBullet's own rename of a document);
   * none: Rename sets a title alone. Why not, as text
   */
  renameFile?(from: string, to: string): Promise<string | undefined>;
  /** The space's files' paths (a name another file has, refused by Rename) */
  filePaths?(): Promise<readonly string[]>;
  confirm?(question: string): Promise<boolean>;
  /** The space's files a preview is kept in (core/stored.ts; none: previews made each time) */
  previewFiles?: PreviewFiles;
  open(url: string): void;
  /** Where a panel beside the page goes (none: the window) */
  readonly sheetArea?: SheetArea;
  problem(message: string): void;
};

const NATIVE_HIDDEN = "swa-native-hidden";
// The host's medium of a file (its image, video, PDF's viewer), marked: what the style page zooms with the content's
// scale, never a picture a type draws inside its own (a document's)
const MEDIUM = "swa-medium";
// A preview a type draws (its own element), shown as a picture is (the style page)
const PREVIEW_FACE = "swa-preview-face";
// What shows a document of its own, taking the clicks on it (a PDF's viewer)
const DOCUMENT_VIEWERS = "object, iframe, embed";
const LINK_ICON = "swa-link-icon";
/** A frame's width and alignment as its embed keeps them, how each is written */
type FramePlace = {
  readonly width: string | undefined;
  readonly align: string | undefined;
  readonly write: (width: string | undefined) => Promise<string | undefined>;
  readonly writeAlign: (align: string | undefined) => Promise<string | undefined>;
};

/** How a linked file's menu writes what it changes where the link is (the page's, a field's text) */
type LinkWrites = {
  // The link written as an embed of its file, of a view (none: the settings' own); none: no Show as
  readonly toEmbed?: (view: View | undefined) => void;
  // The link's markdown as written now
  readonly markdown: () => Promise<string>;
  // The file deleted, asked first, the link written as its text after; none: no Delete
  readonly deleteFile?: (asset: Asset & { readonly kind: "file" }) => void;
  // Rename…: its text and its file's name, asked; none: no Rename
  readonly rename?: () => void;
};

export class AssetDecorator {
  // Each frame decorated: what ends its render
  private readonly renders = new WeakMap<HTMLElement, AbortController>();
  // Each frame decorated: its width as its embed keeps it, where it stays as it changes, how a new one is written
  private readonly sizes = new WeakMap<HTMLElement, FramePlace>();
  // Each frame decorated, as the host drew it (decorated again as the settings change)
  private readonly drawn = new WeakMap<HTMLElement, DrawnEmbed>();
  // Embeds drawn in an editor's field that gives their markdown to edit (a grid's cell edited): no frame of the page's
  private readonly fieldDrawn = new WeakMap<HTMLElement, DrawnEmbed>();
  // The links decorated, each element as its host told it last (its place in the page may be another: what its menu
  // acts on; decorated again as the settings change, those gone from the page left out then)
  private readonly links = new Map<HTMLElement, DrawnLink>();
  // Each link's menu: what ends it (its icon drawn again, or the link gone)
  private readonly linkMenus = new WeakMap<HTMLElement, AbortController>();
  // What each link was decorated with (its file, its type, the settings its icon and menu are of): decorated again with
  // the same, as the files are drawn again for a type another plugin registered, it is left as it is (its menu open
  // stays open: it closed with the arrow taken away under the pointer)
  private readonly linkDecorated = new WeakMap<HTMLElement, { readonly asset: string; readonly type: AssetType; readonly settings: string }>();
  // What each frame was drawn with (its file, its type, its embed's markdown, the settings), alike: as the files are
  // drawn again for a type another plugin registered, one drawn the same is left as it is (its "…" menu open stays open)
  private readonly frameDecorated = new WeakMap<
    HTMLElement,
    { readonly asset: string; readonly type: AssetType; readonly embed: string; readonly settings: string }
  >();
  // The frames whose preview is to be made anew as they are drawn next (Regenerate preview)
  private readonly anew = new WeakSet<HTMLElement>();
  /** Told as a frame is decorated (its width laid out again) */
  onDecorated: (() => void) | undefined;
  private started = false;

  constructor(
    private readonly doc: Document,
    private host: AssetHost,
    private readonly registry: AssetRegistry,
  ) {}

  useHost(host: AssetHost): void {
    this.host = host;
  }

  /** Decorating from now on (once per document) */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.host.watch((drawn) => void this.decorate(drawn));
    this.host.watchLinks?.((links) => void this.decorateLinks(links));
  }

  /** Links drawn: each to a file of the space given its type's icon before its text (where the user shows it) and a small arrow after it, which opens its menu */
  async decorateLinks(links: readonly DrawnLink[]): Promise<void> {
    if (!links.length || !this.host.linkAsset) return;
    const [page, settings] = await Promise.all([this.host.pageName(), this.host.settings()]);
    const settingsKey = JSON.stringify(settings);
    for (const element of this.links.keys()) {
      if (element.isConnected) continue;
      this.links.delete(element);
      this.linkMenus.get(element)?.abort();
    }
    for (const link of links) {
      this.links.set(link.element, link);
      const asset = this.host.linkAsset(link, page);
      const type = asset && typeFor(this.registry.types.all, asset);
      const assetKey = asset && JSON.stringify(asset);
      // Decorated with the same, whole, its menu live: left as it is
      const was = this.linkDecorated.get(link.element);
      const live = this.linkMenus.get(link.element)?.signal.aborted === false;
      const whole =
        !!link.element.querySelector(":scope > .swa-menu-marker") &&
        link.element.getAttribute("data-swa-link") === type?.name &&
        (!settings.link.fields.includes("icon") || !!link.element.querySelector(`:scope > .${LINK_ICON}`));
      if (type && was && live && whole && was.asset === assetKey && was.type === type && was.settings === settingsKey) continue;
      // (Its arrow kept, its menu bound to it anew: one taken out between a press's mousedown and its click made the
      // click the link's, which followed it)
      const keptMarker = type ? link.element.querySelector<HTMLElement>(":scope > .swa-menu-marker") : null;
      link.element.querySelectorAll(`:scope > :is(.${LINK_ICON}, .swa-menu-marker)`).forEach((one) => one !== keptMarker && one.remove());
      this.linkMenus.get(link.element)?.abort();
      this.linkDecorated.delete(link.element);
      link.element.removeAttribute("data-swa-link");
      if (!type) continue;
      this.linkDecorated.set(link.element, { asset: assetKey!, type, settings: settingsKey });
      // Its type's icon before it (where the user shows it), a picture alone; its menu's way in a small arrow after it,
      // always (an icon that opened the menu was found by nobody new: docs/silverware-assets-menu.md, *The arrow*)
      if (settings.link.fields.includes("icon")) link.element.prepend(this.linkIcon(type));
      const marker = this.linkMarker(asset, keptMarker ?? undefined);
      if (marker !== link.element.lastElementChild) link.element.append(marker);
      link.element.setAttribute("data-swa-link", type.name);
      // Its menu: what can be done with the file (a press on the arrow the menu's, the link's text still the host's),
      // what it changes written into the page, the link found there as it is now
      const control = new AbortController();
      this.linkMenus.set(link.element, control);
      const now = () => this.links.get(link.element) ?? link;
      const menu = () =>
        this.linkMenu(asset, type, settings, control.signal, {
          ...(this.host.linkToEmbed ? { toEmbed: (view: View | undefined) => void this.toEmbed(now(), view) } : {}),
          markdown: () =>
            this.linkInPage(now()).then((found) => {
              if (!found) throw new Error("this link was not found in the page");
              return found.link.text;
            }),
          ...(this.deletable(asset, "link") ? { deleteFile: (file: Asset & { readonly kind: "file" }) => void this.deleteLinked(now(), file) } : {}),
          ...(this.host.writeLinkText ? { rename: () => void this.renameLinked(now(), asset) } : {}),
        });
      opensMenu(this.doc, POPUP, marker, () => popupOf(menu()), control.signal);
    }
  }

  /** A link's type's icon, drawn before its text: a picture alone (its menu is the arrow's) */
  private linkIcon(type: AssetType): HTMLElement {
    const icon = iconElement(this.doc, type.icon);
    icon.classList.add(LINK_ICON);
    return icon;
  }

  /** A link's way into its file's menu: a small arrow, drawn after its text */
  private linkMarker(asset: Asset, kept?: HTMLElement): HTMLElement {
    const marker = kept ?? menuMarker(this.doc, "link");
    marker.setAttribute("aria-label", `${assetName(asset)}: its menu`);
    marker.title = "Show…";
    marker.setAttribute("role", "button");
    return marker;
  }

  /**
   * A linked file's menu (docs/silverware-assets-menu.md), in the page or in a field: how it is shown (an embed of a
   * view chosen in its place, written at once: `toEmbed`, the settings' own as none), what can be done with it, its
   * markdown copied, the file deleted; what changes the link written where it is (`writes`: the page's, a field's)
   */
  private linkMenu(asset: Asset, type: AssetType, settings: AssetSettings, signal: AbortSignal, writes: LinkWrites): MoreMenu {
    // (What it can be shown as, as an embed of it can: a view its type draws, or any where the browser draws the file, a
    // preview its drawing smaller; an image of the space has no preview of its type's own, and still has one)
    const native = !!plainMedium(this.doc, asset, mimeOf(asset));
    const capabilities: Capabilities = { views: ["card", ...(type.views?.preview || native ? (["preview"] as const) : []), ...(type.views?.full || native ? (["full"] as const) : [])] };
    const actions = this.actionItems(asset, capabilities, (container, as) => this.drawInto(container, as, type, asset, settings, signal));
    const settled = settings.views.types[type.name] ?? settings.views.default;
    const { toEmbed, deleteFile } = writes;
    return {
      title: assetName(asset),
      showAs: toEmbed
        ? this.showAs("link", settled, (view) => capabilities.views.includes(view), true, (to) => {
            if (to !== "link") toEmbed(to === settled ? undefined : to);
          })
        : [],
      page: writes.rename ? [{ label: "Rename…", run: writes.rename }] : [],
      open: actions.open,
      file: [
        ...actions.copy,
        // Its whole markdown, as it is written now
        {
          label: "Copy markdown",
          // (Read first where it must be found: the clipboard given the text as it comes, the click's leave kept)
          run: () => void writeClipboardLater(this.doc, writes.markdown()).catch((error: unknown) => this.host.problem(`Silverware Assets: not copied: ${message(error)}`)),
        },
        ...actions.file,
      ],
      destructive: deleteFile && asset.kind === "file" ? [{ label: "Delete file…", run: () => deleteFile(asset) }] : [],
    };
  }

  /** Whether a file can be deleted here: a file of the space (not a URL), the host deleting files and taking its embed or link out after */
  private deletable(asset: Asset, from: "embed" | "link"): asset is Asset & { readonly kind: "file" } {
    return asset.kind === "file" && !!this.host.deleteFile && !!this.host.confirm && !!(from === "embed" ? this.host.removeEmbed : this.host.linkToText);
  }

  /**
   * Whether the user means a file deleted: asked plainly that the file itself goes from the space, for good, not only
   * this embed or link; what is left in the page said too
   */
  private confirmDelete(asset: Asset & { readonly kind: "file" }, from: "embed" | "link"): Promise<boolean> {
    const what = from === "embed" ? "This embed is removed from the page." : "This link is replaced by its text.";
    return this.host.confirm!(
      `Delete the file "${asset.path}" from your space? The file itself is deleted, not only this ${from}: it cannot be brought back. ${what} Other pages that embed or link it will show it missing.`,
    );
  }

  /**
   * A file deleted, and its previews kept in the space with it (core/stored.ts): its version read before (a file gone
   * has none), its previews taken away once it is deleted. Why the file was not deleted, as text
   */
  private async deleteWithPreviews(path: string): Promise<string | undefined> {
    const files = this.host.previewFiles;
    const facts = files ? await files.facts(path).catch(() => undefined) : undefined;
    const problem = await this.host.deleteFile!(path);
    if (!problem && files && facts) await forgetPreviews(files, (await this.host.settings()).previewFolder, path, facts);
    return problem;
  }

  /**
   * An embedded file deleted, once confirmed: its embed found in the page first (the host may draw it anew, missing,
   * once the file is gone: its widget no longer told where it is), then the file deleted, then the embed taken out
   */
  private async deleteEmbedded(drawn: DrawnEmbed, asset: Asset & { readonly kind: "file" }): Promise<void> {
    if (!(await this.confirmDelete(asset, "embed"))) return;
    const now = await this.locateNow(drawn);
    if (!now) return this.host.problem(`Silverware Assets: the file was not deleted: ${NOT_FOUND}`);
    const problem = await this.deleteWithPreviews(asset.path);
    if (problem) return this.host.problem(`Silverware Assets: the file was not deleted: ${problem}`);
    const left = await this.host.removeEmbed!({ text: now.embed.text, occurrence: now.occurrence, of: now.of });
    if (left) this.host.problem(`Silverware Assets: the file was deleted, its embed not taken out of the page: ${left}`);
  }

  /** An embed taken out of the page, its file left as it is (undone as any edit): found as it is now first */
  private async removeFromPage(drawn: DrawnEmbed): Promise<void> {
    const now = await this.locateNow(drawn);
    if (!now) return this.host.problem(`Silverware Assets: not removed: ${NOT_FOUND}`);
    const problem = await this.host.removeEmbed!({ text: now.embed.text, occurrence: now.occurrence, of: now.of });
    if (problem) this.host.problem(`Silverware Assets: not removed: ${problem}`);
  }

  /**
   * A file embedded or linked in a field deleted, once confirmed: the file, then its embed taken out of the field's text,
   * its link written as its text (`takeOut`)
   */
  private async deleteInField(asset: Asset & { readonly kind: "file" }, from: "embed" | "link", takeOut: () => string | undefined): Promise<void> {
    if (!(await this.confirmDelete(asset, from))) return;
    const problem = await this.deleteWithPreviews(asset.path);
    if (problem) return this.host.problem(`Silverware Assets: the file was not deleted: ${problem}`);
    const left = takeOut();
    if (left) this.host.problem(`Silverware Assets: the file was deleted, its ${from} left in the field: ${left}`);
  }

  /** Whether a file can be deleted from a field: a file of the space, the host deleting files (the field's text written by the field) */
  private deletableInField(asset: Asset): asset is Asset & { readonly kind: "file" } {
    return asset.kind === "file" && !!this.host.deleteFile && !!this.host.confirm;
  }

  /** A linked file deleted, once confirmed: its link found first (as Show as embedded finds it), the file deleted, the link written as its text */
  private async deleteLinked(link: DrawnLink, asset: Asset & { readonly kind: "file" }): Promise<void> {
    if (!(await this.confirmDelete(asset, "link"))) return;
    const found = await this.linkInPage(link);
    if (!found) return this.host.problem("Silverware Assets: the file was not deleted: this link was not found in the page");
    const problem = await this.deleteWithPreviews(asset.path);
    if (problem) return this.host.problem(`Silverware Assets: the file was not deleted: ${problem}`);
    const left = await this.host.linkToText!({ text: found.link.text, occurrence: found.occurrence, of: found.of });
    if (left) this.host.problem(`Silverware Assets: the file was deleted, its link left in the page: ${left}`);
  }

  /** Its dialogs (Rename), made as the first opens */
  private dialogsMade?: Dialogs;
  private get dialogs(): Dialogs {
    return (this.dialogsMade ??= new Dialogs(this.doc, DIALOG_LOOK));
  }

  /**
   * Rename… (docs/silverware-assets-rename.md): the dialog asked, then what changed written. The title alone: written
   * where the embed or the link is (`writeTitle`). The file's name: the file renamed first (SilverBullet saves the page
   * and rewrites every reference to it by its index, which a title written just before could have outrun), its previews
   * kept taken away (of the old path's version), then the title written to the same reference once the page refers to
   * the new path (`inPage.titleAt`). In a field (none `inPage`) the title alone: the field holds its own text meanwhile,
   * which SilverBullet's rewrite of the page would not reach
   */
  private rename(asset: Asset, renaming: Renaming): void {
    const { of, title, inPage } = renaming;
    const { alt: _alt, ...bare } = asset;
    const why =
      asset.kind !== "file"
        ? "A file of the web: its name is the site's."
        : !inPage
          ? "Its file is renamed from its menu in the page, not while this is edited."
          : !this.host.renameFile
            ? "This SilverBullet gives no way to rename a file here."
            : !renamable(asset.path)
              ? "SilverBullet renames no file without an extension of letters and digits."
              : undefined;
    const file = asset.kind === "file" && !why ? { path: asset.path, paths: async () => (await this.host.filePaths?.()) ?? [] } : undefined;
    const said = (problem: string) => this.host.problem(`Silverware Assets: ${problem}`);
    const what = of === "link" ? "text" : "title";
    openRenameDialog(this.doc, this.dialogs, { of, title, untitled: assetName(bare as Asset), ...(file ? { file } : { why: why! }), companion: !!renaming.companion }, (result) => {
      if (!result) return;
      void (async () => {
        const titled = result.title !== title.trim();
        if (!result.path || asset.kind !== "file" || !inPage) {
          const problem = titled ? await renaming.writeTitle(result.title) : undefined;
          return problem && said(`the ${what} was not written: ${problem}`);
        }
        // (Its place among the references to its file, found before they are rewritten)
        const order = titled ? await inPage.order() : undefined;
        if (titled && order === undefined) return said(`nothing was renamed: this ${of} was not found in the page`);
        const files = this.host.previewFiles;
        const facts = files ? await files.facts(asset.path).catch(() => undefined) : undefined;
        const problem = await this.host.renameFile!(asset.path, result.path);
        if (problem) return said(`the file was not renamed: ${problem}`);
        if (files && facts) await forgetPreviews(files, (await this.host.settings()).previewFolder, asset.path, facts);
        const left = titled ? await inPage.titleAt(result.path, order!, result.title) : undefined;
        if (left) said(`the file was renamed, its ${what} not written: ${left}`);
      })().catch((error: unknown) => said(message(error)));
    });
  }

  /**
   * The `order`-th reference to a file (`refs`: its embeds, or its links) once the page refers to it by `path`, its
   * new path: read again until SilverBullet's rename has rewritten them (at most RENAMED_WAIT_MS), `write` given it and
   * the page's text then
   */
  private async atRenamed<T>(refs: (text: string, page: string) => readonly T[], order: number, write: (one: T, text: string) => Promise<string | undefined>): Promise<string | undefined> {
    const until = Date.now() + RENAMED_WAIT_MS;
    for (;;) {
      const [text, page] = await Promise.all([this.host.pageText(), this.host.pageName()]);
      const one = refs(text, page)[order];
      if (one) return write(one, text);
      if (Date.now() > until) return "the page did not refer to it by its new name in time";
      await new Promise((resolve) => setTimeout(resolve, RENAMED_POLL_MS));
    }
  }

  /** A page's embeds of a file, in their order */
  private embedsOf(text: string, page: string, path: string): Embed[] {
    return readEmbeds(text).filter((one) => this.host.resolved(one, page) === path);
  }

  /** A page's links to a file, in their order (resolved as `link`, a link drawn, is) */
  private linksOf(text: string, page: string, path: string, link: DrawnLink): Link[] {
    return readLinks(text).filter((one) => {
      const asset = this.host.linkAsset?.({ element: link.element, target: one.target, style: one.style }, page);
      return asset?.kind === "file" && asset.path === path;
    });
  }

  /** Rename… of an embed: its title written where it is (`write`: in the page, or in a field, where its file is not renamed) */
  private renameEmbedded(drawn: DrawnEmbed, found: Found, asset: Asset, write: (changes: EmbedChanges) => Promise<string | undefined>, fieldEdit?: EmbedEdit): void {
    const alt = (title: string): EmbedChanges => ({ alt: title || null });
    this.rename(asset, {
      of: "embed",
      title: found.embed.alt,
      writeTitle: (title) => write(alt(title)),
      companion: !!fieldEdit,
      ...(!fieldEdit && asset.kind === "file"
        ? {
            inPage: {
              order: async () => {
                const now = await this.locateNow(drawn);
                if (!now) return undefined;
                const [text, page] = await Promise.all([this.host.pageText(), this.host.pageName()]);
                const at = this.embedsOf(text, page, asset.path).findIndex((one) => one.from === now.embed.from);
                return at < 0 ? undefined : at;
              },
              titleAt: (path, order, title) =>
                this.atRenamed(
                  (text, page) => this.embedsOf(text, page, path),
                  order,
                  (one, text) => {
                    const alike = readEmbeds(text).filter((other) => other.text === one.text);
                    return this.host.writeEmbed({ text: one.text, occurrence: alike.findIndex((other) => other.from === one.from), of: alike.length, changes: alt(title) });
                  },
                ),
            },
          }
        : {}),
    });
  }

  /** Rename… of a link in the page: its text as written now, written back where the link is then */
  private async renameLinked(link: DrawnLink, asset: Asset): Promise<void> {
    const found = await this.linkInPage(link);
    if (!found) return this.host.problem("Silverware Assets: this link was not found in the page");
    const write = (one: Link, text: string, shown: string) => {
      const alike = readLinks(text).filter((other) => other.text === one.text);
      return this.host.writeLinkText!({ text: one.text, occurrence: alike.findIndex((other) => other.from === one.from), of: alike.length, shown });
    };
    this.rename(asset, {
      of: "link",
      title: found.link.alias,
      writeTitle: async (shown) => {
        const now = await this.linkInPage(link);
        return now ? this.host.writeLinkText!({ text: now.link.text, occurrence: now.occurrence, of: now.of, shown }) : "this link was not found in the page";
      },
      ...(asset.kind === "file"
        ? {
            inPage: {
              order: async () => {
                const now = await this.linkInPage(link);
                if (!now) return undefined;
                const [text, page] = await Promise.all([this.host.pageText(), this.host.pageName()]);
                const at = this.linksOf(text, page, asset.path, link).findIndex((one) => one.from === now.link.from);
                return at < 0 ? undefined : at;
              },
              titleAt: (path, order, shown) => this.atRenamed((text, page) => this.linksOf(text, page, path, link), order, (one, text) => write(one, text, shown)),
            },
          }
        : {}),
    });
  }

  /** A link written as an embed of its file: found in the page by its place, else by its target and its order among the links drawn of it */
  private async toEmbed(link: DrawnLink, view?: View): Promise<void> {
    const found = await this.linkInPage(link);
    if (!found) return this.host.problem("Silverware Assets: this link was not found in the page");
    const problem = await this.host.linkToEmbed!({ text: found.link.text, occurrence: found.occurrence, of: found.of, ...(view ? { changes: { metadata: { view } } } : {}) });
    if (problem) this.host.problem(`Silverware Assets: not written: ${problem}`);
  }

  /** A link drawn found in the page as it is now: by its place, else where the host says, else by the text around it and the run of links drawn */
  private async linkInPage(link: DrawnLink): Promise<{ readonly link: ReturnType<typeof readLinks>[number]; readonly occurrence: number; readonly of: number } | undefined> {
    const text = await this.host.pageText();
    const links = readLinks(text);
    const at = link.position?.();
    let found = at !== undefined ? linkAt(links, at) : undefined;
    // An editor's link where the host says it is, a link of its target and form starting there (or within it)
    const told = at === undefined ? this.host.positionOf?.(link.element) : undefined;
    const there = told === undefined ? undefined : outside(links, this.host.renderedRanges(text)).find((one) => told >= one.from && told < one.to && one.style === link.style && sameTarget(one.target) === sameTarget(link.target));
    if (there) {
      const sameText = links.filter((other) => other.text === there.text);
      found = { link: there, occurrence: sameText.indexOf(there), of: sameText.length };
    } else if (at === undefined) {
      // The editor's links of its form drawn now, in the page's order: a run of those of the text (as a widget's, above)
      const drawn = [...this.links.values()].filter((one) => one.element.isConnected && !one.position && one.style === link.style);
      drawn.sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const editorLinks = outside(links, this.host.renderedRanges(text)).filter((one) => one.style === link.style);
      const inText = editorLinks.map((one): Placed => ({ target: sameTarget(one.target), at: one.from / Math.max(text.length, 1) }));
      // (Told apart by the text of its line and those around it, else by the run of them drawn)
      const index =
        this.byContext(link.element, sameTarget(link.target), inText, editorLinks, true, text) ??
        placeAmong(
          drawn.map((one): Placed => ({ target: sameTarget(one.target), at: this.host.placeOf?.(one.element) ?? 0 })),
          drawn.indexOf(link),
          inText,
        );
      const one = index === undefined ? undefined : editorLinks[index];
      if (one) {
        const sameText = links.filter((other) => other.text === one.text);
        found = { link: one, occurrence: sameText.indexOf(one), of: sameText.length };
      }
    }
    return found;
  }

  /** What can be done with an asset: each fitting action registered (its menu's), run with how it is drawn elsewhere */
  private actionItems(
    asset: Asset,
    can: Capabilities,
    render: (container: HTMLElement, as: "preview" | "full") => Promise<void>,
  ): { readonly open: MenuItem[]; readonly copy: MenuItem[]; readonly file: MenuItem[] } {
    const items = this.registry.actions.all
      .filter((action) => action.fits(asset, can))
      .map((action) => ({
        group: action.group ?? "open",
        // (A copy first in the file's section, as Copy markdown is)
        copy: action.name.startsWith("copy"),
        label: action.label ?? action.name,
        run: () => {
          const context: ActionContext = { asset, open: (url) => this.host.open(url), render: (as, container) => render(container, as), sheetArea: this.host.sheetArea };
          void Promise.resolve(action.run(context)).catch((error: unknown) => this.host.problem(`Silverware Assets: ${action.name}: ${message(error)}`));
        },
      }));
    const plain = ({ label, run }: (typeof items)[number]) => ({ label, run });
    const file = items.filter((item) => item.group === "file");
    // (The file's section: its copies first, Copy markdown among them, then the rest)
    return {
      open: items.filter((item) => item.group !== "file").map(plain),
      copy: file.filter((item) => item.copy).map(plain),
      file: file.filter((item) => !item.copy).map(plain),
    };
  }

  /**
   * How a file can be shown in the page, as the menu's row (docs/silverware-assets-menu.md): a link (where the host
   * writes one), a card, a preview, the file shown full; the one shown active, the settings' own named "(default)", one it
   * cannot be shown as disabled. `choose` writes the one chosen (a view: the settings' own as none)
   */
  private showAs(shown: View | "link", settled: View, can: (view: View) => boolean, linkable: boolean, choose: (to: View | "link") => void): ShowAs[] {
    const views = VIEWS.map((one) => ({
      view: one as View | "link",
      title: `${VIEW_NAMES[one]}${one === settled ? " (default)" : ""}`,
      icon: VIEW_ICONS[one],
      active: one === shown,
      ...(can(one) ? {} : { disabled: "This file cannot be shown so" }),
      run: () => choose(one),
    }));
    return [...(linkable ? [{ view: "link" as const, title: "Link", icon: VIEW_LINK, active: shown === "link", run: () => choose("link") }] : []), ...views];
  }

  /** A link's asset drawn into a container of an action's: its type's view, else the plain medium of its kind, else its card */
  private async drawInto(container: HTMLElement, as: "preview" | "full", type: AssetType, asset: Asset, settings: AssetSettings, signal: AbortSignal): Promise<void> {
    const viewport: Viewport = {
      get width() {
        return container.clientWidth;
      },
      get height() {
        return settings[as].height;
      },
      onChange: () => undefined,
    };
    const element = await type.views?.[as]?.({ asset, viewport, metadata: metadataOf({}, async () => "a link keeps no metadata"), signal, placement: "inline", fills: true });
    container.replaceChildren(element ?? plainMedium(this.doc, asset, mimeOf(asset)) ?? this.card(type, asset, settings));
  }

  /**
   * What is drawn in an editor's field of a page's markdown (a grid's cell edited: shared/rendered.ts `FieldDrawer`; a
   * database's peek: the API's `fieldDrawing`), as the page draws it: its embeds, its file links' icons and arrows
   */
  fieldDrawing(page: string): FieldDrawing {
    return { embed: (markdown) => this.editorEmbed(markdown, page), linkIcon: (markdown) => this.editorLinkIcon(markdown, page), linkAfter: (markdown) => this.editorLinkMarker(markdown, page) };
  }

  /**
   * An embed in an editor of a page's markdown drawn as in the page: its view, size and label as the settings and its
   * metadata say; where the editor gives it its markdown to edit (`EmbedEdit`), its menu and a click's action as in the
   * page, what they change written into the editor's text (an Alt+press the editor's: its markdown shown); else
   * read-only. None for markdown that is not one embed alone, or of a file no type takes
   */
  editorEmbed(markdown: string, page: string): EditorEmbed | undefined {
    const embeds = readEmbeds(markdown);
    const embed = embeds[0];
    if (embeds.length !== 1 || !embed || embed.from !== 0 || embed.to !== markdown.length) return undefined;
    const asset = this.host.assetOf(embed, page);
    const type = typeFor(this.registry.types.all, asset);
    if (!type) return undefined;
    return {
      key: `${page}\n${markdown}`,
      interactive: true,
      draw: (container, signal, edit) => {
        const doc = container.ownerDocument;
        // (A frame of its own, as a medium drawn in a grid's cell has, its medium the browser's own where it has one:
        // nothing of the host's is drawn in an editor's field)
        const frame = doc.createElement("span");
        frame.className = "swa-frame";
        const native = plainMedium(doc, asset, mimeOf(asset));
        if (native) {
          // (Its size as its markdown gives it, as the page draws it)
          if (Number(embed.width)) native.style.width = `${Number(embed.width)}px`;
          if (Number(embed.height)) native.style.height = `${Number(embed.height)}px`;
          frame.append(native);
        }
        container.append(frame);
        // (Its room the block it is drawn in, the field's line: its width a share of it, as in the cell drawn)
        const drawn: DrawnEmbed = { frame, target: this.host.resolved(embed, page), native, room: () => blockAround(frame) };
        if (edit) this.fieldDrawn.set(frame, drawn);
        // Drawn by the type that takes it now: again as the types change (another plugin's registered after the field
        // was opened, Silverware Assets PDF's in place of the built-in one), a moment after a burst of them
        const draw = () =>
          void this.host
            .settings()
            .then((settings) => {
              if (signal.aborted) return;
              this.render(drawn, { embed, occurrence: 0, of: 1 }, asset, typeFor(this.registry.types.all, asset) ?? type, settings, signal, edit);
              // (Its width and alignment Silverware Layout's to show, now that they are known: read as it lays out again)
              if (edit) this.onDecorated?.();
            })
            .catch(() => undefined);
        draw();
        let soon: ReturnType<typeof setTimeout> | undefined;
        const stop = this.registry.onChange(() => {
          clearTimeout(soon);
          soon = setTimeout(draw, TYPES_SETTLE_MS);
        });
        signal.addEventListener("abort", () => (clearTimeout(soon), stop()));
      },
    };
  }

  /**
   * A link to a file in an editor of a page's markdown (none for markdown that is not one link alone, or not to a file a
   * type takes: a page's): what the page draws of it, its type's icon before its text (where the user shows it) and its
   * menu's way in after it, a small arrow
   */
  private fieldLink(markdown: string, page: string) {
    const links = readLinks(markdown);
    const link = links[0];
    if (links.length !== 1 || !link || link.from !== 0 || link.to !== markdown.length || !isFileTarget(link.target)) return undefined;
    // (Its file as an embed of it would have it: the link's own form, resolved the same way)
    const embed = readEmbeds(linkAsEmbed(link))[0];
    if (!embed) return undefined;
    const asset = this.host.assetOf(embed, page);
    const type = typeFor(this.registry.types.all, asset);
    if (!type) return undefined;
    return { link, embed, asset, type };
  }

  /** A link's type's icon in an editor, before its text, where the user shows it: a picture alone */
  editorLinkIcon(markdown: string, page: string): EditorEmbed | undefined {
    const found = this.fieldLink(markdown, page);
    if (!found) return undefined;
    return {
      key: `${page}\n${markdown}`,
      draw: (container, signal) =>
        void this.host
          .settings()
          .then((settings) => {
            if (signal.aborted || !settings.link.fields.includes("icon")) return;
            container.append(this.linkIcon(typeFor(this.registry.types.all, found.asset) ?? found.type));
          })
          .catch(() => undefined),
    };
  }

  /**
   * A link's way into its file's menu in an editor, after its text: a small arrow. Where the editor gives it the link's
   * markdown to edit, the menu as in the page, what it changes written into the editor's text (an embed in its place,
   * the link as its text once its file is deleted); else the arrow alone
   */
  editorLinkMarker(markdown: string, page: string): EditorEmbed | undefined {
    const found = this.fieldLink(markdown, page);
    if (!found) return undefined;
    const { link, embed, asset, type } = found;
    return {
      key: `${page}\n${markdown}\nmenu`,
      interactive: true,
      draw: (container, signal, edit) =>
        void this.host
          .settings()
          .then((settings) => {
            if (signal.aborted) return;
            const now = typeFor(this.registry.types.all, asset) ?? type;
            const marker = this.linkMarker(asset);
            container.append(marker);
            if (!edit) return;
            const inField = (written: string) => (edit.replace(written) ? undefined : NOT_FOUND);
            const notWritten = (problem: string | undefined) => problem && this.host.problem(`Silverware Assets: not written: ${problem}`);
            const menu = () =>
              this.linkMenu(asset, now, settings, signal, {
                toEmbed: (view) => notWritten(inField(view ? writeEmbed(embed, { metadata: { view } }) : embed.text)),
                markdown: async () => markdown,
                ...(this.deletableInField(asset) ? { deleteFile: (file: Asset & { readonly kind: "file" }) => void this.deleteInField(file, "link", () => inField(linkAsText(link))) } : {}),
                // (Its text alone: in a field its file is not renamed)
                rename: () => this.rename(asset, { of: "link", title: link.alias, writeTitle: (shown) => inField(linkWithText(link, shown)), companion: true }),
              });
            opensMenu(this.doc, POPUP, marker, () => popupOf(menu()), signal);
          })
          .catch(() => undefined),
    };
  }

  /**
   * What the insert dialog is told of a file's type (ui/insertdialog.ts): the type that takes it (none: the card's
   * alone), the views it can be drawn in, the one *Show as* gives it, how it is inserted as set, whether it is costly
   */
  insertTypeOf(file: File, path: string, settings: AssetSettings): InsertType {
    const asset: Asset = { kind: "file", path, url: "", ...(file.type ? { mime: file.type } : {}) };
    const type = typeFor(this.registry.types.all, asset);
    const native = hasPlainMedium(mimeOf(asset));
    const name = type?.name ?? "file";
    return {
      name,
      icon: type?.icon ?? "",
      can: (view) => view === "card" || (!!type && (!!type.views?.[view as "preview" | "full"] || native)),
      configured: settings.views.types[name] ?? settings.views.default,
      insertAs: insertAsFor(settings, name),
      costly: !!type?.costly,
    };
  }

  /**
   * A file not written yet drawn as it will be in the page (the insert dialog): a view of its type, read-only (no menu,
   * no click, nothing written), its label as set, its size and date its own; from its data in memory (a `blob:` URL,
   * freed as `signal` ends). No preview is kept in the space for it
   */
  drawSample(container: HTMLElement, file: File, path: string, view: View, signal: AbortSignal): void {
    const doc = container.ownerDocument;
    const url = URL.createObjectURL(file);
    signal.addEventListener("abort", () => URL.revokeObjectURL(url), { once: true });
    const asset: Asset = { kind: "file", path, url, ...(file.type ? { mime: file.type } : {}) };
    const type = typeFor(this.registry.types.all, asset);
    const frame = doc.createElement("span");
    frame.className = "swa-frame";
    const native = plainMedium(doc, asset, mimeOf(asset));
    if (native) frame.append(native);
    container.replaceChildren(frame);
    if (!type) return;
    const embed = readEmbeds(`![[${path}|||{ view: ${view} }]]`)[0];
    if (!embed) return;
    const drawn: DrawnEmbed = { frame, target: path, native, info: { size: file.size, modified: file.lastModified } };
    void this.host
      .settings()
      .then((settings) => {
        if (signal.aborted) return;
        // (No preview kept in the space for a file not written: its settings say none is; no view higher than the
        // dialog's room for it)
        const low = (height: number | undefined) => (height === undefined ? undefined : Math.min(height, SAMPLE_HEIGHT));
        const types = Object.fromEntries(Object.entries(settings.preview.types).map(([name, size]) => [name, { ...size, ...(size.height === undefined ? {} : { height: low(size.height)! }) }]));
        const sample: AssetSettings = { ...settings, storePreviews: false, preview: { ...settings.preview, height: low(settings.preview.height)!, types }, full: { ...settings.full, height: low(settings.full.height)!, types: Object.fromEntries(Object.entries(settings.full.types).map(([name, own]) => [name, own.height === undefined ? own : { height: low(own.height)! }])) } };
        this.render(drawn, { embed, occurrence: 0, of: 1 }, asset, type, sample, signal);
      })
      .catch(() => undefined);
  }

  /** Embeds drawn, decorated */
  async decorate(drawn: readonly DrawnEmbed[], unchangedKept = false): Promise<void> {
    if (!drawn.length) return;
    const [text, page, settings] = await Promise.all([this.host.pageText(), this.host.pageName(), this.host.settings()]);
    const settingsKey = JSON.stringify(settings);
    // (Each marked first: a widget's run is of all those drawn, this batch's too)
    for (const one of drawn) {
      this.drawn.set(one.frame, one);
      one.frame.setAttribute("data-swa-target", sameTarget(one.target));
      if (!one.position) one.frame.setAttribute("data-swa-widget", "");
    }
    for (const one of drawn) {
      const found = this.locate(one, text, page);
      if (!found) continue;
      const asset = this.host.assetOf(found.embed, page);
      const type = typeFor(this.registry.types.all, asset);
      if (!type) continue;
      // (Drawn again for the registry's change: one drawn with the same, its drawing live, left as it is)
      const was = this.frameDecorated.get(one.frame);
      const drawnAs = { asset: JSON.stringify(asset), type, embed: found.embed.text, settings: settingsKey };
      const same = was && was.asset === drawnAs.asset && was.type === type && was.embed === drawnAs.embed && was.settings === settingsKey;
      if (unchangedKept && same && this.renders.get(one.frame)?.signal.aborted === false) continue;
      this.render(one, found, asset, type, settings);
      this.frameDecorated.set(one.frame, drawnAs);
    }
    this.onDecorated?.();
  }

  /**
   * The embed a frame drawn is, in a page's text: one rendered outside the editor by its place as told; the host's own
   * widget (the files embedded outside what is rendered outside the editor, an embedded page drawn as no medium) by the
   * run of them the widgets drawn now are, the editor drawing what is in view. None: not found (a medium rendered
   * outside the editor whose place is not known yet, never taken for another)
   */
  private locate(one: DrawnEmbed, text: string, page: string): Found | undefined {
    const embeds = readEmbeds(text);
    const at = one.position?.();
    if (one.position) return at === undefined ? undefined : embedAt(embeds, at);
    const widgetsEmbeds = outside(embeds, this.host.renderedRanges(text)).filter((embed) => isFileTarget(embed.target));
    // Where the host says it is, an embed of its file starting there; else by the text around it, the run drawn
    const told = this.host.positionOf?.(one.frame);
    const there = told === undefined ? undefined : widgetsEmbeds.find((embed) => embed.from === told && sameTarget(this.host.resolved(embed, page)) === sameTarget(one.target));
    if (there) return occurrenceIn(embeds, there);
    const inText = widgetsEmbeds.map((embed): Placed => ({ target: sameTarget(this.host.resolved(embed, page)), at: embed.from / Math.max(text.length, 1) }));
    const widgets = [...this.doc.querySelectorAll<HTMLElement>("[data-swa-widget]")];
    const widgetsDrawn = widgets.map((frame): Placed => ({ target: frame.getAttribute("data-swa-target") ?? "", at: this.host.placeOf?.(frame) ?? 0 }));
    const index = this.byContext(one.frame, sameTarget(one.target), inText, widgetsEmbeds, false, text) ?? placeAmong(widgetsDrawn, widgets.indexOf(one.frame), inText);
    return index === undefined ? undefined : occurrenceIn(embeds, widgetsEmbeds[index]!);
  }

  /**
   * Which of the text's embeds (or links) of an element's target it is, by the text drawn around it: the one alone
   * whose text around it is most alike (an embed's widget in view, whatever is scrolled away). None where one of its
   * target alone is in the text (nothing to tell apart), the host draws no text around it, or several are as alike
   */
  private byContext(element: HTMLElement, target: string, inText: readonly Placed[], places: readonly { readonly from: number }[], withOwn: boolean, text: string): number | undefined {
    const alike = inText.flatMap((one, i) => (one.target === target ? [i] : []));
    if (alike.length < 2) return alike.length === 1 ? alike[0] : undefined;
    const drawn = this.host.contextOf?.(element);
    if (!drawn) return undefined;
    const closest = closestContext(drawn, alike.map((i) => writtenContext(text, places[i]!.from, withOwn)));
    return closest === undefined ? undefined : alike[closest];
  }

  /** The embed a frame is, found again in the page as it is now: another embed may have changed since it was decorated (the same file's in a grid, written) */
  private async locateNow(one: DrawnEmbed): Promise<Found | undefined> {
    const [text, page] = await Promise.all([this.host.pageText(), this.host.pageName()]);
    return this.locate(one, text, page);
  }

  /** Every embed decorated in the page decorated again (the settings saved) */
  async redecorateAll(): Promise<void> {
    const frames = [...this.doc.querySelectorAll<HTMLElement>("[data-swa-target]")];
    for (const element of this.links.keys()) if (!element.isConnected) this.links.delete(element);
    await Promise.all([this.decorate(frames.flatMap((frame) => this.drawn.get(frame) ?? []), true), this.decorateLinks([...this.links.values()])]);
  }

  /** A frame decorated: the box it is drawn in, where it is not the page's text (a grid's cell) */
  roomOf(frame: HTMLElement): HTMLElement | undefined {
    return (this.drawn.get(frame) ?? this.fieldDrawn.get(frame))?.room?.();
  }

  /** A frame decorated: its width and its alignment as its embed keeps them (each none: none) */
  sizeOf(frame: HTMLElement): { readonly width: string | undefined; readonly align: string | undefined } | undefined {
    return this.sizes.get(frame);
  }

  /** A frame's alignment written (none: taken off), as Silverware Layout gives it; why not, as text */
  async writeAlign(frame: HTMLElement, align: string | undefined): Promise<string | undefined> {
    const size = this.sizes.get(frame);
    return size ? size.writeAlign(align) : "this file is not decorated";
  }

  /** A frame's width written (none: taken off); why not, as text */
  async writeWidth(frame: HTMLElement, width: string | undefined): Promise<string | undefined> {
    const size = this.sizes.get(frame);
    return size ? size.write(width) : "this file is not decorated";
  }

  /**
   * One embed drawn as its view says; `readOnly`: in an editor's field, drawn until it ends: no menu, no click, nothing
   * written, unless the field gives `fieldEdit` (its markdown replaced there: its menu and click as in the page, what
   * they change written into the field's text, its width and alignment by Silverware Layout's handle too)
   */
  private render(drawn: DrawnEmbed, found: Found, asset: Asset, type: AssetType, settings: AssetSettings, readOnly?: AbortSignal, fieldEdit?: EmbedEdit): void {
    // (Its menu and click: in the page, or in a field that gives its markdown to edit)
    const acts = !readOnly || !!fieldEdit;
    const inField = (markdown: string) => (fieldEdit!.replace(markdown) ? undefined : NOT_FOUND);
    this.renders.get(drawn.frame)?.abort();
    const control = new AbortController();
    this.renders.set(drawn.frame, control);
    readOnly?.addEventListener("abort", () => control.abort(), { once: true, signal: control.signal });
    const { frame, native } = drawn;
    native?.classList.add(MEDIUM);
    frame.querySelectorAll(":scope > .swa-own, :scope > .swa-failed").forEach((own) => own.remove());
    frame.classList.remove("swa-has-error");
    frame.removeAttribute("data-swa-label-above");
    // The host's own drawing (its medium, or its words that it could not draw one): hidden where ours is drawn instead
    const hostOwn = [...frame.children].filter((child) => !child.classList.contains("swa-own"));
    for (const child of hostOwn) child.classList.remove(NATIVE_HIDDEN);
    const hideHost = () => hostOwn.forEach((child) => child.classList.add(NATIVE_HIDDEN));
    const can = (view: View) => view === "card" || !!type.views?.[view as "preview" | "full"] || !!native;
    const view = viewFor(found.embed.metadata.view, type.name, settings, can);
    frame.setAttribute("data-swa-type", type.name);
    frame.setAttribute("data-swa-view", view);
    // Its height: its embed's own, else the setting's for its view (a preview's; a full file's for a viewer of the
    // host's that has no height of its own, a PDF's: the style page's rules read it)
    const preview = previewSize(settings, type.name);
    // (In px times the content's scale: as large as the text makes it, where the files zoom with it: shared/contentscale.ts)
    frame.style.setProperty("--swa-height", scaledPx(Number(found.embed.height) || (view === "full" ? fullHeight(settings, type.name) : preview.height)));
    // A preview's width (none: as wide as it fits)
    const sized = view === "preview" && preview.width !== undefined;
    if (sized) frame.style.setProperty("--swa-preview-width", scaledPx(preview.width!));
    else frame.style.removeProperty("--swa-preview-width");
    frame.toggleAttribute("data-swa-preview-width", sized);
    // (Written to the embed as the page has it now: its place among those of its text may have changed since)
    const write = async (changes: EmbedChanges) => {
      if (fieldEdit) return inField(writeEmbed(found.embed, changes));
      if (readOnly) return READ_ONLY;
      const now = await this.locateNow(drawn);
      return now ? this.host.writeEmbed({ text: now.embed.text, occurrence: now.occurrence, of: now.of, changes }) : NOT_FOUND;
    };
    // Its width laid out by Silverware Layout's handle (not a card's): written as SilverBullet's size, the height taken off so the ratio holds
    // Its width (not a card's) and its alignment, Silverware Layout's to give meaning to (docs/silverware-layout-align.md):
    // kept in its embed, its width as SilverBullet's size (the height taken off so the ratio holds), its alignment in its
    // metadata (`{ align: right }`)
    const own = found.embed.metadata.align;
    // (In a field that gives its markdown to edit too, written into its text: Silverware Layout's handle there)
    if (!readOnly || fieldEdit)
      this.sizes.set(frame, {
      width: found.embed.width,
      align: typeof own === "string" ? own : undefined,
      write: (width) => write({ width: width ?? null, height: null }),
      writeAlign: (align) => write({ metadata: { align: align ?? null } }),
    });
    // (A preview of a file kept in the space where its type keeps one: docs/silverware-assets-stored-previews.md)
    const files = settings.storePreviews && type.storesPreview && asset.kind === "file" ? this.host.previewFiles : undefined;
    const stored = files && asset.kind === "file" && view === "preview" ? storedPreview(files, settings.previewFolder, asset.path, this.anew.delete(frame)) : undefined;
    const context: RenderContext = {
      asset,
      viewport: viewportOf(frame, found.embed, view, settings, control.signal, sized ? preview.width : undefined, view === "preview" ? preview.height : view === "full" ? fullHeight(settings, type.name) : undefined),
      metadata: metadataOf(found.embed.metadata, (changes) => write({ metadata: changes })),
      signal: control.signal,
      placement: "block",
      ...(stored ? { stored } : {}),
    };
    const capabilities = { views: (["card", "preview", "full"] as const).filter(can) };
    // The asset drawn into a container of an action's (a panel): its type's view, else a copy of the host's drawing, else its card
    const renderInto = async (as: "preview" | "full", container: HTMLElement) => {
      const element = await type.views?.[as]?.({ ...context, viewport: viewportOf(container, found.embed, as, settings, control.signal), fills: true });
      container.replaceChildren(element ?? shownCopy(native) ?? this.card(type, asset, settings));
    };
    const runAction = (gesture: Gesture) => {
      const action = actionFor(gesture, type.name, settings, (name) => this.registry.actions.get(name), asset, capabilities);
      if (!action) return;
      const actionContext: ActionContext = { asset, open: (url) => this.host.open(url), render: renderInto, sheetArea: this.host.sheetArea };
      void Promise.resolve(action.run(actionContext)).catch((error: unknown) => this.host.problem(`Silverware Assets: ${action.name}: ${message(error)}`));
    };
    // Its menu: how it is shown (the one the settings give left unwritten), what can be done with it. Opened by the "…"
    // at its top right; a card's by its icon, as a link's (no "…" over a card's name)
    const settled = settings.views.types[type.name] ?? settings.views.default;
    const notWritten = (problem: string | undefined) => problem && this.host.problem(`Silverware Assets: not written: ${problem}`);
    const menu = (): MoreMenu => {
        const actions = this.actionItems(asset, capabilities, (container, as) => renderInto(as, container));
        return {
          title: assetName(asset),
          // How it is shown: a view written into its embed (the settings' own as none), or the embed written as a link
          showAs: this.showAs(view, settled, can, !!this.host.embedToLink, (to) => {
            if (to === "link" && fieldEdit) notWritten(inField(embedAsLink(found.embed)));
            else if (to === "link")
              void this.locateNow(drawn)
                .then((now) => (now ? this.host.embedToLink!({ text: now.embed.text, occurrence: now.occurrence, of: now.of }) : NOT_FOUND))
                .then(notWritten);
            else void write({ metadata: { view: to === settled ? null : to } }).then(notWritten);
          }),
          // Its title (its alt text) and its file's name
          page: acts ? [{ label: "Rename…", run: () => this.renameEmbedded(drawn, found, asset, write, fieldEdit) }] : [],
          open: actions.open,
          file: [
            ...actions.copy,
            // Its whole markdown, its metadata too: the text it is drawn from (drawn anew as it changes), copied at once,
            // while the click still lets the page copy (read from the page first, a browser refused the copy that late)
            {
              label: "Copy markdown",
              run: () => void writeClipboard(this.doc, found.embed.text).catch((error: unknown) => this.host.problem(`Silverware Assets: not copied: ${message(error)}`)),
            },
            ...actions.file,
            // Its kept preview made anew (its file's previews taken away, its preview drawn again: made then)
            ...(files && asset.kind === "file" && view === "preview"
              ? [
                  {
                    label: "Regenerate preview",
                    run: () =>
                      void forgetPreviews(files, settings.previewFolder, asset.path).then(() => {
                        this.anew.add(frame);
                        this.render(drawn, found, asset, type, settings, readOnly, fieldEdit);
                      }),
                  },
                ]
              : []),
          ],
          // Its embed taken out of the page alone (a file of the web too, which cannot be deleted here), then its file deleted
          destructive: fieldEdit
            ? [
                // (In a field: its markdown there taken out, the file deleted first where asked)
                { label: "Remove from page", run: () => notWritten(inField("")) },
                ...(this.deletableInField(asset) ? [{ label: "Delete file…", run: () => void this.deleteInField(asset, "embed", () => inField("")) }] : []),
              ]
            : [
                ...(this.host.removeEmbed ? [{ label: "Remove from page", run: () => void this.removeFromPage(drawn) }] : []),
                ...(this.deletable(asset, "embed") ? [{ label: "Delete file…", run: () => void this.deleteEmbedded(drawn, asset) }] : []),
              ],
        };
    };
    const clicked = (element: HTMLElement) =>
      acts &&
      element.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          runAction(event.shiftKey ? "shift+click" : "click");
        },
        { signal: control.signal },
      );
    // A preview showing a document of its own (a PDF's viewer: the page told of no click on it) given a layer over it
    // that takes its click, as an image's preview does (a full file's viewer left to be read)
    const shielded = () => {
      if (!frame.querySelector(DOCUMENT_VIEWERS)) return clicked(frame);
      const shield = this.doc.createElement("div");
      shield.className = "swa-own swa-shield";
      clicked(shield);
      frame.append(shield);
    };
    // A preview's label (docs/silverware-assets-label.md): its lines above and under what is drawn, a click on them the
    // preview's; drawn at once with what is known, again as the host tells the file's size and date
    // (A view's label: a preview's, a full file's; a click on a preview's the preview's action, a full file's text alone)
    const labelled = (as: "preview" | "full" = "preview") => {
      const label = labelFor(settings, type.name, as);
      const { alt, ...bare } = asset;
      const known: LabelValues = { name: assetName(bare as Asset), icon: type.icon, ...(alt ? { alt } : {}) };
      const draw = (values: LabelValues) => {
        frame.querySelectorAll(":scope > .swa-label-line").forEach((line) => line.remove());
        const texts = labelTexts(label, values);
        const above = drawLabelLine(this.doc, "above", texts.above);
        const below = drawLabelLine(this.doc, "below", texts.below);
        if (above) {
          if (as === "preview") clicked(above);
          frame.prepend(above);
        }
        if (below) {
          if (as === "preview") clicked(below);
          frame.append(below);
        }
        frame.toggleAttribute("data-swa-label-above", !!above);
      };
      draw(known);
      const wanted = [...label.above, ...label.below].some((part) => part.on && (part.field === "size" || part.field === "modified"));
      if (!wanted || (!drawn.info && !this.host.fileInfo)) return;
      void (drawn.info ? Promise.resolve(drawn.info) : this.host.fileInfo!(asset))
        .then((info) => {
          if (!info || control.signal.aborted) return;
          const size = info.size === undefined ? undefined : sizeText(info.size);
          const modified = info.modified === undefined ? undefined : dateText(info.modified);
          draw({ ...known, ...(size ? { size } : {}), ...(modified ? { modified } : {}) });
        })
        .catch(() => undefined);
    };

    // A preview drawn (by its type: `element`; else the host's own, smaller): its click (a layer over a document's
    // viewer, which takes every click on it) and its label. A viewer its type puts in later (a PDF's page it could not
    // draw: the browser's viewer in its place) gets the layer then
    const previewDone = (element?: HTMLElement) => {
      if (!element || element.matches(DOCUMENT_VIEWERS) || element.querySelector(DOCUMENT_VIEWERS)) shielded();
      else {
        clicked(element);
        const win = this.doc.defaultView;
        if (win?.MutationObserver) {
          const watcher = new win.MutationObserver(() => {
            if (!element.querySelector(DOCUMENT_VIEWERS)) return;
            watcher.disconnect();
            shielded();
          });
          watcher.observe(element, { childList: true, subtree: true });
          control.signal.addEventListener("abort", () => watcher.disconnect());
        }
      }
      labelled();
    };

    if (view === "card") {
      const card = this.card(type, asset, settings, drawn.info);
      card.classList.add("swa-own");
      clicked(card);
      hideHost();
      frame.append(card);
      if (!acts) return;
      // Its menu's way in: a small arrow after its name, within the card as a link's after its text, always (its icon a
      // picture alone; a "…" beside it was cut off where the card filled its line)
      const opener = menuMarker(this.doc, "card");
      opener.setAttribute("aria-label", `${assetName(asset)}: its menu`);
      card.append(opener);
      opener.title = "Show…";
      opener.setAttribute("role", "button");
      opensMenu(this.doc, POPUP, opener, () => popupOf(menu()), control.signal);
      return;
    }
    if (acts) addMoreButton(this.doc, frame, menu, control.signal);
    const renderer = type.views?.[view];
    if (!renderer) {
      // The host's own drawing: a preview of it is the same, smaller (the style page's rule by the view's mark)
      if (view === "preview") previewDone();
      else labelled("full");
      return;
    }
    void Promise.resolve()
      .then(() => renderer(context))
      .then((element) => {
        if (control.signal.aborted) return;
        if (!element) {
          if (view === "preview") previewDone();
          else labelled("full");
          return;
        }
        element.classList.add("swa-own");
        // (A preview a type draws: its face, which the style page gives a picture's corners, as the host's own medium)
        if (view === "preview") element.classList.add(PREVIEW_FACE);
        hideHost();
        frame.append(element);
        if (view === "preview") previewDone(element);
        else labelled("full");
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        if (!native) {
          const card = this.card(type, asset, settings, drawn.info);
          card.classList.add("swa-own");
          clicked(card);
          frame.append(card);
        }
        markFailed(this.doc, frame, message(error));
      });
  }

  /** The card of an asset: its type's icon and the fields the user shows (a file's size and date as the host tells them, a moment later) */
  private card(type: AssetType, asset: Asset, settings: AssetSettings, info?: FileInfo): HTMLElement {
    const name = assetName(asset);
    const fields = settings.card.fields.filter((field) => field === "name").map((field) => ({ name: field, text: name }));
    const card = drawCard(this.doc, settings.card.fields.includes("icon") ? type.icon : undefined, fields, name);
    const wanted = settings.card.fields.filter((field) => field === "size" || field === "modified");
    // (A file not written yet: its own size and date, not those of a file of its name in the space)
    if (wanted.length && (info || this.host.fileInfo)) {
      void (info ? Promise.resolve(info) : this.host.fileInfo!(asset))
        .then((info) => {
          if (!info) return;
          const shown = wanted.flatMap((field) => {
            const text = field === "size" ? (info.size === undefined ? undefined : sizeText(info.size)) : info.modified === undefined ? undefined : dateText(info.modified);
            return text ? [{ name: field, text }] : [];
          });
          addCardFields(this.doc, card, shown);
        })
        .catch(() => undefined);
    }
    return card;
  }
}

/** The block an element is drawn in (the nearest around it not drawn inline): what a percent of its width is of */
function blockAround(element: HTMLElement): HTMLElement | undefined {
  const win = element.ownerDocument.defaultView;
  for (let at = element.parentElement; at; at = at.parentElement) if (!(win?.getComputedStyle(at).display ?? "").startsWith("inline")) return at;
  return undefined;
}

/** A copy of the host's drawing to show elsewhere (a panel): shown, though it is hidden where it is (a card shown there) */
function shownCopy(native: HTMLElement | undefined): HTMLElement | undefined {
  if (!native) return undefined;
  const copy = native.cloneNode(true) as HTMLElement;
  for (const one of [copy, ...copy.querySelectorAll<HTMLElement>(`.${NATIVE_HIDDEN}`)]) one.classList.remove(NATIVE_HIDDEN);
  return copy;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The room an asset is drawn in: the frame's width; its height the stored one, else the view's default. As at the
 * content's scale of 1 (shared/contentscale.ts): a type draws its sizes as CSS following the scale (`scaledPx`), so
 * they change at once with it, as the host's media do, nothing drawn again
 */
/**
 * The width of the room an element is drawn in, where it has none of its own yet (a frame of ours round nothing drawn,
 * in a field's line, inline and as wide as its label): its nearest ancestor laid out as a block, less its padding
 */
function roomOf(element: HTMLElement): number {
  const win = element.ownerDocument.defaultView;
  for (let at = element.parentElement; at; at = at.parentElement) {
    const style = win?.getComputedStyle(at);
    if (!style || style.display.startsWith("inline") || !at.clientWidth) continue;
    return at.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
  }
  return 0;
}

function viewportOf(element: HTMLElement, embed: Embed, view: View, settings: AssetSettings, signal: AbortSignal, width?: number, ownHeight?: number): Viewport {
  // (A preview's: its type's own where it has one, as the frame's --swa-height says, else all files')
  const height = () => Number(embed.height) || ownHeight || (view === "card" ? 0 : settings[view].height);
  return {
    // (A preview of a width the settings give: that width its room, the frame taking its width from what is drawn)
    // (Measured on the screen: given back at the scale of 1, as the type multiplies it again; the scale the element's
    // own, as what is over the window has 1)
    get width() {
      if (width !== undefined) return width;
      const shown = element.clientWidth || element.getBoundingClientRect().width || roomOf(element);
      const scale = parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue(CONTENT_SCALE) ?? "");
      return Number.isFinite(scale) && scale > 0 ? shown / scale : shown;
    },
    get height() {
      return height();
    },
    onChange: (changed, options) => {
      const win = element.ownerDocument.defaultView;
      if (!win?.ResizeObserver) return;
      const observer = new win.ResizeObserver(() => changed());
      observer.observe(element);
      const stop = () => observer.disconnect();
      signal.addEventListener("abort", stop);
      options?.signal?.addEventListener("abort", stop);
    },
  };
}

/** An embed of the page and its place among those of its text, which the page writer finds it by */
type Found = { readonly embed: Embed; readonly occurrence: number; readonly of: number };

/** What a Rename… is of: its title as written, how it is written where it is, and (in the page) how it is found again once its file is renamed */
type Renaming = {
  readonly of: "embed" | "link";
  readonly title: string;
  readonly writeTitle: (title: string) => Promise<string | undefined> | string | undefined;
  // In the page: its place among the references to its file, and the title written to the reference of that place once
  // they refer to the new path; none (a field): its file not renamed there
  readonly inPage?: {
    readonly order: () => Promise<number | undefined>;
    readonly titleAt: (path: string, order: number, title: string) => Promise<string | undefined>;
  };
  // Opened from another plugin's field: the dialog that editor's companion
  readonly companion?: boolean;
};

// How long a title waits for the page to refer to its file by the new name SilverBullet's rename gave it, and how often
// it looks (its rewrite of the page: written, then drawn in the editor)
const RENAMED_WAIT_MS = 10_000;
const RENAMED_POLL_MS = 200;

// Why a frame's embed was not written: not found in the page as it is now; drawn in an editor's field
const NOT_FOUND = "this file was not found in the page";
const READ_ONLY = "this file is drawn in a field being edited";

/** An embed of the text with its place among those of its text, which the page writer finds it by */
function occurrenceIn(embeds: readonly Embed[], embed: Embed): Found {
  const sameText = embeds.filter((one) => one.text === embed.text);
  return { embed, occurrence: sameText.indexOf(embed), of: sameText.length };
}
