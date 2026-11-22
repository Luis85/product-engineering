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
  selectStatus,
  texts,
  waitForNote,
  waitForNotice,
  writeNote,
} from "../items";
import { installConsoleSpy, pluginProblems, readVaultText, ROOT } from "../support";

it("creates, validates, renames and trashes an item through real Obsidian", async () => {
  await installConsoleSpy();
  await browser.executeObsidian(({ app }) => {
    const config = app.vault as typeof app.vault & { setConfig(key: string, value: string): void };
    config.setConfig("trashOption", "local");
  });
  await openItems();
  await openCreate();
  await save();
  await expect(itemForm().$("[data-testid='item-form-summary']")).toBeDisplayed();
  expect(await browser.$$(`${ROOT} [data-card-key]`)).toHaveLength(0);

  const title = "Release checklist";
  const originalPath = itemPath(title);
  await fillTitle(title);
  await save();
  const original = await waitForNote(originalPath);
  const id = noteId(original);
  expect(id).toMatch(/^item-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  expect(original).toBe(
    `---\nschema: product-engineering.item/v1\nid: ${id}\ntitle: ${title}\nstatus: open\n---\n`,
  );
  await waitForNotice(texts.notes.notices.created(title));
  await itemCard(id).waitForDisplayed();

  const decorated =
    original.replace(
      "status: open\n",
      "status: open  # keep the status comment\nexternal_key: 'yes'\n",
    ) + "# Preserved body\n\nText outside the form.\n";
  await writeNote(originalPath, decorated);
  await openEdit(id);
  const nextTitle = "Reviewed release checklist";
  const nextPath = itemPath(nextTitle);
  await fillTitle(nextTitle);
  await selectStatus("done");
  await save();
  expect(await waitForNote(nextPath)).toBe(
    decorated
      .replace(`title: ${title}`, `title: ${nextTitle}`)
      .replace("status: open", "status: done"),
  );
  expect(await readVaultText(originalPath)).toBeNull();
  await waitForNotice(texts.notes.notices.saved(nextTitle));
  await itemCard(id).waitForDisplayed();

  await itemCard(id).$("[data-focus='remove']").click();
  const confirm = browser
    .$(`${ROOT} [role='dialog']`)
    .$(`button=${texts.notes.deleteDialog.confirm}`);
  await confirm.waitForDisplayed();
  await confirm.click();
  await itemCard(id).waitForDisplayed({ reverse: true });
  expect(await readVaultText(nextPath)).toBeNull();
  await browser.waitUntil(
    async () =>
      (await readVaultText(".trash/" + nextPath)) !== null ||
      (await readVaultText(".trash/" + nextTitle + ".md")) !== null,
  );
  await waitForNotice(texts.notes.notices.deleted(nextTitle));
  expect(await pluginProblems()).toEqual([]);
});
