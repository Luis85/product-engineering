import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { projectKnowledgeRoute } from "../../../src/application/knowledge";
import { seedKnowledgeGitVault, trackedNote } from "../knowledge-git-vault";
import { customerProject, customerRequirement } from "../knowledge-vault";
import { openView, ROOT, setViewRoute } from "../support";

const button = (name: string) => browser.$(`${ROOT} [data-testid="${name}"]`);
const revision = (oid: string) => browser.$(`${ROOT} [data-git-oid="${oid}"]`);
const editor = () => browser.$(`${ROOT} textarea[name=markdown]`);
const comparison = () => button("git-comparison");

it("refreshes Git on ordinary History reentry and keeps a reachable revision and the dirty editor", async () => {
  const repo = await seedKnowledgeGitVault();
  await openView();
  await setViewRoute(projectKnowledgeRoute(customerProject));
  await browser.$(`${ROOT} [data-knowledge-record="${customerRequirement}"]`).click();
  await button("knowledge-edit").click();
  await editor().setValue(
    "## Abnahme\n\nDieser gespeicherte Stand wird außerhalb festgeschrieben.",
  );
  await button("knowledge-save").click();
  await expect(button("knowledge-save")).toBeDisabled();

  const oldHead = repo.head();
  const saved = repo.read(trackedNote);
  const historyTab = button("knowledge-history-tab");
  const contentTab = button("knowledge-content-tab");
  await historyTab.click();
  await expect(comparison()).toHaveAttribute("data-git-parent", oldHead);
  await expect(comparison()).toHaveText(expect.stringContaining("+ Dieser gespeicherte Stand"));
  await contentTab.click();
  repo.git("commit", "--quiet", "--only", "-m", "Außerhalb festgeschrieben", "--", trackedNote);
  const external = repo.head();
  expect(external).not.toBe(oldHead);
  expect(repo.git("show", external + ":" + trackedNote)).toEqual(saved);
  expect(repo.read(trackedNote)).toEqual(saved);

  await historyTab.click();
  await expect(comparison()).toHaveAttribute("data-git-parent", external);
  await expect(comparison()).toHaveText(expect.stringContaining("Keine Unterschiede"));
  await expect(button("knowledge-note-header")).toHaveText(
    expect.stringContaining("Festgeschrieben"),
  );
  await expect(revision(external)).toHaveText(expect.stringContaining("Außerhalb festgeschrieben"));
  await expect(button("git-working")).toHaveAttribute("aria-pressed", "true");

  await revision(repo.initial).click();
  await expect(comparison()).toHaveText(expect.stringContaining("Neue Datei"));
  await button("knowledge-editing-tab").click();
  const unsaved = "Noch nicht im Vault gespeicherter Entwurf.";
  await editor().setValue(unsaved);
  await historyTab.click();
  await expect(revision(repo.initial)).toHaveAttribute("aria-pressed", "true");
  await expect(comparison()).toHaveText(expect.stringContaining("Neue Datei"));
  await button("knowledge-editing-tab").click();
  await expect(editor()).toHaveValue(unsaved);
  await button("project-record-return").click();
  await expect(button("knowledge-keep-editing")).toBeDisplayed();
  await button("knowledge-keep-editing").click();
  await expect(editor()).toHaveValue(unsaved);
  expect(repo.read(trackedNote)).toEqual(saved);

  await historyTab.click();
  await revision(external).click();
  await expect(revision(external)).toHaveAttribute("aria-pressed", "true");
  await contentTab.click();
  repo.git("update-ref", "HEAD", oldHead, external);
  await historyTab.click();
  await expect(revision(external)).not.toExist();
  await expect(button("git-working")).toHaveAttribute("aria-pressed", "true");
  await expect(comparison()).toHaveAttribute("data-git-parent", oldHead);
  await button("knowledge-editing-tab").click();
  await expect(editor()).toHaveValue(unsaved);
  expect(repo.read(trackedNote)).toEqual(saved);
});
