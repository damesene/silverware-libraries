// The dialog deleting a database (its menu's Delete database…, the binding's
// command): what goes found first (every document read for its places, the
// progress shown), then said (its items, its own document, the documents its
// places are in, Undo while the window stays), deleted only once its name is
// typed (the plugin's least undoable change), written whole or not at all
// (`DatabaseCore.planDeleteDatabase`), its progress shown as the documents go.
// The shared dialog in the settings' look (`swd-settings`), a class of its own
// (`swd-delete-database`).
import { Dialogs } from "../../../shared/dialog.ts";
import { el } from "../../../shared/elements.ts";
import type { Noun } from "../domain/noun.ts";
import type { DatabaseCore, Proposal } from "./core.ts";
import { ICONS } from "./icons.ts";

const BASE = "swd-settings";
// How many documents its places are in are named before "and N more"
const NAMED = 5;

export type DeleteDatabaseHost = {
  readonly document: Document;
  readonly core: DatabaseCore;
  readonly noun: Noun;
  notify(message: string): void;
  /** Told once the deletion was written (in part too): the places shown follow it (a block left shows its database gone) */
  written?(): void;
};

const number = (n: number) => n.toLocaleString("en-US");

/** The database `id` (named `name`) deleted through a dialog: found, said, its name typed, written */
export function openDeleteDatabase(host: DeleteDatabaseHost, id: string, name: string): void {
  const doc = host.document;
  const { noun } = host;
  const dialogs = new Dialogs(doc, { base: BASE, closeIcon: ICONS.close });
  const many = (n: number, one: string, more: string) => `${number(n)} ${n === 1 ? one : more}`;
  const status = el(doc, "p", { class: "swd-delete-status", text: `Looking for its views: reading the ${noun.many}…`, attrs: { role: "status" } });
  const said = el(doc, "ul", { class: "swd-delete-lines", attrs: { hidden: "" } });
  const field = el(doc, "input", { class: "swd-delete-name", attrs: { "aria-label": `The database's name, ${name}`, autocomplete: "off", spellcheck: "false", disabled: "" } });
  const ask = el(doc, "label", { class: "swd-delete-ask", attrs: { hidden: "" } }, el(doc, "span", { text: `Type ${name} to delete it` }), field);
  // Planning (its documents read), then ready, then writing: Esc and Cancel close it until it writes
  let state: "finding" | "ready" | "writing" | "done" = "finding";
  let proposal: Proposal | undefined;
  const remove = el(doc, "button", { class: `${BASE}-save swd-delete-confirm`, text: "Delete", attrs: { disabled: "" }, run: () => void write() });
  const cancel = el(doc, "button", { class: `${BASE}-cancel`, text: "Cancel", run: () => dialog.close() });
  const typed = () => field.value.trim() === name.trim();
  field.addEventListener("input", () => (remove.disabled = state !== "ready" || !typed()));
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !remove.disabled) {
      event.preventDefault();
      void write();
    }
  });
  const dialog = dialogs.open({
    title: `Delete the database "${name}"`,
    subtitle: `Its items, its own ${noun.one} and its views`,
    className: "swd-delete-database",
    content: el(doc, "div", "swd-delete-body", status, said, ask),
    footer: el(doc, "div", `${BASE}-foot`, cancel, remove),
    focus: cancel,
    dismiss: () => state !== "writing",
    closed: () => {
      if (state !== "writing") state = "done";
    },
  });

  // What goes, found (every document read: told as it goes)
  void (async () => {
    const made = await host.core.planDeleteDatabase(id, (done, of) => {
      if (state === "finding") status.textContent = `Looking for its views: ${number(done)} of ${number(of)} ${noun.many} read…`;
    });
    if (state !== "finding") return;
    if ("problem" in made) {
      // (Said by the core too: here, where the dialog is)
      status.textContent = made.problem;
      status.classList.add("swd-delete-problem");
      remove.hidden = true;
      cancel.textContent = "Close";
      return;
    }
    proposal = made;
    const items = made.plan.planned.filter((one) => "item" in one.target).length;
    const places = made.places?.documents ?? [];
    const byHand = made.places?.byHand ?? [];
    const listed = (documents: readonly string[]) => documents.slice(0, NAMED).join(", ") + (documents.length > NAMED ? ` and ${number(documents.length - NAMED)} more` : "");
    const pages = made.documents?.count ?? 0;
    const lines = [
      items ? `${many(items, "item", "items")}, ${pages ? `each a ${noun.one} of its own, deleted with its content` : "deleted"}.` : "No item.",
      ...(pages ? [`The database's own ${noun.one}, with its content (its properties' settings and anything written in it).`] : []),
      places.length ? `Its views, taken out of ${many(places.length, noun.one, noun.many)}: ${listed(places)}.` : byHand.length ? "" : `No view of it on any ${noun.one}.`,
      // (A block in a list item is not written: left, to take out by hand)
      byHand.length ? `Its views in a list item, left (take them out by hand): ${listed(byHand)}.` : "",
      ...(pages ? [`Writes ${many(pages, noun.one, noun.many)}, one after another: keep this window open until it is done.`] : []),
      "Undo brings it all back as long as this window stays open; once it is reloaded, it cannot.",
    ];
    said.replaceChildren(...lines.filter(Boolean).map((text) => el(doc, "li", { text })));
    said.hidden = false;
    status.textContent = "";
    ask.hidden = false;
    field.disabled = false;
    state = "ready";
    field.focus();
  })();

  async function write(): Promise<void> {
    if (state !== "ready" || !proposal || !typed()) return;
    state = "writing";
    remove.disabled = cancel.disabled = field.disabled = true;
    // Leaving the window while it writes leaves it half deleted, its Undo gone with the window: the browser asks first
    const win = doc.defaultView;
    const stay = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    win?.addEventListener("beforeunload", stay);
    try {
      const result = await host.core.apply(proposal, (done, of) => (status.textContent = `Deleted ${number(done)} of ${number(of)}…`));
      // (Refused or left: said by the core; deleted: said here, how to have it back with it)
      if (!("problem" in result)) host.notify(`The database "${name}" was deleted. Undo brings it back while this window stays open.`);
    } catch (error) {
      host.notify(`Deleting the database "${name}" failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      win?.removeEventListener("beforeunload", stay);
      host.written?.();
      state = "done";
      dialog.close();
    }
  }
}
