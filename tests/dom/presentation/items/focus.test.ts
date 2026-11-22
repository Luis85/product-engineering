import { expect, it } from "vitest";
import { fill, find, openItems, save, until } from "../../../support/items/screen";

it("contains the sheet in a modal, restores focus after Escape, and focuses the new card", async () => {
  const view = await openItems();
  try {
    const add = find(view.screen, '[data-focus="add"]');
    view.start();
    const form = await view.editor();
    const dialog = form.closest('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(view.screen.closest("[inert]")).not.toBeNull();
    const title = find(form, '[name="title"]');
    await until(() => expect(document.activeElement).toBe(title));
    title.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await until(() => expect(document.activeElement).toBe(add));
    expect(view.screen.closest("[inert]")).toBeNull();

    view.start();
    const reopened = await view.editor();
    fill(reopened, { title: "New item" });
    save(reopened);
    const edit = await until(() => find(view.screen, '[data-focus="edit"]'));
    await until(() => expect(document.activeElement).toBe(edit));
  } finally {
    await view.close();
  }
});
