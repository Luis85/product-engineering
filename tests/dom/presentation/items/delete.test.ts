import { expect, it } from "vitest";
import {
  find,
  firstItem,
  ITEM_PATH,
  namedButton,
  openItems,
  text,
  until,
} from "../../../support/items/screen";

it("requires confirmation, preserves the note on cancel, and refocuses Add after deletion", async () => {
  const view = await openItems({ path: ITEM_PATH, frontmatter: firstItem });
  try {
    const remove = find<HTMLButtonElement>(view.screen, '[data-focus="remove"]');
    remove.click();
    const dialog = await until(() => find(view.root, '[role="dialog"][aria-modal="true"]'));
    expect(dialog.textContent).toContain(text.notes.deleteDialog.title(firstItem.title));
    const cancel = namedButton(dialog, text.notes.deleteDialog.cancel);
    await until(() => expect(document.activeElement).toBe(cancel));
    cancel.click();
    await until(() => expect(document.activeElement).toBe(remove));
    expect((await view.read(ITEM_PATH)).frontmatter).toMatchObject(firstItem);

    remove.click();
    const confirm = await until(() => namedButton(view.root, text.notes.deleteDialog.confirm));
    confirm.click();
    await until(() => expect(view.screen.querySelector("[data-card-key]")).toBeNull());
    await until(() => expect(document.activeElement).toBe(find(view.screen, '[data-focus="add"]')));
    expect(view.notes.body(ITEM_PATH)).toBeUndefined();
  } finally {
    await view.close();
  }
});
