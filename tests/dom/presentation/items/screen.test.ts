import { expect, it } from "vitest";
import {
  find,
  firstItem,
  ITEM_ID,
  ITEM_PATH,
  namedButton,
  openItems,
  text,
  until,
} from "../../../support/items/screen";

it("shows the ready empty state and configured folder", async () => {
  const view = await openItems();
  try {
    expect(find(view.screen, '[data-testid="items-empty"]').textContent?.trim()).toBe(
      text.items.settings.empty,
    );
    expect(view.screen.textContent).toContain(text.items.settings.folder("Records/Items"));
  } finally {
    await view.close();
  }
});

it("shows editable values and opens a newer record through Obsidian", async () => {
  const newer = "Records/Items/Future.md";
  const view = await openItems(
    { path: ITEM_PATH, frontmatter: firstItem },
    {
      path: newer,
      frontmatter: {
        schema: "product-engineering.item/v2",
        title: "Future",
        id: ITEM_ID.replace(/2$/, "3"),
      },
    },
  );
  try {
    const good = find(view.screen, `[data-card-key="${ITEM_ID}"]`);
    expect(good.textContent).toContain(firstItem.title);
    expect(good.textContent).toContain(text.items.status.open);
    expect(find(good, '[data-focus="edit"]').textContent?.trim()).toBe(text.items.actions.edit);
    const readOnly = [...view.screen.querySelectorAll<HTMLElement>("[data-card-key]")].find(
      (card) => card !== good,
    );
    expect(readOnly?.textContent).toContain(text.notes.issues.newerSchema(2));
    if (!readOnly) throw new Error("Missing read-only item");
    expect(readOnly.querySelector('[data-focus="edit"], [data-focus="remove"]')).toBeNull();
    namedButton(readOnly, text.notes.openNote).click();
    await until(() => expect(view.notes.opened()).toEqual([newer]));
  } finally {
    await view.close();
  }
});
