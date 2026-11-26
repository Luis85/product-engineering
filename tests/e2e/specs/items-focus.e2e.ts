import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import {
  fillTitle,
  itemCard,
  itemForm,
  itemPath,
  noteId,
  openCreate,
  openEdit,
  openItems,
  save,
  texts,
  waitForNote,
} from "../items";
import { installConsoleSpy, pluginProblems, ROOT } from "../support";

function waitForFocus(selector: string) {
  return browser.waitUntil(
    () => browser.execute((target) => document.activeElement?.matches(target) === true, selector),
    { timeoutMsg: "The expected control did not receive focus" },
  );
}

it("keeps focus in modals and restores it after create, rename, cancellation and delete", async () => {
  await installConsoleSpy();
  await openItems();
  const add = `${ROOT} [data-focus='add']`;
  const titleField = `${ROOT} [data-testid='item-form'] [name='title']`;
  await openCreate();
  await waitForFocus(titleField);
  const dialog = browser.$(`${ROOT} [role='dialog']`);
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(
    await browser.execute(
      (root) =>
        Boolean(document.querySelector(root + " [data-testid='app-frame']")?.closest("[inert]")),
      ROOT,
    ),
  ).toBe(true);
  await browser.keys(["Shift", "Tab"]);
  await browser.waitUntil(() =>
    browser.execute(
      (root) => Boolean(document.activeElement?.closest(root + " [role='dialog']")),
      ROOT,
    ),
  );
  await browser.keys("Escape");
  await itemForm().waitForDisplayed({ reverse: true });
  await waitForFocus(add);

  await openCreate();
  await save();
  await expect(itemForm().$("[data-testid='item-form-summary'][role='alert']")).toBeDisplayed();
  await waitForFocus(titleField);
  await fillTitle("Focused item");
  await save();
  const id = noteId(await waitForNote(itemPath("Focused item")));
  const edit = `${ROOT} [data-card-key=${JSON.stringify(id)}] [data-focus='edit']`;
  await waitForFocus(edit);

  await openEdit(id);
  await fillTitle("Focused title update");
  await save();
  await waitForNote(itemPath("Focused title update"));
  await waitForFocus(edit);

  const remove = `${ROOT} [data-card-key=${JSON.stringify(id)}] [data-focus='remove']`;
  await itemCard(id).$("[data-focus='remove']").click();
  const cancel = dialog.$(`button=${texts.notes.deleteDialog.cancel}`);
  await cancel.waitForDisplayed();
  await waitForFocus(`${ROOT} [role='dialog'] [data-autofocus]`);
  await cancel.click();
  await waitForFocus(remove);
  await itemCard(id).$("[data-focus='remove']").click();
  await dialog.$(`button=${texts.notes.deleteDialog.confirm}`).click();
  await itemCard(id).waitForDisplayed({ reverse: true });
  await waitForFocus(add);
  expect(await pluginProblems()).toEqual([]);
});
