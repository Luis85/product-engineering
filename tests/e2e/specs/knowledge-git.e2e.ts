import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { renameSync } from "node:fs";
import { join } from "node:path";
import { projectOverviewRoute } from "../../../src/application/projects";
import { isKnowledgeId } from "../../../src/domain/knowledge";
import { splitNoteText } from "../../../src/domain/notes";
import { projectKnowledgeRoute } from "../../../src/application/knowledge";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerFolder, customerProject, customerRequirement, jobOne } from "../knowledge-vault";
import {
  fixtureAuthor,
  originalMessage,
  otherFile,
  secondMessage,
  seedKnowledgeGitVault,
  trackedNote,
  untrackedFile,
} from "../knowledge-git-vault";
import { openView, readVaultText, ROOT, setViewRoute, VIEW_TYPE } from "../support";

let repo: Awaited<ReturnType<typeof seedKnowledgeGitVault>>;

before(async () => {
  repo = await seedKnowledgeGitVault();
});

const button = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const versions = () => button("git-versions");
const diff = () => button("git-comparison");
const revision = (oid: string) => versions().$(`[data-git-oid="${oid}"]`);

async function openTrackedNote() {
  await openView();
  await setViewRoute(projectKnowledgeRoute(customerProject));
  await browser.$(`${ROOT} [data-knowledge-record="${customerRequirement}"]`).click();
  await expect(button("knowledge-note").$("h1")).toHaveText("Servicefälle übergeben");
}

it("compares clean working bytes and both known revisions in the native Knowledge route", async () => {
  await openTrackedNote();
  await button("knowledge-history-tab").click();
  await expect(versions()).toBeDisplayed();
  const worktree = versions().$("[data-testid=git-working]");
  await expect(worktree).toBeDisplayed();
  await expect(worktree).toHaveAttribute("aria-pressed", "true");
  await expect(diff()).toHaveText(expect.stringContaining("Keine Unterschiede"));
  await expect(revision(repo.second)).toHaveText(expect.stringContaining(secondMessage));
  await expect(revision(repo.initial)).toHaveText(expect.stringContaining(originalMessage));
  await expect(revision(repo.second)).toHaveText(expect.stringContaining(fixtureAuthor));

  await revision(repo.initial).click();
  await expect(revision(repo.initial)).toHaveAttribute("aria-pressed", "true");
  await expect(diff()).toHaveText(expect.stringContaining("Neue Datei"));
  await expect(diff().$(".pe-git-add:first-child")).toBeDisplayed();

  await revision(repo.second).click();
  await expect(revision(repo.second)).toHaveAttribute("aria-pressed", "true");
  await expect(diff()).toHaveAttribute("data-git-parent", repo.initial);
  await expect(diff()).toHaveText(expect.stringContaining("+ ## Kundenproblem"));
  await expect(diff()).toHaveText(expect.stringContaining("- ## Problem"));
  await expect(diff()).toHaveText(expect.stringContaining("Servicefälle übergeben"));
  await worktree.click();
  await expect(worktree).toBeFocused();
  await expect(diff()).toHaveText(expect.stringContaining("Keine Unterschiede"));
});

const dialog = () => button("git-commit-form");
const editor = () => browser.$(`${ROOT} textarea[name=markdown]`);

it("takes a saved edit directly to comparison and commits exact bytes with the new revision selected", async () => {
  await openTrackedNote();
  await button("knowledge-edit").click();
  await editor().setValue("## Abnahme\n\nÜberarbeitete Übergabe.");
  await button("knowledge-save").click();
  await expect(button("knowledge-save")).toBeDisabled();
  await button("knowledge-content-tab").click();
  await expect(button("git-compare-saved")).toBeDisplayed();
  await button("git-compare-saved").click();
  await expect(diff()).toHaveText(expect.stringContaining("+ Überarbeitete Übergabe."));
  await expect(button("knowledge-note-header")).toHaveText(expect.stringContaining("Freigegeben"));
  const left = repo.head();
  const reviewed = repo.read(trackedNote);
  const staged = repo.git("diff", "--cached", "--binary", "--", otherFile);
  const uncommitted = repo.git("diff", "--binary", "--", otherFile);
  await button("git-commit").click();
  await expect(dialog()).toBeDisplayed();
  await expect(browser.$(`${ROOT} [role=dialog][data-state=open]`)).toHaveText(
    expect.stringContaining(trackedNote),
  );
  const message = dialog().$("input[name=message]");
  await expect(message).toBeFocused();
  await message.setValue("   ");
  await dialog().$("button[type=submit]").click();
  await expect(message).toHaveAttribute("aria-invalid", "true");
  expect(repo.head()).toBe(left);
  await message.setValue("Geprüften Arbeitsstand festschreiben");
  await dialog().$("button[type=submit]").click();
  await finishCommit();
  const right = repo.head();
  expect(right).toMatch(/^[\da-f]{40,64}$/);
  expect(right).not.toBe(left);
  await expect(revision(right)).toHaveAttribute("aria-pressed", "true");
  await expect(revision(right)).toBeFocused();
  await expect(button("git-announcement")).toHaveText(expect.stringContaining(right.slice(0, 8)));
  await expect(diff()).toHaveAttribute("data-git-parent", left);
  expect(repo.git("show", right + ":" + trackedNote)).toEqual(reviewed);
  expect(repo.git("diff-tree", "--no-commit-id", "--name-only", "-r", "-z", right).toString()).toBe(
    trackedNote + "\0",
  );
  expect(repo.git("diff", "--cached", "--binary", "--", otherFile)).toEqual(staged);
  expect(repo.git("diff", "--binary", "--", otherFile)).toEqual(uncommitted);
  expect(repo.git("show", ":" + otherFile)).toEqual(repo.stagedOther);
  expect(repo.read(otherFile).toString()).toBe("Unstaged independently\n");
  expect(repo.read(untrackedFile).toString()).toBe("Outside this commit\n");
});

async function inspectCommitDialog() {
  return browser.execute((scope) => {
    const panel = document.querySelector(scope)?.querySelector("[role=dialog][data-state=open]");
    const leaf = panel?.closest(".workspace-leaf");
    if (!panel || !leaf) return;
    const bounds = leaf.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    return {
      width: bounds.width,
      inside: bounds.left <= panelBounds.left && bounds.right >= panelBounds.right,
      scroll: panel.scrollWidth - panel.clientWidth,
    };
  }, ROOT);
}

it("saves first, cancels with keyboard focus in a 390px split, and commits exactly once from the pop-out", async () => {
  await openTrackedNote();
  await narrowKnowledgeLeaf();
  const left = repo.head();
  await button("knowledge-edit").click();
  await editor().setValue("## Pop-out\n\nNach Abbrechen bleibt der Text.");
  await expect(button("git-save-and-commit")).toBeDisplayed();
  await button("git-save-and-commit").click();
  await expect(dialog().$("input[name=message]")).toBeFocused();
  expect(await inspectCommitDialog()).toMatchObject({ width: 390, inside: true, scroll: 0 });
  await browser.keys("Escape");
  await expect(dialog()).not.toBeDisplayed();
  await expect(editor()).toBeFocused();
  expect(repo.head()).toBe(left);
  const bytes = repo.read(trackedNote);
  expect(bytes.toString()).toContain("Nach Abbrechen bleibt der Text.");

  const main = await browser.getWindowHandle();
  await browser.executeObsidian(({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    if (!leaf) throw new Error("Missing Knowledge leaf");
    app.workspace.moveLeafToPopout(leaf);
  }, VIEW_TYPE);
  try {
    const popout = await browser.waitUntil(
      async () => (await browser.getWindowHandles()).find((handle) => handle !== main) ?? false,
    );
    await browser.switchToWindow(popout);
    await browser.execute((scope) => {
      const pane = document.querySelector(scope)?.closest<HTMLElement>(".workspace-leaf");
      if (!pane) throw new Error("Missing pop-out leaf");
      pane.style.flex = "0 0 390px";
      pane.style.width = "390px";
    }, ROOT);
    await button("git-commit").click();
    const field = dialog().$("input[name=message]");
    await expect(field).toBeFocused();
    expect(await inspectCommitDialog()).toMatchObject({ width: 390, inside: true, scroll: 0 });
    await browser.keys("Escape");
    await expect(button("git-commit")).toBeFocused();
    expect(repo.head()).toBe(left);

    await browser.keys("Enter");
    await expect(field).toBeFocused();
    await field.setValue("Im Pop-out einmal festschreiben");
    await browser.keys("Enter");
    await finishCommit();
    const oid = repo.head();
    await expect(revision(oid)).toBeFocused();
    expect(
      repo
        .git("rev-list", "--count", left + "..HEAD")
        .toString()
        .trim(),
    ).toBe("1");
    expect(repo.git("show", oid + ":" + trackedNote)).toEqual(bytes);
  } finally {
    await browser.switchToWindow(main);
    await browser.executeObsidian(({ app }, type) => {
      app.workspace
        .getLeavesOfType(type)
        .find(({ view }) => view.containerEl.ownerDocument !== document)
        ?.detach();
    }, VIEW_TYPE);
  }
});

it("keeps failed revision comparison selected and the commit message after an outside second save", async () => {
  await openTrackedNote();
  await button("knowledge-history-tab").click();
  await expect(revision(repo.initial)).toBeDisplayed();
  const blob = repo
    .git("rev-parse", repo.initial + ":" + trackedNote)
    .toString()
    .trim();
  const blobFile = join(repo.cwd, ".git", "objects", blob.slice(0, 2), blob.slice(2));
  const temporarilyMissing = blobFile + ".fixture";
  renameSync(blobFile, temporarilyMissing);
  try {
    await revision(repo.initial).click();
    await expect(diff().$("[role=alert]")).toBeDisplayed();
    await expect(revision(repo.initial)).toHaveAttribute("aria-pressed", "true");
  } finally {
    renameSync(temporarilyMissing, blobFile);
  }
  await diff().$("button=Erneut versuchen").click();
  await expect(diff().$(".pe-git-add:first-child")).toBeDisplayed();
  await expect(revision(repo.initial)).toHaveAttribute("aria-pressed", "true");

  await button("knowledge-edit").click();
  await editor().setValue("Erster geprüfter Arbeitsstand.");
  await button("knowledge-save").click();
  await button("git-compare-saved").click();
  await expect(diff()).toHaveText(expect.stringContaining("+ Erster geprüfter Arbeitsstand."));
  await button("git-commit").click();
  const draft = "Nach erneuter Prüfung festschreiben";
  await dialog().$("input[name=message]").setValue(draft);
  const head = repo.head();
  const outside =
    repo.read(trackedNote).toString() + "\nZweiter, extern gespeicherter Arbeitsstand.\n";
  repo.write(trackedNote, outside);
  await dialog().$("button[type=submit]").click();
  await expect(button("git-commit-error")).toBeDisplayed();
  await expect(dialog().$("input[name=message]")).toHaveValue(draft);
  expect(repo.head()).toBe(head);
  expect(repo.read(trackedNote).toString()).toBe(outside);

  await button("git-review-current").click();
  await expect(button("git-review-current")).not.toBeDisplayed();
  await expect(diff()).toHaveText(
    expect.stringContaining("+ Zweiter, extern gespeicherter Arbeitsstand."),
  );
  await button("git-commit").click();
  await expect(dialog().$("input[name=message]")).toHaveValue(draft);
  await dialog().$("button[type=submit]").click();
  await finishCommit();
  const oid = repo.head();
  await expect(revision(oid)).toHaveAttribute("aria-pressed", "true");
  expect(
    repo
      .git("rev-list", "--count", head + "..HEAD")
      .toString()
      .trim(),
  ).toBe("1");
  expect(repo.git("show", oid + ":" + trackedNote).toString()).toBe(outside);
});
const relation = (id: string) => browser.$(`${ROOT} [data-knowledge-relation="${id}"]`);
const activeDialog = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);

async function derive(kind: "research" | "prd", title: string) {
  await button("knowledge-create-" + kind).click();
  await activeDialog().$("input[name=title]").setValue(title);
  await activeDialog().$("button[type=submit]").click();
  await expect(editor()).toBeFocused();
  const path = title + ".md";
  const id = /^id: (.+)$/m.exec(repo.read(path).toString())?.[1];
  if (!isKnowledgeId(id)) throw new Error("Missing derived Knowledge identity");
  return { id, path };
}

async function finishCommit() {
  const failure = button("git-commit-error");
  const done = async () => !(await dialog().isDisplayed()) || (await failure.isDisplayed());
  await browser.waitUntil(done, { timeout: 20_000 });
  if (await failure.isDisplayed())
    throw new Error("Git commit failed: " + (await failure.getText()));
}

async function commitFromNote(message: string) {
  await button("git-commit").click();
  await dialog().$("input[name=message]").setValue(message);
  await dialog().$("button[type=submit]").click();
  await finishCommit();
  const oid = repo.head();
  await expect(revision(oid)).toHaveAttribute("aria-pressed", "true");
  return oid;
}

it("J02 derives research and a PRD from JOB-12 and verifies the saved PRD, Git parent and Vault after host reload", async function () {
  this.timeout(120_000);
  await openView();
  await setViewRoute(projectOverviewRoute(customerProject));
  await button("project-knowledge-entry").click();
  await browser.$(`${ROOT} [data-knowledge-record="${jobOne}"]`).click();
  await expect(button("knowledge-note-header")).toHaveText(expect.stringContaining("JOB-12"));

  const research = await derive("research", "J02 Übergabe erforschen");
  await editor().setValue("## Gespräche\n\nMara bestätigt die Übergabe.");
  await button("knowledge-save").click();
  await expect(button("knowledge-save")).toBeDisabled();
  await relation(jobOne).click();
  await expect(relation(research.id)).toBeDisplayed();

  const prd = await derive("prd", "J02 Übergabe absichern");
  await expect(relation(jobOne)).toBeDisplayed();
  await relation(jobOne).click();
  await expect(relation(prd.id)).toBeDisplayed();
  await relation(research.id).click();
  await expect(relation(jobOne)).toBeDisplayed();
  await relation(jobOne).click();
  await relation(prd.id).click();
  await expect(relation(jobOne)).toBeDisplayed();
  expect(splitNoteText(repo.read(prd.path).toString()).frontmatter?.yaml).toContain(jobOne);
  const pbiCount = await browser.executeObsidian(
    ({ app }) =>
      app.vault.getMarkdownFiles().filter((file) => {
        const fields = app.metadataCache.getFileCache(file)?.frontmatter;
        return fields?.kind === "pbi" || fields?.schema === "product-engineering.item/v1";
      }).length,
  );
  expect(pbiCount).toBe(0);
  await expect(button("knowledge-note-header")).toHaveText(
    expect.stringContaining("Erster Commit ausstehend"),
  );
  await expect(button("knowledge-note-header")).toHaveText(expect.stringContaining("Entwurf"));

  const staged = repo.git("diff", "--cached", "--binary", "--", otherFile);
  const unstaged = repo.git("diff", "--binary", "--", otherFile);
  const researchBytes = repo.read(research.path);
  const original = repo.read(prd.path);
  const parent = await commitFromNote("J02 PRD-Ausgangsstand");
  expect(repo.git("show", parent + ":" + prd.path)).toEqual(original);

  await button("knowledge-edit").click();
  await browser.$(`${ROOT} input[name=title]`).setValue("J02 Übergabe mit Abnahme");
  await editor().setValue("## Abnahme\n\nDer Dienst bestätigt offene Fälle.");
  await button("knowledge-save").click();
  await expect(button("knowledge-save")).toBeDisabled();
  const saved = repo.read(prd.path);
  expect(repo.head()).toBe(parent);
  await button("git-compare-saved").click();
  await expect(diff()).toHaveText(expect.stringContaining("+ ## Abnahme"));
  await expect(diff()).toHaveText(expect.stringContaining("title: J02 Übergabe mit Abnahme"));
  await expect(diff()).toHaveText(expect.stringContaining("title: J02 Übergabe absichern"));
  const oid = await commitFromNote("J02 PRD-Abnahme präzisieren");
  await expect(diff()).toHaveAttribute("data-git-parent", parent);
  await expect(diff()).toHaveText(expect.stringContaining(prd.path));

  expect(repo.git("rev-parse", "HEAD^").toString().trim()).toBe(parent);
  expect(repo.git("diff-tree", "--no-commit-id", "--name-only", "-r", "-z", oid).toString()).toBe(
    prd.path + "\0",
  );
  expect(repo.git("show", oid + ":" + prd.path)).toEqual(saved);
  expect(repo.git("show", parent + ":" + prd.path)).toEqual(original);
  expect(repo.git("diff", "--cached", "--binary", "--", otherFile)).toEqual(staged);
  expect(repo.git("diff", "--binary", "--", otherFile)).toEqual(unstaged);
  expect(repo.read(research.path)).toEqual(researchBytes);

  await browser.waitUntil(
    async () => (await readVaultText(".obsidian/workspace.json"))?.includes(prd.id) ?? false,
  );
  await browser.reloadObsidian();
  await expect(button("knowledge-note-header").$("h1")).toHaveText("J02 Übergabe mit Abnahme");
  await expect(button("knowledge-note-header")).toHaveText(expect.stringContaining("Entwurf"));
  await button("knowledge-history-tab").click();
  await expect(diff()).toHaveText(expect.stringContaining("Keine Unterschiede"));
  await revision(oid).click();
  await expect(diff()).toHaveAttribute("data-git-parent", parent);
  await expect(diff()).toHaveText(expect.stringContaining("+ Der Dienst bestätigt offene Fälle."));
  expect(await readVaultText(customerFolder + "/" + prd.path)).toBe(saved.toString());
});
it("uses the Git panel width once the expanded project rail consumes space", async () => {
  await openTrackedNote();
  await button("knowledge-history-tab").click();
  await expect(versions()).toBeDisplayed();
  await narrowKnowledgeLeaf();
  const dimensions = () =>
    browser.execute((scope) => {
      const root = document.querySelector(scope);
      const history = root?.querySelector(".pe-git-history");
      const versionList = root?.querySelector("[data-testid=git-versions]");
      const comparison = root?.querySelector("[data-testid=git-comparison]");
      if (!history || !versionList || !comparison) throw new Error("Missing Git panel");
      const first = versionList.getBoundingClientRect();
      const second = comparison.getBoundingClientRect();
      return {
        width: history.getBoundingClientRect().width,
        columns: Math.abs(first.top - second.top) < 1,
      };
    }, ROOT);
  const size = (width: number) =>
    browser.executeObsidian(
      ({ app }, type, value) => {
        const pane = app.workspace
          .getLeavesOfType(type)[0]
          ?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
        if (!pane) throw new Error("Missing split pane");
        pane.style.flex = `0 0 ${value}px`;
        pane.style.width = `${value}px`;
      },
      VIEW_TYPE,
      width,
    );
  await size(1180);
  await browser.waitUntil(async () => (await dimensions()).width > 650);
  expect((await dimensions()).columns).toBe(true);
  await size(860);
  await browser.waitUntil(async () => (await dimensions()).width < 650);
  expect((await dimensions()).columns).toBe(false);
  await size(390);
  await browser.waitUntil(async () => (await dimensions()).width < 390);
  expect((await dimensions()).columns).toBe(false);
});

it("shows distant saved edits on two reachable pages in the installed History panel", async () => {
  await openTrackedNote();
  const lines = Array.from({ length: 600 }, (_, index) => "Unverändert " + (index + 1));
  const edited = lines.with(9, "Frühe Änderung").with(499, "Späte Änderung");
  const paste = async (body: readonly string[]) => {
    await button("knowledge-edit").click();
    await browser.execute(
      (scope, value) => {
        const field = document.querySelector<HTMLTextAreaElement>(
          scope + " textarea[name=markdown]",
        );
        if (!field) throw new Error("Missing Markdown editor");
        field.value = value;
        field.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }),
        );
      },
      ROOT,
      body.join("\n"),
    );
    await button("knowledge-save").click();
    await expect(button("knowledge-save")).toBeDisabled();
  };
  await paste(lines);
  const head = await commitFromNote("Lange Ausgangsnotiz");
  await paste(edited);
  await button("git-compare-saved").click();
  await expect(diff()).toHaveText(expect.stringContaining("+ Frühe Änderung"));
  await button("git-diff-next").click();
  await expect(diff()).toHaveText(expect.stringContaining("+ Späte Änderung"));
  await button("git-diff-previous").click();
  await expect(diff()).toHaveText(expect.stringContaining("+ Frühe Änderung"));
  expect(repo.head()).toBe(head);
});
