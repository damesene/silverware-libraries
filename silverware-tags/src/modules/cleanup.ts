// The cleanup module: the window's Cleanup, what to tidy in the tags of the
// space. Tags likely one (tags/similar.ts: case or a separator, a plural, a
// typo), each group with the tag to merge into (the most used, unless another
// is picked) and Merge…, reviewed in the window through the rename module's
// offer (off: said, nothing to merge with). Below them the tags used on one
// page only, each opening in the view by tag.
import { pageCounts } from "../core/catalog.ts";
import type { ModuleHost, TagsModule, WorkspaceHost } from "../core/module.ts";
import { counted } from "../core/operation.ts";
import { RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { hashtagOf, isMetaTag } from "../../../shared/pages/tags/names.ts";
import { type SimilarReason, similarTags } from "../tags/similar.ts";
import { el } from "../../../shared/elements.ts";

export const VIEW = "cleanup";

const REASONS: Readonly<Record<SimilarReason, string>> = {
  form: "the same but for capitals or a separator",
  plural: "a plural of another",
  typo: "one letter apart (a typo?)",
};

/** Why a group is one, as its heading says it: "The same but for capitals or a separator; a plural of another" */
const reasonsOf = (reasons: readonly SimilarReason[]) => {
  const text = reasons.map((reason) => REASONS[reason]).join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function cleanupView(module: ModuleHost, host: WorkspaceHost): HTMLElement {
  const { doc, catalog } = host;
  // (SilverBullet's own tags left alone: meta/library is how a library is installed)
  const counts = new Map([...pageCounts(catalog)].filter(([name]) => !isMetaTag(name)));
  const rename = module.offered<RenameOffer>(RENAME_OFFER);
  const groups = similarTags(counts);
  const once = [...counts].filter(([, count]) => count === 1).map(([name]) => name).sort((a, b) => a.localeCompare(b));

  const group = (tags: readonly string[], reasons: readonly SimilarReason[], i: number) => {
    let into = tags[0]!;
    const choices = tags.map((tag) => {
      const box = el(doc, "input", { attrs: { type: "radio", name: `swg-into-${i}`, value: tag, "aria-label": `Merge into ${hashtagOf(tag)}` } });
      box.checked = tag === into;
      box.addEventListener("change", () => (into = tag));
      return el(doc, "label", { class: "swg-chip swg-cleanup-choice", attrs: { "data-swg-chip": tag } }, box, el(doc, "span", { class: "swg-chip-name", text: hashtagOf(tag) }), el(doc, "span", { class: "swg-chip-count", text: String(counts.get(tag) ?? 0), title: counted(counts.get(tag) ?? 0, "page") }));
    });
    const merge = el(doc, "button", {
      class: "swg-button swg-primary",
      text: "Merge…",
      title: rename ? "Merge them into the tag picked, reviewed first" : "Rename is turned off: nothing to merge with",
      attrs: { "data-swg-action": "cleanup.merge" },
      run: () => {
        if (!rename) return;
        host.review(rename.merge(tags, into, catalog));
      },
    });
    merge.disabled = !rename;
    return el(
      doc,
      "div",
      { class: "swg-cleanup-group", attrs: { "data-swg-group": tags.join(" ") } },
      el(doc, "p", { class: "swg-form-label", text: reasonsOf(reasons) }),
      el(doc, "div", "swg-cleanup-row", el(doc, "div", "swg-chips swg-cleanup-chips", el(doc, "span", { class: "swg-form-hint", text: "Into:" }), ...choices), merge),
    );
  };

  return el(
    doc,
    "div",
    "swg-detail swg-cleanup",
    el(doc, "h3", { class: "swg-section", text: `Tags likely one (${groups.length})` }),
    ...(groups.length ? groups.map((g, i) => group(g.tags, g.reasons, i)) : [el(doc, "p", { class: "swg-empty", text: "None: no two tags look alike." })]),
    el(doc, "h3", { class: "swg-section", text: `Used on one page only (${once.length})` }),
    once.length
      ? el(
          doc,
          "div",
          "swg-chips swg-cleanup-once",
          ...once.map((tag) => el(doc, "button", { class: "swg-chip swg-cleanup-tag", text: hashtagOf(tag), title: `Open ${hashtagOf(tag)} in By tag`, attrs: { "data-swg-chip": tag }, run: () => host.pick(tag) })),
        )
      : el(doc, "p", { class: "swg-empty", text: "None." }),
  );
}

export function cleanupModule(module: ModuleHost): TagsModule {
  return {
    views: () => [{ id: VIEW, label: "Cleanup", render: (host) => cleanupView(module, host) }],
  };
}
