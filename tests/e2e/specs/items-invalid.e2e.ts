import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import type { MarkdownView } from "obsidian";
import {
  fixtureId,
  fixtureItem,
  itemCard,
  itemPath,
  openEdit,
  openItems,
  save,
  selectStatus,
  texts,
  waitForNote,
  writeNote,
} from "../items";
import { installConsoleSpy, pluginProblems, readVaultText, ROOT, VIEW_TYPE } from "../support";

it("shows record issues, repairs a broken field, and opens unreadable notes separately", async () => {
  await installConsoleSpy();
  const repair = fixtureId(11);
  const repeat = fixtureId(12);
  const duplicate = fixtureId(14);
  const clean = fixtureId(15);
  const repairPath = itemPath("Repair me");
  const repeatedPath = itemPath("Repeated A");
  const repeated = fixtureItem(repeat, "Repeated title");
  const duplicatePath = itemPath("Duplicate A");
  const otherPath = itemPath("Duplicate B");
  const duplicateText = fixtureItem(duplicate, "Duplicate A");
  const unreadable = itemPath("Unreadable");
  const brokenText = "---\nstatus: [\n---\nBody stays.\n";

  await writeNote(repairPath, fixtureItem(repair, "Repair me", { status: "broken" }));
  await writeNote(repeatedPath, repeated);
  await writeNote(itemPath("Repeated B"), fixtureItem(fixtureId(13), "Repeated title"));
  await writeNote(duplicatePath, duplicateText);
  await writeNote(otherPath, fixtureItem(duplicate, "Duplicate B"));
  await writeNote(itemPath("Valid example"), fixtureItem(clean, "Valid example"));
  await writeNote(unreadable, brokenText);
  await openItems();

  await itemCard(clean).waitForDisplayed();
  await itemCard(repair).$("[data-issue-code='status.unknown']").waitForDisplayed();
  await itemCard(repeat).$("[data-issue-code='title.duplicate']").waitForDisplayed();
  const duplicateIssue = itemCard(duplicatePath).$("[data-issue-code='id.duplicate']");
  await duplicateIssue.waitForDisplayed();
  expect(await duplicateIssue.getText()).toContain(otherPath);
  await expect(itemCard(duplicatePath).$("[data-focus='edit']")).not.toExist();

  await openEdit(repair);
  await selectStatus("done");
  await save();
  await waitForNote(repairPath, (text) => text.includes("status: done"));
  await itemCard(repair).$("[data-issue-code='status.unknown']").waitForExist({ reverse: true });
  expect(await readVaultText(duplicatePath)).toBe(duplicateText);
  expect(await readVaultText(repeatedPath)).toBe(repeated);

  const section = browser
    .$(`${ROOT} [data-testid='settings-sections']`)
    .$(`button*=${texts.notes.unindexed.label}`);
  await expect(section.$("[data-testid='data-issues-badge']")).toHaveText("1");
  await section.click();
  const issues = browser.$(`${ROOT} [data-testid='data-issues-list']`);
  await expect(issues).toHaveText(expect.stringContaining(unreadable));
  await issues.$(`button=${texts.notes.openNote}`).click();
  await browser.waitUntil(() =>
    browser.executeObsidian(
      ({ app }, path, type) =>
        app.workspace.getLeavesOfType(type).length > 0 &&
        app.workspace
          .getLeavesOfType("markdown")
          .some(({ view }) => (view as MarkdownView).file?.path === path),
      unreadable,
      VIEW_TYPE,
    ),
  );
  expect(await readVaultText(unreadable)).toBe(brokenText);
  expect(await pluginProblems()).toEqual([]);
});
