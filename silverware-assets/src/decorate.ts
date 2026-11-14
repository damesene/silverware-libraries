// Embedded media decorated (docs/silverware-assets.md): the host draws an embed (SilverBullet its widget, its
// own <img>, <video>, <object>, or "Unsupported content"); each drawn is found in the page's text (its target, its
// order among those of the same target), its type matched, its view chosen, and it is left as the host drew it (a view
// the type renders none of), replaced by the type's rendering, or by the card. A click on a card or a preview runs the
// action the user set for it. A render that fails shows the host's drawing (else the card) with an error mark.
import { type ActionContext, type Asset, assetName, type AssetType, type Capabilities, type RenderContext, type Viewport } from "../../shared/assets.ts";
import { type Embed, type EmbedChanges, isFileTarget, readEmbeds, readLinks } from "../../shared/markdown/embed.ts";
import { actionFor, mimeOf, typeFor, viewFor } from "./core/choose.ts";
import { closestContext, embedAt, type LineContext, linkAt, outside, placeAmong, type Placed, type Range, sameTarget, writtenContext } from "./core/locate.ts";
import { metadataOf } from "./core/metadata.ts";
import type { AssetRegistry } from "./core/registry.ts";
import { type AssetSettings, type Gesture, labelFor, previewSize, type View, VIEWS } from "./model/settings.ts";
import { addCardFields, dateText, drawCard, iconElement, markFailed, menuMarker, sizeText } from "./ui/card.ts";
import { drawLabelLine, labelTexts, type LabelValues } from "./ui/label.ts";
import { opensMenu } from "../../shared/popupmenu.ts";
import { addMoreButton, type MoreMenu, popupOf } from "./ui/moremenu.ts";
import { plainMedium } from "./ui/plainmedium.ts";

// The popup menu's classes: Silverware Assets'
const POPUP = { base: "swa" } as const;

/** An embed as the host drew it: its frame, its target as drawn (a path of the space or a URL), its own media element */
export type DrawnEmbed = {
  readonly frame: HTMLElement;
  readonly target: string;
  readonly native: HTMLElement | undefined;
  // Where it is in the page, where the host knows (a medium in markdown rendered outside the editor: as told by the one drawing it)
  readonly position?: () => number | undefined;
  // The box it is drawn in, where it is not the page's text (a grid's cell): a width given to it a share of that
  readonly room?: () => HTMLElement | undefined;
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
  linkToEmbed?(write: FormWrite): Promise<string | undefined>;
  /**
   * A file of the space deleted, and its embed taken out of the page (a link to it written as its text), each found as
   * `embedToLink` finds it; asked first (`confirm`). None: no Delete in the menus. Why not, as text
   */
  deleteFile?(path: string): Promise<string | undefined>;
  removeEmbed?(write: FormWrite): Promise<string | undefined>;
  linkToText?(write: FormWrite): Promise<string | undefined>;
  confirm?(question: string): Promise<boolean>;
  open(url: string): void;
  problem(message: string): void;
};

const NATIVE_HIDDEN = "swa-native-hidden";
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

export class AssetDecorator {
  // Each frame decorated: what ends its render
  private readonly renders = new WeakMap<HTMLElement, AbortController>();
  // Each frame decorated: its width as its embed keeps it, where it stays as it changes, how a new one is written
  private readonly sizes = new WeakMap<HTMLElement, FramePlace>();
  // Each frame decorated, as the host drew it (decorated again as the settings change)
  private readonly drawn = new WeakMap<HTMLElement, DrawnEmbed>();
  // The links decorated (decorated again as the settings change; those gone from the page left out then)
  private readonly links = new Set<DrawnLink>();
  // Each link's menu: what ends it (its icon drawn again, or the link gone)
  private readonly linkMenus = new WeakMap<HTMLElement, AbortController>();
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

  /** Links drawn: each to a file of the space given its type's icon before its text (the setting off: a small arrow after it), which opens its menu */
  async decorateLinks(links: readonly DrawnLink[]): Promise<void> {
    if (!links.length || !this.host.linkAsset) return;
    const [page, settings] = await Promise.all([this.host.pageName(), this.host.settings()]);
    for (const old of this.links) {
      if (old.element.isConnected) continue;
      this.links.delete(old);
      this.linkMenus.get(old.element)?.abort();
    }
    for (const link of links) {
      this.links.add(link);
      link.element.querySelectorAll(`:scope > :is(.${LINK_ICON}, .swa-menu-marker)`).forEach((one) => one.remove());
      this.linkMenus.get(link.element)?.abort();
      const asset = this.host.linkAsset(link, page);
      const type = asset && typeFor(this.registry.types.all, asset);
      if (!type) continue;
      // Its way into its menu: its type's icon before it, else (the setting off) a small arrow after it
      let icon: HTMLElement;
      if (settings.linkIcons) {
        icon = iconElement(this.doc, type.icon);
        icon.classList.add(LINK_ICON, "swa-menu-icon");
        link.element.prepend(icon);
      } else {
        icon = menuMarker(this.doc, "link");
        icon.setAttribute("aria-label", `${assetName(asset)}: its menu`);
        link.element.append(icon);
      }
      icon.title = "Show…";
      icon.setAttribute("role", "button");
      link.element.setAttribute("data-swa-link", type.name);
      // Its menu: what can be done with the file (a press on the icon the menu's, the link's text still the host's)
      const control = new AbortController();
      this.linkMenus.set(link.element, control);
      const drawn = !!type.views?.embed || !!plainMedium(this.doc, asset, mimeOf(asset));
      const capabilities: Capabilities = { views: ["icon", ...(type.views?.preview ? (["preview"] as const) : []), ...(drawn ? (["embed"] as const) : [])] };
      opensMenu(
        this.doc,
        POPUP,
        icon,
        () =>
          popupOf({
            title: assetName(asset),
            views: [],
            actions: [
              ...this.actionItems(asset, capabilities, (container, as) => this.drawInto(container, as, type, asset, settings, control.signal)),
              ...(this.host.linkToEmbed ? [{ label: "Show as embedded", run: () => void this.toEmbed(link) }] : []),
            ],
            destructive: this.deletable(asset, "link") ? [{ label: "Delete file…", run: () => void this.deleteLinked(link, asset) }] : [],
          }),
        control.signal,
      );
    }
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
   * An embedded file deleted, once confirmed: its embed found in the page first (the host may draw it anew, missing,
   * once the file is gone: its widget no longer told where it is), then the file deleted, then the embed taken out
   */
  private async deleteEmbedded(drawn: DrawnEmbed, asset: Asset & { readonly kind: "file" }): Promise<void> {
    if (!(await this.confirmDelete(asset, "embed"))) return;
    const now = await this.locateNow(drawn);
    if (!now) return this.host.problem(`Silverware Assets: the file was not deleted: ${NOT_FOUND}`);
    const problem = await this.host.deleteFile!(asset.path);
    if (problem) return this.host.problem(`Silverware Assets: the file was not deleted: ${problem}`);
    const left = await this.host.removeEmbed!({ text: now.embed.text, occurrence: now.occurrence, of: now.of });
    if (left) this.host.problem(`Silverware Assets: the file was deleted, its embed not taken out of the page: ${left}`);
  }

  /** A linked file deleted, once confirmed: its link found first (as Show as embedded finds it), the file deleted, the link written as its text */
  private async deleteLinked(link: DrawnLink, asset: Asset & { readonly kind: "file" }): Promise<void> {
    if (!(await this.confirmDelete(asset, "link"))) return;
    const found = await this.linkInPage(link);
    if (!found) return this.host.problem("Silverware Assets: the file was not deleted: this link was not found in the page");
    const problem = await this.host.deleteFile!(asset.path);
    if (problem) return this.host.problem(`Silverware Assets: the file was not deleted: ${problem}`);
    const left = await this.host.linkToText!({ text: found.link.text, occurrence: found.occurrence, of: found.of });
    if (left) this.host.problem(`Silverware Assets: the file was deleted, its link left in the page: ${left}`);
  }

  /** A link written as an embed of its file: found in the page by its place, else by its target and its order among the links drawn of it */
  private async toEmbed(link: DrawnLink): Promise<void> {
    const found = await this.linkInPage(link);
    if (!found) return this.host.problem("Silverware Assets: this link was not found in the page");
    const problem = await this.host.linkToEmbed!({ text: found.link.text, occurrence: found.occurrence, of: found.of });
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
      const drawn = [...this.links].filter((one) => one.element.isConnected && !one.position && one.style === link.style);
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
  private actionItems(asset: Asset, can: Capabilities, render: (container: HTMLElement, as: "preview" | "embed") => Promise<void>): { readonly label: string; readonly run: () => void }[] {
    return this.registry.actions.all
      .filter((action) => action.fits(asset, can))
      .map((action) => ({
        label: action.label ?? action.name,
        run: () => {
          const context: ActionContext = { asset, open: (url) => this.host.open(url), render: (as, container) => render(container, as) };
          void Promise.resolve(action.run(context)).catch((error: unknown) => this.host.problem(`Silverware Assets: ${action.name}: ${message(error)}`));
        },
      }));
  }

  /** A link's asset drawn into a container of an action's: its type's view, else the plain medium of its kind, else its card */
  private async drawInto(container: HTMLElement, as: "preview" | "embed", type: AssetType, asset: Asset, settings: AssetSettings, signal: AbortSignal): Promise<void> {
    const viewport: Viewport = {
      get width() {
        return container.clientWidth;
      },
      get height() {
        return settings.heights[as];
      },
      onChange: () => undefined,
    };
    const element = await type.views?.[as]?.({ asset, viewport, metadata: metadataOf({}, async () => "a link keeps no metadata"), signal, placement: "inline" });
    container.replaceChildren(element ?? plainMedium(this.doc, asset, mimeOf(asset)) ?? this.card(type, asset, settings));
  }

  /** Embeds drawn, decorated */
  async decorate(drawn: readonly DrawnEmbed[]): Promise<void> {
    if (!drawn.length) return;
    const [text, page, settings] = await Promise.all([this.host.pageText(), this.host.pageName(), this.host.settings()]);
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
      this.render(one, found, asset, type, settings);
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
    for (const link of this.links) if (!link.element.isConnected) this.links.delete(link);
    await Promise.all([this.decorate(frames.flatMap((frame) => this.drawn.get(frame) ?? [])), this.decorateLinks([...this.links])]);
  }

  /** A frame decorated: the box it is drawn in, where it is not the page's text (a grid's cell) */
  roomOf(frame: HTMLElement): HTMLElement | undefined {
    return this.drawn.get(frame)?.room?.();
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

  /** One embed drawn as its view says */
  private render(drawn: DrawnEmbed, found: Found, asset: Asset, type: AssetType, settings: AssetSettings): void {
    this.renders.get(drawn.frame)?.abort();
    const control = new AbortController();
    this.renders.set(drawn.frame, control);
    const { frame, native } = drawn;
    frame.querySelectorAll(":scope > .swa-own, :scope > .swa-failed").forEach((own) => own.remove());
    frame.classList.remove("swa-has-error");
    frame.removeAttribute("data-swa-label-above");
    // The host's own drawing (its medium, or its words that it could not draw one): hidden where ours is drawn instead
    const hostOwn = [...frame.children].filter((child) => !child.classList.contains("swa-own"));
    for (const child of hostOwn) child.classList.remove(NATIVE_HIDDEN);
    const hideHost = () => hostOwn.forEach((child) => child.classList.add(NATIVE_HIDDEN));
    const can = (view: View) => view === "icon" || !!type.views?.[view as "preview" | "embed"] || !!native;
    const view = viewFor(found.embed.metadata.view, type.name, settings, can);
    frame.setAttribute("data-swa-asset", type.name);
    frame.setAttribute("data-swa-view", view);
    // Its height: its embed's own, else the setting's for its view (a preview's; the original's for a viewer of the
    // host's that has no height of its own, a PDF's: the style page's rules read it)
    const preview = previewSize(settings, type.name);
    frame.style.setProperty("--swa-height", `${Number(found.embed.height) || (view === "embed" ? settings.heights.embed : preview.height)}px`);
    // A preview's width (none: as wide as it fits)
    const sized = view === "preview" && preview.width !== undefined;
    if (sized) frame.style.setProperty("--swa-preview-width", `${preview.width}px`);
    else frame.style.removeProperty("--swa-preview-width");
    frame.toggleAttribute("data-swa-preview-width", sized);
    // (Written to the embed as the page has it now: its place among those of its text may have changed since)
    const write = async (changes: EmbedChanges) => {
      const now = await this.locateNow(drawn);
      return now ? this.host.writeEmbed({ text: now.embed.text, occurrence: now.occurrence, of: now.of, changes }) : NOT_FOUND;
    };
    // Its width laid out by Silverware Layout's handle (not a card's): written as SilverBullet's size, the height taken off so the ratio holds
    // Its width (not a card's) and its alignment, Silverware Layout's to give meaning to (docs/silverware-layout-align.md):
    // kept in its embed, its width as SilverBullet's size (the height taken off so the ratio holds), its alignment in its
    // metadata (`{ align: right }`)
    const own = found.embed.metadata.align;
    this.sizes.set(frame, {
      width: found.embed.width,
      align: typeof own === "string" ? own : undefined,
      write: (width) => write({ width: width ?? null, height: null }),
      writeAlign: (align) => write({ metadata: { align: align ?? null } }),
    });
    const context: RenderContext = {
      asset,
      viewport: viewportOf(frame, found.embed, view, settings, control.signal, sized ? preview.width : undefined),
      metadata: metadataOf(found.embed.metadata, (changes) => write({ metadata: changes })),
      signal: control.signal,
      placement: "block",
    };
    const capabilities = { views: (["icon", "preview", "embed"] as const).filter(can) };
    // The asset drawn into a container of an action's (a panel): its type's view, else a copy of the host's drawing, else its card
    const renderInto = async (as: "preview" | "embed", container: HTMLElement) => {
      const element = await type.views?.[as]?.({ ...context, viewport: viewportOf(container, found.embed, as, settings, control.signal) });
      container.replaceChildren(element ?? shownCopy(native) ?? this.card(type, asset, settings));
    };
    const runAction = (gesture: Gesture) => {
      const action = actionFor(gesture, type.name, settings, (name) => this.registry.actions.get(name), asset, capabilities);
      if (!action) return;
      const actionContext: ActionContext = { asset, open: (url) => this.host.open(url), render: renderInto };
      void Promise.resolve(action.run(actionContext)).catch((error: unknown) => this.host.problem(`Silverware Assets: ${action.name}: ${message(error)}`));
    };
    // Its menu: how it is shown (the one the settings give left unwritten), what can be done with it. Opened by the "…"
    // at its top right; a card's by its icon, as a link's (no "…" over a card's name)
    const settled = settings.views.types[type.name] ?? settings.views.default;
    const LABELS: Readonly<Record<View, string>> = { icon: "Show as a card", preview: "Show as a preview", embed: "Show as the original" };
    const menu = (): MoreMenu => {
        return {
          title: asset.alt || type.name,
          views: VIEWS.map((one) => ({
            view: one,
            label: LABELS[one],
            checked: one === view,
            ...(can(one) ? {} : { disabled: "This file cannot be shown so" }),
            run: () =>
              void write({ metadata: { view: one === settled ? null : one } }).then((problem) => problem && this.host.problem(`Silverware Assets: not written: ${problem}`)),
          })),
          actions: [
            ...this.actionItems(asset, capabilities, (container, as) => renderInto(as, container)),
            ...(this.host.embedToLink
              ? [
                  {
                    label: "Show as a link",
                    run: () =>
                      void this.locateNow(drawn)
                        .then((now) => (now ? this.host.embedToLink!({ text: now.embed.text, occurrence: now.occurrence, of: now.of }) : NOT_FOUND))
                        .then((problem) => problem && this.host.problem(`Silverware Assets: not written: ${problem}`)),
                  },
                ]
              : []),
          ],
          destructive: this.deletable(asset, "embed") ? [{ label: "Delete file…", run: () => void this.deleteEmbedded(drawn, asset) }] : [],
        };
    };
    const clicked = (element: HTMLElement) =>
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
    // that takes its click, as an image's preview does (the original's viewer left to be read)
    const shielded = () => {
      if (!frame.querySelector(DOCUMENT_VIEWERS)) return clicked(frame);
      const shield = this.doc.createElement("div");
      shield.className = "swa-own swa-shield";
      clicked(shield);
      frame.append(shield);
    };
    // A preview's label (docs/silverware-assets-label.md): its lines above and under what is drawn, a click on them the
    // preview's; drawn at once with what is known, again as the host tells the file's size and date
    const labelled = () => {
      const label = labelFor(settings, type.name);
      const { alt, ...bare } = asset;
      const known: LabelValues = { name: assetName(bare as Asset), icon: type.icon, ...(alt ? { alt } : {}) };
      const draw = (values: LabelValues) => {
        frame.querySelectorAll(":scope > .swa-label").forEach((line) => line.remove());
        const texts = labelTexts(label, values);
        const above = drawLabelLine(this.doc, "above", texts.above);
        const below = drawLabelLine(this.doc, "below", texts.below);
        if (above) {
          clicked(above);
          frame.prepend(above);
        }
        if (below) {
          clicked(below);
          frame.append(below);
        }
        frame.toggleAttribute("data-swa-label-above", !!above);
      };
      draw(known);
      const wanted = [...label.above, ...label.below].some((part) => part.on && (part.field === "size" || part.field === "modified"));
      if (!wanted || !this.host.fileInfo) return;
      void this.host
        .fileInfo(asset)
        .then((info) => {
          if (!info || control.signal.aborted) return;
          const size = info.size === undefined ? undefined : sizeText(info.size);
          const modified = info.modified === undefined ? undefined : dateText(info.modified);
          draw({ ...known, ...(size ? { size } : {}), ...(modified ? { modified } : {}) });
        })
        .catch(() => undefined);
    };

    // A preview drawn (by its type: `element`; else the host's own, smaller): its click (a layer over a document's
    // viewer, which takes every click on it) and its label
    const previewDone = (element?: HTMLElement) => {
      if (!element || element.matches(DOCUMENT_VIEWERS) || element.querySelector(DOCUMENT_VIEWERS)) shielded();
      else clicked(element);
      labelled();
    };

    if (view === "icon") {
      const card = this.card(type, asset, settings);
      card.classList.add("swa-own");
      clicked(card);
      hideHost();
      frame.append(card);
      // Its menu's way in: its icon; a card without it (as the user shows cards), a small arrow after its name, within
      // the card as a link's after its text (a "…" beside it was cut off where the card filled its line)
      let opener = card.querySelector<HTMLElement>(".swa-icon");
      if (opener) opener.classList.add("swa-menu-icon");
      else {
        opener = menuMarker(this.doc, "card");
        opener.setAttribute("aria-label", `${assetName(asset)}: its menu`);
        card.append(opener);
      }
      opener.title = "Show…";
      opener.setAttribute("role", "button");
      opensMenu(this.doc, POPUP, opener, () => popupOf(menu()), control.signal);
      return;
    }
    addMoreButton(this.doc, frame, menu, control.signal);
    const renderer = type.views?.[view];
    if (!renderer) {
      // The host's own drawing: a preview of it is the same, smaller (the style page's rule by the view's mark)
      if (view === "preview") previewDone();
      return;
    }
    void Promise.resolve()
      .then(() => renderer(context))
      .then((element) => {
        if (control.signal.aborted) return;
        if (!element) {
          if (view === "preview") previewDone();
          return;
        }
        element.classList.add("swa-own");
        hideHost();
        frame.append(element);
        if (view === "preview") previewDone(element);
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        if (!native) {
          const card = this.card(type, asset, settings);
          card.classList.add("swa-own");
          clicked(card);
          frame.append(card);
        }
        markFailed(this.doc, frame, message(error));
      });
  }

  /** The card of an asset: its type's icon and the fields the user shows (a file's size and date as the host tells them, a moment later) */
  private card(type: AssetType, asset: Asset, settings: AssetSettings): HTMLElement {
    const name = assetName(asset);
    const fields = settings.card.filter((field) => field === "name").map((field) => ({ name: field, text: name }));
    const card = drawCard(this.doc, settings.card.includes("icon") ? type.icon : undefined, fields, name);
    const wanted = settings.card.filter((field) => field === "size" || field === "modified");
    if (wanted.length && this.host.fileInfo) {
      void this.host
        .fileInfo(asset)
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

/** A copy of the host's drawing to show elsewhere (a panel): shown, though it is hidden where it is (a card shown there) */
function shownCopy(native: HTMLElement | undefined): HTMLElement | undefined {
  if (!native) return undefined;
  const copy = native.cloneNode(true) as HTMLElement;
  for (const one of [copy, ...copy.querySelectorAll<HTMLElement>(`.${NATIVE_HIDDEN}`)]) one.classList.remove(NATIVE_HIDDEN);
  return copy;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The room an asset is drawn in: the frame's width; its height the stored one, else the view's default */
function viewportOf(element: HTMLElement, embed: Embed, view: View, settings: AssetSettings, signal: AbortSignal, width?: number): Viewport {
  const height = () => Number(embed.height) || (view === "icon" ? 0 : settings.heights[view]);
  return {
    // (A preview of a width the settings give: that width its room, the frame taking its width from what is drawn)
    get width() {
      return width ?? (element.clientWidth || element.getBoundingClientRect().width);
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

// Why a frame's embed was not written: not found in the page as it is now
const NOT_FOUND = "this file was not found in the page";

/** An embed of the text with its place among those of its text, which the page writer finds it by */
function occurrenceIn(embeds: readonly Embed[], embed: Embed): Found {
  const sameText = embeds.filter((one) => one.text === embed.text);
  return { embed, occurrence: sameText.indexOf(embed), of: sameText.length };
}
