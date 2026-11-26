import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import {
  fillTitle,
  fixtureId,
  fixtureItem,
  itemCard,
  itemForm,
  itemPath,
  openEdit,
  openItems,
  save,
  texts,
  waitForNote,
  writeNote,
} from "../items";
import { installConsoleSpy, pluginProblems, readVaultText, ROOT } from "../support";

it("merges a different outside field and lets the user resolve a same-field conflict", async () => {
  await installConsoleSpy();
  const id = fixtureId(7);
  const path = itemPath("Initial title");
  const original = fixtureItem(id, "Initial title", { body: "# Shared body\n" });
  await writeNote(path, original);
  await openItems();
  await itemCard(id).waitForDisplayed();
  await openEdit(id);
  await fillTitle("Form title");
  await writeNote(path, original.replace("status: open", "status: done"));
  await save();

  const renamed = itemPath("Form title");
  const merged = await waitForNote(renamed);
  expect(merged).toContain("status: done");
  expect(merged).toContain("# Shared body\n");
  await itemForm().waitForDisplayed({ reverse: true });
  await openEdit(id);
  await fillTitle("My resolution");
  const external = merged.replace("title: Form title", "title: Vault title");
  await writeNote(renamed, external);
  await save();

  const panel = browser.$(`${ROOT} [role='dialog']`);
  const heading = panel.$(`h3=${texts.notes.conflict.title}`);
  await heading.waitForDisplayed();
  await browser.waitUntil(() =>
    browser.execute(
      (title) => document.activeElement?.textContent?.trim() === title,
      texts.notes.conflict.title,
    ),
  );
  const choices = await panel.getText();
  expect(choices).toContain("Form title");
  expect(choices).toContain("My resolution");
  expect(choices).toContain("Vault title");
  expect(await readVaultText(renamed)).toBe(external);

  await panel.$("[type='radio'][value='mine']").click();
  await panel.$(`button=${texts.notes.conflict.apply}`).click();
  await save();
  expect(await waitForNote(renamed, (text) => text.includes("title: My resolution"))).toBe(
    external.replace("title: Vault title", "title: My resolution"),
  );
  expect(await pluginProblems()).toEqual([]);
});
