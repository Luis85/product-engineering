import { expect } from "@wdio/globals";
import { it } from "mocha";
import { fixtureId, fixtureItem, itemCard, itemPath, openItems, texts, writeNote } from "../items";
import { installConsoleSpy, pluginProblems, readVaultText, reloadPlugin } from "../support";

it("lists a newer item as read-only and preserves its file across a plugin reload", async () => {
  await installConsoleSpy();
  const id = fixtureId(9);
  const path = itemPath("Future item");
  const original = fixtureItem(id, "Future item", {
    version: 2,
    fields: { future_property: "untouched" },
    body: "# Future body\n",
  });
  await writeNote(path, original);
  await openItems();
  await itemCard(id).$("[data-issue-code='schema.newer']").waitForDisplayed();
  await expect(itemCard(id).$("[data-focus='edit']")).not.toExist();
  await expect(itemCard(id).$("[data-focus='remove']")).not.toExist();
  await expect(itemCard(id).$(`button=${texts.notes.openNote}`)).toBeDisplayed();
  await reloadPlugin();
  await openItems();
  await itemCard(id).$("[data-issue-code='schema.newer']").waitForDisplayed();
  expect(await readVaultText(path)).toBe(original);
  expect(await pluginProblems()).toEqual([]);
});
