// Silverware Layout over a host's page, whatever the host: the page's text width (its own, the default setting's, none
// in a narrow pane) and its font size (this device's zoom, the setting's, the host's) shown as pages open and change,
// the widgets laid out with their handle (widgetlayout.ts), the font zoom, and the Page layout dialog. What it asks of
// the page is a PageHost (host/page.ts); what it reads and saves (settings, a page's own width, this device's zoom) a
// LayoutStore. SilverBullet's binding (index.ts) gives both; another host would give its own.
import { fontSizeShown } from "./core/fontsize.ts";
import type { Registry } from "./core/registry.ts";
import { textWidthShown } from "./core/textwidth.ts";
import { inEditor, markNarrow, paneWidth, showFontSize, showPaneWidth, themeFontSize, watchPaneWidth } from "./host/marks.ts";
import type { PageHost } from "./host/page.ts";
import { DEFAULT_GUIDES, type Guide, type Settings } from "./model/settings.ts";
import type { Width } from "./model/width.ts";
import { FontZoom } from "./ui/fontzoom.ts";
import { PageDialog, type Preview } from "./ui/pagedialog.ts";
import { layOutWidgets, type WidgetLayout } from "./widgetlayout.ts";

// How long the page is still before its own width is read again after an edit
const EDITED_MS = 300;
// The font size where the host's editor says none (SilverBullet's own)
const FALLBACK_FONT_SIZE = 18;

/** What Silverware Layout reads and saves, the host's way */
export type LayoutStore = {
  // Whether settings can be saved (else only a page's own width)
  readonly canSaveSettings: boolean;
  readSettings(): Promise<Settings>;
  /** The page open, read anew: its name and its own text width */
  readPage(): Promise<{ readonly page: string; readonly width: Width | undefined }>;
  /** Each saved; why not, as text (a page's width), or thrown */
  savePageWidth(page: string, width: Width | undefined): Promise<string | undefined>;
  saveTextWidth(width: Width | undefined): Promise<void>;
  saveGuides(guides: readonly Guide[]): Promise<void>;
  saveFont(fontSize: number | undefined, fontZoom: boolean): Promise<void>;
  /** This device's font zoom (px), as kept; none: none */
  readZoom(): number | undefined;
  keepZoom(size: number | undefined): void;
  confirm(question: string): Promise<boolean>;
  flash(message: string, type: "info" | "error"): void;
};

type State = {
  readonly store: LayoutStore;
  settings: Settings;
  // The page open and its own text width, as last read
  page: string;
  pageWidth: Width | undefined;
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

  constructor(
    private readonly doc: Document,
    private readonly page: PageHost,
    private readonly registry: Registry,
  ) {}

  /** A problem said to the user (the registry's, a widget's), the console's before a start */
  problem(message: string): void {
    if (this.state) this.state.store.flash(message, "error");
    else console.error(message);
  }

  /** Started (again, the host's scripts loaded again): the store handed over, the settings read, the page shown */
  async start(store: LayoutStore): Promise<void> {
    this.state = { store, settings: await store.readSettings(), page: "", pageWidth: undefined, zoom: store.readZoom() };
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
    });
    this.widgetLayout.widgets.layOutAll();
    this.fontZoom ??= new FontZoom(this.doc, {
      enabled: () => !!this.state?.settings.fontZoom,
      inEditor: (node) => inEditor(this.page, node),
      size: () => this.fontShown() ?? this.defaultFontSize(),
      defaultSize: () => this.defaultFontSize(),
      zoom: (size) => {
        const state = this.state;
        if (!state) return;
        state.zoom = size;
        state.store.keepZoom(size);
        if (!this.dialog?.isOpen) this.show();
      },
    });
    this.show();
    await this.pageOpened();
  }

  /** A page opened, its own width known at once (the host read it as it opened): shown before it is painted */
  pageLoaded(page: string, width: Width | undefined): void {
    const state = this.state;
    if (!state) return;
    ++this.reading;
    // (Another page opened under the dialog: it was set for the page before, its Save would write into this one)
    if (this.dialog?.isOpen && page !== state.page) this.dialog.close();
    state.page = page;
    state.pageWidth = width;
    this.show();
    // (What the host knew may lag behind a write a moment ago: the page read too, a moment later)
    void this.pageOpened();
  }

  /** The page open read again (as Silverware Layout starts, after an edit): its own width, the text shown at it */
  async pageOpened(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const mine = ++this.reading;
    const { page, width } = await state.store.readPage();
    if (mine !== this.reading || state !== this.state) return;
    if (this.dialog?.isOpen && page !== state.page) this.dialog.close();
    state.page = page;
    state.pageWidth = width;
    this.show();
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
    if (state) this.showWith({ pageWidth: state.pageWidth, defaultWidth: state.settings.textWidth, fontSize: state.settings.fontSize, fontZoom: state.settings.fontZoom, zoom: state.zoom });
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
    // (Font zoom off: this device's zoom not shown, still kept)
    showFontSize(this.doc, this.page, fontSizeShown(shown.fontZoom ? shown.zoom : undefined, shown.fontSize));
  }

  /** The font size Silverware Layout shows now (none: the host's) */
  private fontShown(): number | undefined {
    const state = this.state;
    return state ? fontSizeShown(state.settings.fontZoom ? state.zoom : undefined, state.settings.fontSize) : undefined;
  }

  /** The default font size: the setting's, else the host's */
  private defaultFontSize(): number {
    return this.state?.settings.fontSize ?? themeFontSize(this.doc, this.page) ?? FALLBACK_FONT_SIZE;
  }

  /** The Page layout dialog over the page open */
  async openDialog(): Promise<void> {
    const state = this.state;
    if (!state) return;
    await this.pageOpened();
    const { store } = state;
    this.dialog ??= new PageDialog(this.doc);
    this.dialog.open({
      page: state.page,
      pageWidth: state.pageWidth,
      defaultWidth: state.settings.textWidth,
      guides: state.settings.guides,
      canSaveSettings: store.canSaveSettings,
      minPaneWidth: state.settings.minPaneWidth,
      paneWidth: () => paneWidth(this.page),
      themeWidth: () => this.page.themeTextWidth(),
      fontSize: state.settings.fontSize,
      fontZoom: state.settings.fontZoom,
      zoom: state.zoom,
      themeFontSize: () => themeFontSize(this.doc, this.page) ?? FALLBACK_FONT_SIZE,
      preview: (shown) => this.showWith(shown),
      restore: () => this.show(),
      savePage: async (width) => {
        const problem = await store.savePageWidth(state.page, width);
        if (!problem) state.pageWidth = width;
        return problem;
      },
      saveDefault: async (width) => {
        await store.saveTextWidth(width);
        state.settings = { ...state.settings, textWidth: width };
        return undefined;
      },
      saveGuides: async (guides) => {
        await store.saveGuides(guides);
        state.settings = { ...state.settings, guides };
        return undefined;
      },
      saveFont: async (fontSize, fontZoom) => {
        await store.saveFont(fontSize, fontZoom);
        state.settings = { ...state.settings, fontSize, fontZoom };
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
