// Embedded media decorated (docs/silverware-layout-assets.md): the host draws an embed (SilverBullet its widget, its
// own <img>, <video>, <object>, or "Unsupported content"); each drawn is found in the page's text (its target, its
// order among those of the same target), its type matched, its view chosen, and it is left as the host drew it (a view
// the type renders none of), replaced by the type's rendering, or by the card. A click on a card or a preview runs the
// action the user set for it. A render that fails shows the host's drawing (else the card) with an error mark.
import type { ActionContext, Asset, AssetType, RenderContext, Viewport } from "../../../shared/assets.ts";
import { type Embed, type EmbedChanges, readEmbeds } from "../../../shared/markdown/embed.ts";
import { actionFor, typeFor, viewFor } from "./core/choose.ts";
import { embedOf, sameTarget } from "./core/locate.ts";
import { metadataOf } from "./core/metadata.ts";
import type { AssetRegistry } from "./core/registry.ts";
import { type AssetSettings, type Gesture, type View, VIEWS } from "./model/settings.ts";
import { drawCard, markFailed } from "./ui/card.ts";
import { addMoreButton } from "./ui/moremenu.ts";

/** An embed as the host drew it: its frame, its target as drawn (a path of the space or a URL), its own media element */
export type DrawnEmbed = { readonly frame: HTMLElement; readonly target: string; readonly native: HTMLElement | undefined };

/** An embed to write: found by its text as read and its place among those alike */
export type EmbedWrite = { readonly text: string; readonly occurrence: number; readonly of: number; readonly changes: EmbedChanges };

/** What the assets ask of the host whose page they are in */
export type AssetHost = {
  /** Told of the embeds drawn, those there now and each drawn after */
  watch(drawn: (embeds: readonly DrawnEmbed[]) => void): void;
  pageText(): Promise<string>;
  pageName(): Promise<string>;
  /** An embed's target as the host draws it (resolved from the page), to find a drawn one by */
  resolved(embed: Embed, page: string): string;
  /** An embed's asset */
  assetOf(embed: Embed, page: string): Asset;
  settings(): Promise<AssetSettings>;
  writeEmbed(write: EmbedWrite): Promise<string | undefined>;
  open(url: string): void;
  problem(message: string): void;
};

const NATIVE_HIDDEN = "swl-asset-native-hidden";

export class AssetDecorator {
  // Each frame decorated: what ends its render
  private readonly renders = new WeakMap<HTMLElement, AbortController>();
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
  }

  /** Embeds drawn, decorated */
  async decorate(drawn: readonly DrawnEmbed[]): Promise<void> {
    if (!drawn.length) return;
    const [text, page, settings] = await Promise.all([this.host.pageText(), this.host.pageName(), this.host.settings()]);
    const embeds = readEmbeds(text);
    for (const one of drawn) {
      one.frame.setAttribute("data-swl-asset-target", sameTarget(one.target));
      const nth = [...this.doc.querySelectorAll(`[data-swl-asset-target]`)].filter((frame) => frame.getAttribute("data-swl-asset-target") === sameTarget(one.target)).indexOf(one.frame);
      const found = embedOf(embeds, (embed) => this.host.resolved(embed, page), one.target, nth);
      if (!found) continue;
      const asset = this.host.assetOf(found.embed, page);
      const type = typeFor(this.registry.types.all, asset);
      if (!type) continue;
      this.render(one, found, asset, type, settings);
    }
  }

  /** One embed drawn as its view says */
  private render(drawn: DrawnEmbed, found: { readonly embed: Embed; readonly occurrence: number; readonly of: number }, asset: Asset, type: AssetType, settings: AssetSettings): void {
    this.renders.get(drawn.frame)?.abort();
    const control = new AbortController();
    this.renders.set(drawn.frame, control);
    const { frame, native } = drawn;
    frame.querySelectorAll(":scope > .swl-asset-own, :scope > .swl-asset-failed").forEach((own) => own.remove());
    frame.classList.remove("swl-asset-has-error");
    // The host's own drawing (its medium, or its words that it could not draw one): hidden where ours is drawn instead
    const hostOwn = [...frame.children].filter((child) => !child.classList.contains("swl-asset-own"));
    for (const child of hostOwn) child.classList.remove(NATIVE_HIDDEN);
    const hideHost = () => hostOwn.forEach((child) => child.classList.add(NATIVE_HIDDEN));
    const can = (view: View) => view === "icon" || !!type.views?.[view as "preview" | "embed"] || !!native;
    const view = viewFor(found.embed.metadata.view, type.name, settings, can);
    frame.setAttribute("data-swl-asset", type.name);
    frame.setAttribute("data-swl-asset-view", view);
    // A preview's height, the setting's (the style page's rules read it)
    frame.style.setProperty("--swl-asset-height", `${Number(found.embed.height) || settings.heights.preview}px`);
    const write = (changes: EmbedChanges) => this.host.writeEmbed({ text: found.embed.text, occurrence: found.occurrence, of: found.of, changes });
    const context: RenderContext = {
      asset,
      viewport: viewportOf(frame, found.embed, view, settings, control.signal),
      metadata: metadataOf(found.embed.metadata, (changes) => write({ metadata: changes })),
      signal: control.signal,
      placement: "block",
    };
    const capabilities = { views: (["icon", "preview", "embed"] as const).filter(can) };
    const runAction = (gesture: Gesture) => {
      const action = actionFor(gesture, type.name, settings, (name) => this.registry.actions.get(name), asset, capabilities);
      if (!action) return;
      const actionContext: ActionContext = {
        asset,
        open: (url) => this.host.open(url),
        render: async (as, container) => {
          const element = await type.views?.[as]?.({ ...context, viewport: viewportOf(container, found.embed, as, settings, control.signal) });
          container.replaceChildren(element ?? native?.cloneNode(true) ?? this.card(type, asset, settings));
        },
      };
      void Promise.resolve(action.run(actionContext)).catch((error: unknown) => this.host.problem(`Silverware Layout: ${action.name}: ${message(error)}`));
    };
    // The "…" menu: how it is shown (the one the settings give left unwritten), the click's action
    const settled = settings.views.types[type.name] ?? settings.views.default;
    const LABELS: Readonly<Record<View, string>> = { icon: "Show as a card", preview: "Show as a preview", embed: "Show in full" };
    addMoreButton(
      this.doc,
      frame,
      () => {
        const click = actionFor("click", type.name, settings, (name) => this.registry.actions.get(name), asset, capabilities);
        return {
          title: asset.alt || type.name,
          views: VIEWS.map((one) => ({
            view: one,
            label: LABELS[one],
            checked: one === view,
            ...(can(one) ? {} : { disabled: "This file cannot be shown so" }),
            run: () =>
              void write({ metadata: { view: one === settled ? null : one } }).then((problem) => problem && this.host.problem(`Silverware Layout: not written: ${problem}`)),
          })),
          ...(click ? { open: { label: "Open", run: () => runAction("click") } } : {}),
        };
      },
      control.signal,
    );
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

    if (view === "icon") {
      const card = this.card(type, asset, settings);
      card.classList.add("swl-asset-own");
      clicked(card);
      hideHost();
      frame.append(card);
      return;
    }
    const renderer = type.views?.[view];
    if (!renderer) {
      // The host's own drawing: a preview of it is the same, smaller (the style page's rule by the view's mark)
      if (view === "preview") clicked(frame);
      return;
    }
    void Promise.resolve()
      .then(() => renderer(context))
      .then((element) => {
        if (control.signal.aborted) return;
        if (!element) {
          if (view === "preview") clicked(frame);
          return;
        }
        element.classList.add("swl-asset-own");
        if (view === "preview") clicked(element);
        hideHost();
        frame.append(element);
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        if (!native) {
          const card = this.card(type, asset, settings);
          card.classList.add("swl-asset-own");
          clicked(card);
          frame.append(card);
        }
        markFailed(this.doc, frame, message(error));
      });
  }

  /** The card of an asset: its type's icon and the fields the user shows */
  private card(type: AssetType, asset: Asset, settings: AssetSettings): HTMLElement {
    const name = asset.alt || (asset.kind === "file" ? asset.path.split("/").pop()! : asset.kind === "web" ? asset.url.split(/[?#]/, 1)[0]!.split("/").pop()! : asset.page);
    const fields = settings.card.filter((field) => field === "name").map((field) => ({ name: field, text: name }));
    return drawCard(this.doc, settings.card.includes("icon") ? type.icon : undefined, fields, name);
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The room an asset is drawn in: the frame's width; its height the stored one, else the view's default */
function viewportOf(element: HTMLElement, embed: Embed, view: View, settings: AssetSettings, signal: AbortSignal): Viewport {
  const height = () => Number(embed.height) || (view === "icon" ? 0 : settings.heights[view]);
  return {
    get width() {
      return element.clientWidth || element.getBoundingClientRect().width;
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
