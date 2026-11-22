// Silverware Layout over a host's page, whatever the host: the page's text width (its own, the default setting's, none
// in a narrow pane), where its text stands (its own, the default's; at the left while a side panel is open, where so set:
// docs/silverware-layout-text-align.md) and its font size (this device's zoom, the setting's, the host's) shown as pages open and change,
// the widgets laid out with their handle (widgetlayout.ts), the font zoom, and the settings dialog. What it asks of
// the page is a PageHost (host/page.ts); what it reads and saves (settings, a page's own width, this device's zoom) a
// LayoutStore. SilverBullet's binding (index.ts) gives both; another host would give its own.
import { fontSizeShown } from "./core/fontsize.ts";
import type { Registry } from "./core/registry.ts";
import { textAlignShown } from "./core/textalign.ts";
import { textWidthShown } from "./core/textwidth.ts";
import { offsetAtLeft, snapTargets, widestAtLeft } from "./core/widgetwidth.ts";
import { editorFontSize, inEditor, markNarrow, paneWidth, showFontSize, showPaneWidth, textWidthOf, themeFontSize, watchPaneWidth, watchStyles } from "./host/marks.ts";
import { markAlongText, TextPlacement } from "./host/textplacement.ts";
import type { PageHost } from "./host/page.ts";
import { DEFAULT_GUIDES, type Guide, type Settings, type TextAlign } from "./model/settings.ts";
import { sidePanelOpen, watchSidePanel } from "../../shared/sidepanel.ts";
import type { Width } from "./model/width.ts";
import { FontZoom } from "./ui/fontzoom.ts";
import { showContentScale } from "../../shared/contentscale.ts";
import { edgesFrom, GuideLines } from "./ui/guidelines.ts";
import { type DialogTabPart, PageDialog, type Preview } from "./ui/pagedialog.ts";
import { layOutWidgets, type WidgetLayout } from "./widgetlayout.ts";
import type { LayoutAlign } from "../../shared/layout.ts";
import { alignTab } from "./ui/aligntab.ts";

// How long the page is still before its own width is read again after an edit
const EDITED_MS = 300;
// The font size where the host's editor says none (SilverBullet's own)
const FALLBACK_FONT_SIZE = 18;

/** The font's settings, saved together */
export type FontSettings = Pick<Settings, "fontSize" | "fontZoom" | "fontPinch" | "fontScaleFiles">;

/** What Silverware Layout reads and saves, the host's way */
export type LayoutStore = {
  // Whether settings can be saved (else only a page's own width)
  readonly canSaveSettings: boolean;
  readSettings(): Promise<Settings>;
  /** The page open, read anew: its name and its own text width and alignment */
  readPage(): Promise<{ readonly page: string; readonly width: Width | undefined; readonly align: TextAlign | undefined }>;
  /** Each saved; why not, as text (a page's width and alignment, in one write), or thrown */
  savePageLayout(page: string, layout: { readonly width: Width | undefined; readonly align: TextAlign | undefined }): Promise<string | undefined>;
  saveTextWidth(width: Width | undefined): Promise<void>;
  saveTextAlign(align: TextAlign | undefined): Promise<void>;
  saveGuides(guides: readonly Guide[]): Promise<void>;
  saveAlignments(alignments: Readonly<Record<string, LayoutAlign>>): Promise<void>;
  saveFont(font: FontSettings): Promise<void>;
  /** This device's font zoom (px), as kept; none: none */
  readZoom(): number | undefined;
  keepZoom(size: number | undefined): void;
  confirm(question: string): Promise<boolean>;
  flash(message: string, type: "info" | "error"): void;
  /** Optional: the host's own tap with two fingers, run where the pinch takes two fingers and they tapped */
  twoFingerTap?(): void;
};

type State = {
  readonly store: LayoutStore;
  settings: Settings;
  // The page open and its own text width and alignment, as last read
  page: string;
  pageWidth: Width | undefined;
  pageAlign: TextAlign | undefined;
  // This device's font zoom (px); none: none
  zoom: number | undefined;
};

export class LayoutApp {
  private state: State | undefined;
  // Each reading of the page numbered: one answered after a later one is dropped (a page opened while another was read)
  private reading = 0;
  private editedTimer: ReturnType<typeof setTimeout> | undefined;
  private stopWatching: (() => void) | undefined;
  private dialog: PageDialog | undefined;
  // Made once (their observers and listeners live as long as the window), asking the state of the last start
  private widgetLayout: WidgetLayout | undefined;
  private fontZoom: FontZoom | undefined;
  // The theme's font size as first read (the content's scale's base where All pages has none): read once, as reading it
  // takes Silverware Layout's own size off the page a moment
  private themeSizeKept: number | undefined;

  constructor(
    private readonly doc: Document,
    private readonly page: PageHost,
    private readonly registry: Registry,
  ) {
    this.placement = new TextPlacement(doc, page);
  }

  /** Tabs of other parts of Silverware Layout's for the settings dialog, made as it opens (the media's) */
  dialogTabs: (() => Promise<readonly DialogTabPart[]>) | undefined;

  /** Told once the page's font shows at another size (a zoom, a size set): what read the page's look reads it again (the grids) */
  fontSizeChanged: (() => void) | undefined;
  // The page's font size shown last, and the editor's as drawn then (fontSizeChanged told where either changes)
  private fontSizeShownLast: number | undefined | null = null;
  private fontDrawnLast: number | undefined;
  private stopStyles: (() => void) | undefined;
  // Whether a side panel is open (the text at the left then, where so set), and its watching
  private panelOpen = false;
  private stopPanel: (() => void) | undefined;
  private stopAlongText: (() => void) | undefined;
  // Where the text is placed (made once, its watching living as long as the window)
  private readonly placement: TextPlacement;
  // What the page was last shown with (the dialog's preview or as saved): the text placed again with it as the styles or
  // a panel change
  private shownLast: Preview | undefined;

  /** Where the page's text is (x in the window, its padding left out); none before it is laid out */
  textEdges(): { readonly left: number; readonly right: number } | undefined {
    const widgets = this.widgetLayout?.widgets;
    const middle = widgets?.textMiddle();
    if (!widgets || middle === undefined) return undefined;
    const width = widgets.textWidth();
    return { left: middle - width / 2, right: middle + width / 2 };
  }

  /** The part of the window the page is seen in (below the host's top bar), top and bottom */
  view(): { readonly top: number; readonly bottom: number } {
    return this.page.view();
  }

  /** Every widget laid out again as its entries keep it (a provider's entries changed outside a drag: typed by hand) */
  layOutWidgets(): void {
    this.widgetLayout?.widgets.layOutAll();
  }

  /** A problem said to the user (the registry's, a widget's), the console's before a start */
  problem(message: string): void {
    if (this.state) this.state.store.flash(message, "error");
    else console.error(message);
  }

  /** Started (again, the host's scripts loaded again): the store handed over, the settings read, the page shown */
  async start(store: LayoutStore): Promise<void> {
    // (The theme's size read anew on a start: the configuration loaded again may have another theme)
    this.themeSizeKept = undefined;
    // (Started again on the same page, as another plugin's saved configuration loads the host's scripts again: the page
    // kept, so the dialog open over it is not taken for one of another page and closed)
    const was = this.state;
    this.state = { store, settings: await store.readSettings(), page: was?.page ?? "", pageWidth: was?.pageWidth, pageAlign: was?.pageAlign, zoom: store.readZoom() };
    // (The host's styles loaded after its scripts, a size of ours shown by its rule only then: what read the page's look
    // before reads it again)
    this.stopStyles?.();
    this.stopStyles = watchStyles(this.doc, () => {
      this.tellFontShown(false);
      // (The text's width the host's styles give may have come with them: the text placed again by it)
      this.showAlign();
    });
    // A side panel opened or closed: the text placed again (at the left while one is open, where so set)
    this.stopPanel?.();
    this.panelOpen = sidePanelOpen(this.doc);
    this.stopPanel = watchSidePanel(this.doc, (open) => {
      this.panelOpen = open;
      this.showAlign();
    });
    // The host's elements placed by the text (its title, its notifications), marked to move with it
    this.stopAlongText?.();
    this.stopAlongText = this.page.watchAlongText?.(markAlongText);
    this.stopWatching?.();
    this.stopWatching = watchPaneWidth(this.page, (width) => {
      showPaneWidth(this.doc, width);
      // (Not while the dialog shows a width it is setting)
      if (!this.dialog?.isOpen) this.show();
    });
    this.widgetLayout ??= layOutWidgets(this.doc, this.page, this.registry, {
      guides: () => this.state?.settings.guides ?? DEFAULT_GUIDES,
      enabled: () => !!this.state && paneWidth(this.page) >= this.state.settings.minPaneWidth,
      problem: (message) => this.problem(message),
      alignments: () => this.state?.settings.alignments ?? {},
      textAtLeft: () => this.placement.atLeft(),
    });
    this.widgetLayout.widgets.layOutAll();
    // While the settings dialog is open, the zoom is its This device's (set as its slider sets it, kept on Save, its
    // Ctrl + scroll box as ticked there), anywhere in the window: the dialog's ground lies over the editor
    const open = () => (this.dialog?.isOpen ? this.dialog : undefined);
    this.fontZoom ??= new FontZoom(this.doc, {
      enabled: () => open()?.font.zooms ?? !!this.state?.settings.fontZoom,
      pinches: () => open()?.font.pinches ?? !!this.state?.settings.fontPinch,
      // (Over the page's text alone, the dialog open or not: two fingers on the dialog are not a pinch of the page's)
      pinchesAt: (node) => inEditor(this.page, node),
      twoFingerTap: () => this.state?.store.twoFingerTap?.(),
      inEditor: (node) => !!open() || inEditor(this.page, node),
      size: () => {
        const dialog = open();
        return dialog ? (dialog.font.zoom ?? dialog.font.size ?? this.themeSize()) : (this.fontShown() ?? this.defaultFontSize());
      },
      defaultSize: () => {
        const dialog = open();
        return dialog ? (dialog.font.size ?? this.themeSize()) : this.defaultFontSize();
      },
      zoom: (size) => {
        const dialog = open();
        if (dialog) return dialog.setZoom(size);
        const state = this.state;
        if (!state) return;
        state.zoom = size;
        state.store.keepZoom(size);
        this.show();
      },
    });
    // (The dialog open shows what it sets: not undone)
    if (!this.dialog?.isOpen) this.show();
    await this.pageOpened();
  }

  /** A page opened, its own width and alignment known at once (the host read them as it opened): shown before it is painted */
  pageLoaded(page: string, width: Width | undefined, align?: TextAlign): void {
    const state = this.state;
    if (!state) return;
    ++this.reading;
    // (Another page opened under the dialog: it was set for the page before, its Save would write into this one)
    if (this.dialog?.isOpen && page !== state.page) this.dialog.close();
    state.page = page;
    state.pageWidth = width;
    state.pageAlign = align;
    this.show();
    // (What the host knew may lag behind a write a moment ago: the page read too, a moment later)
    void this.pageOpened();
  }

  /** The page open read again (as Silverware Layout starts, after an edit): its own width, the text shown at it */
  async pageOpened(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const mine = ++this.reading;
    const { page, width, align } = await state.store.readPage();
    if (mine !== this.reading || state !== this.state) return;
    const same = page === state.page;
    if (this.dialog?.isOpen && !same) this.dialog.close();
    state.page = page;
    state.pageWidth = width;
    state.pageAlign = align;
    // (The dialog open over the same page shows what it sets: not undone)
    if (!(this.dialog?.isOpen && same)) this.show();
  }

  /** The page edited: its width read again once it is still a moment (a width typed in its frontmatter) */
  pageEdited(): void {
    clearTimeout(this.editedTimer);
    this.editedTimer = setTimeout(() => {
      if (!this.dialog?.isOpen) void this.pageOpened();
    }, EDITED_MS);
  }

  /** The text shown at the width and the font size that apply now */
  private show(): void {
    const state = this.state;
    if (state) this.showWith({ pageWidth: state.pageWidth, defaultWidth: state.settings.textWidth, pageAlign: state.pageAlign, defaultAlign: state.settings.textAlign, fontSize: state.settings.fontSize, fontZoom: state.settings.fontZoom, scaleFiles: state.settings.fontScaleFiles, zoom: state.zoom });
  }

  /** The text shown as it would be with these (the page's own width, the default; the font size, the zoom; none: none) */
  private showWith(shown: Preview): void {
    const state = this.state;
    if (!state) return;
    // (The host's content made anew since: watched and marked again)
    this.widgetLayout?.widgets.followContent();
    const pane = paneWidth(this.page);
    showPaneWidth(this.doc, pane);
    // (Widgets laid out where the pane is wide enough: the style page's rule reads it)
    markNarrow(this.doc, pane < state.settings.minPaneWidth);
    this.page.showTextWidth(textWidthShown({ page: shown.pageWidth, fallback: shown.defaultWidth, paneWidth: pane, minPaneWidth: state.settings.minPaneWidth }));
    this.shownLast = shown;
    // (Font zoom off: this device's zoom not shown, still kept)
    const zoomed = shown.fontZoom ? shown.zoom : undefined;
    const size = fontSizeShown(zoomed, shown.fontSize);
    // (Told where the page's text shows at another size: the size changed, an editor made since marked now, or its font
    // drawn otherwise: a grid drawn before read the page's look at the host's own)
    const marked = showFontSize(this.doc, this.page, size);
    const changed = size !== this.fontSizeShownLast || (marked && size !== undefined);
    this.fontSizeShownLast = size;
    this.tellFontShown(changed);
    // The files grown or shrunk with this device's zoom, where asked: by its share of the size of all pages (the
    // theme's where none), so a page at its default shows them at theirs
    showContentScale(this.doc, shown.scaleFiles && zoomed !== undefined ? zoomed / (shown.fontSize ?? (this.themeSizeKept ??= this.themeSize())) : 1);
    // (Placed last, its width and font set: centred, it is centred at the width they give it)
    this.showAlign();
  }

  /** The text placed as the page was last shown with (its alignment, a side panel open or not), its width as it is */
  private showAlign(): void {
    const state = this.state;
    const shown = this.shownLast;
    if (!state || !shown) return;
    const align = textAlignShown({ page: shown.pageAlign, fallback: shown.defaultAlign, panelOpen: this.panelOpen, paneWidth: paneWidth(this.page), minPaneWidth: state.settings.minPaneWidth });
    this.placement.show(align);
  }

  /** What reads the page's look told it shows otherwise: `changed` (a size of ours), or the editor's font drawn at another size */
  private tellFontShown(changed: boolean): void {
    const drawn = editorFontSize(this.doc, this.page);
    if (!changed && drawn === this.fontDrawnLast) return;
    this.fontDrawnLast = drawn;
    this.fontSizeChanged?.();
  }

  /** The font size Silverware Layout shows now (none: the host's) */
  private fontShown(): number | undefined {
    const state = this.state;
    return state ? fontSizeShown(state.settings.fontZoom ? state.zoom : undefined, state.settings.fontSize) : undefined;
  }

  /** The default font size: the setting's, else the host's */
  private defaultFontSize(): number {
    return this.state?.settings.fontSize ?? this.themeSize();
  }

  /** The font size the host's theme gives (px) */
  private themeSize(): number {
    return themeFontSize(this.doc, this.page) ?? FALLBACK_FONT_SIZE;
  }

  /** The settings dialog over the page open */
  async openDialog(): Promise<void> {
    const state = this.state;
    if (!state) return;
    await this.pageOpened();
    const { store } = state;
    this.dialog ??= new PageDialog(this.doc);
    // (Where each kind of widget stands: a tab of the kinds the providers registered now name)
    const kinds = this.registry.providers.flatMap((provider) => (provider.kinds ?? []).map((kind) => ({ key: `${provider.name}/${kind.id}`, kind })));
    const alignment = alignTab(this.doc, kinds, state.settings.alignments, async (alignments) => {
      await store.saveAlignments(alignments);
      state.settings = { ...state.settings, alignments };
      this.widgetLayout?.widgets.layOutAll();
      return undefined;
    });
    const tabs = [alignment, ...((await this.dialogTabs?.().catch(() => [])) ?? [])];
    this.dialog.open({
      tabs,
      page: state.page,
      pageWidth: state.pageWidth,
      defaultWidth: state.settings.textWidth,
      pageAlign: state.pageAlign,
      defaultAlign: state.settings.textAlign,
      guides: state.settings.guides,
      canSaveSettings: store.canSaveSettings,
      minPaneWidth: state.settings.minPaneWidth,
      paneWidth: () => paneWidth(this.page),
      themeWidth: () => this.page.themeTextWidth(),
      fontSize: state.settings.fontSize,
      fontZoom: state.settings.fontZoom,
      fontPinch: state.settings.fontPinch,
      fontScaleFiles: state.settings.fontScaleFiles,
      zoom: state.zoom,
      themeFontSize: () => themeFontSize(this.doc, this.page) ?? FALLBACK_FONT_SIZE,
      // The guides as a drag of a centred widget shows them: the page's width and each guide the pane can hold, by the
      // text's middle, or from its start where it stands at the left
      previewGuides: (guides) => {
        const content = this.page.content();
        if (!content) return () => undefined;
        const box = content.getBoundingClientRect();
        const text = textWidthOf(content);
        const left = this.placement.atLeft();
        const lines = new GuideLines(this.doc, this.page);
        const edges = left
          ? (width: number) => {
              const from = left.x + offsetAtLeft(width, text, "center");
              return [from, from + width] as const;
            }
          : edgesFrom(box.left + box.width / 2);
        // (With the text at the left, only those a drag reaches: none past the pane's right edge, as the handle's)
        const widest = left ? widestAtLeft(paneWidth(this.page), left.start) : Infinity;
        lines.show(snapTargets(text, guides, paneWidth(this.page)).filter((target) => target.width <= widest + 0.5), edges);
        return () => lines.clear();
      },
      preview: (shown) => this.showWith(shown),
      restore: () => this.show(),
      savePage: async (layout) => {
        const problem = await store.savePageLayout(state.page, layout);
        if (!problem) {
          state.pageWidth = layout.width;
          state.pageAlign = layout.align;
        }
        return problem;
      },
      saveDefault: async (width) => {
        await store.saveTextWidth(width);
        state.settings = { ...state.settings, textWidth: width };
        return undefined;
      },
      saveDefaultAlign: async (align) => {
        await store.saveTextAlign(align);
        state.settings = { ...state.settings, textAlign: align };
        return undefined;
      },
      saveGuides: async (guides) => {
        await store.saveGuides(guides);
        state.settings = { ...state.settings, guides };
        return undefined;
      },
      saveFont: async (font) => {
        await store.saveFont(font);
        state.settings = { ...state.settings, ...font };
        return undefined;
      },
      saveZoom: (size) => {
        state.zoom = size;
        store.keepZoom(size);
      },
      confirm: (question) => store.confirm(question),
      flash: (message, type) => store.flash(message, type),
    });
  }
}
