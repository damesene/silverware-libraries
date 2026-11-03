// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { PageLinksOffer } from "../formulas/index.ts";
import { controller, setup, useTablePage } from "../testing/page.ts";

const TABLE = "| Item | Qty |\n|---|---|\n| Fig | 3 |\n";

describe("Pages read for other modules", () => {
  useTablePage();

  it("are read once asked for, again when asked fresh and as they are indexed with changes", async () => {
    const pages: Record<string, string> = { Orders: TABLE };
    const read: string[] = [];
    await setup("Text.\n", {}, { readPage: (name) => (read.push(name), pages[name]!) });
    const offer = controller.offered<PageLinksOffer>("pageLinks")!;
    await offer.readPages(["Orders"], false);
    await offer.readPages(["Orders"], false);
    expect(read).toEqual(["Orders"]);
    expect(controller.otherPages()?.tables("Orders")?.length).toBe(1);
    // Indexed with another table: read again, though no formula refers to it
    pages.Orders = `${TABLE}\n${TABLE}`;
    await controller.pageIndexed("Orders");
    expect(read).toEqual(["Orders", "Orders"]);
    expect(controller.otherPages()?.tables("Orders")?.length).toBe(2);
    await offer.readPages(["Orders"], true);
    expect(read).toEqual(["Orders", "Orders", "Orders"]);
  });

  it("are not read with the formulas module off (what they are read for)", async () => {
    const read: string[] = [];
    await setup("Text.\n", { "silverware.table.modules.formulas.enabled": false }, { readPage: (name) => (read.push(name), TABLE) });
    await controller.offered<PageLinksOffer>("pageLinks")?.readPages(["Orders"], false);
    expect(read).toEqual([]);
  });
});
