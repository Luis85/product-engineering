import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { newNoteText, splitNoteText } from "../../../src/domain/notes";
import {
  epicPath,
  existingBase,
  exportPath,
  featurePath,
  reviewPath,
  seedBacklogVault,
  work,
} from "../backlog-vault";
import { customerProject } from "../knowledge-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setTheme,
  setViewRoute,
} from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = (key: string) => browser.$(`${ROOT} [data-backlog-key="${key}"]`);
const lane = (stage: string) => browser.$(`${ROOT} [data-board-stage="${stage}"]`);
const card = (id: string, stage?: string) =>
  (stage ? lane(stage) : browser.$(ROOT)).$(`[data-board-card="${id}"]`);
const fold = (stage: string) => lane(stage).$("button[aria-expanded]");
const form = () => el("backlog-form");
const boardOpen = (id: string, stage?: string) =>
  card(id, stage).$("[data-testid=board-card-open]");
const list = () => el("backlog-board").$("button=Liste");
const board = () => el("backlog-list").$("button=Board");

async function press(control: WebdriverIO.Element, key = "Enter") {
  await expect(control).toBeDisplayed();
  await browser.execute((element: HTMLElement) => element.focus(), control);
  await browser.keys(key);
}

function baseStatus(path: string) {
  return browser
    .$(".workspace-leaf.mod-active .bases-table")
    .$(
      `.bases-tr:has([data-href="${path}"]) [data-property="note.DeliveryState"] [contenteditable=true]`,
    );
}

function backlogFiles() {
  return browser.executeObsidian(
    ({ app }, folder) =>
      app.vault
        .getMarkdownFiles()
        .filter(({ path }) => path.startsWith(folder + "/"))
        .map(({ path }) => path)
        .toSorted(),
    work,
  );
}

async function editDescription(id: string, path: string, markdown: string) {
  await row(id).$("[data-testid=backlog-row-open]").click();
  await el("backlog-edit-description").click();
  await form().$("textarea[name=markdown]").setValue(markdown);
  await el("backlog-save").click();
  await expect(form()).not.toExist();
  const stored = await readVaultText(path);
  expect(splitNoteText(stored ?? "").body.trim()).toBe(markdown);
}

async function adopt() {
  await row(exportPath).$("[data-testid=backlog-row-open]").click();
  await el("backlog-adopt").click();
  await browser.waitUntil(async () => /pe-id: UC-/.test((await readVaultText(exportPath)) ?? ""));
  const id = /^pe-id: (UC-[a-z0-9-]+)$/m.exec((await readVaultText(exportPath)) ?? "")?.[1];
  if (!id) throw new Error("Expected the canonical identity in the existing note");
  await el("backlog-cancel").click();
  return id;
}

async function quickAdd() {
  const search = el("backlog-board").$("input[name=backlog-search]");
  await search.setValue("Filter ohne Treffer");
  const trigger = lane("Backlog").$("[data-testid=board-new]");
  const paths = await backlogFiles();
  await press(await trigger);
  await expect(form().$("select[name=owner]")).toHaveValue("");
  await expect(form().$("select[name=state]")).toHaveValue("Backlog");
  await browser.keys("Escape");
  await expect(trigger).toBeFocused();
  await expect(search).toHaveValue("Filter ohne Treffer");
  expect(await backlogFiles()).toEqual(paths);

  await press(await trigger);
  await form().$("input[name=title]").setValue("Gebündelte Servicefälle nachvollziehen");
  await form().$("select[name=parent]").selectByVisibleText(expectFeature);
  await el("backlog-save").click();
  const newTitle = lane("Backlog").$("[data-testid=board-card-open]");
  await expect(newTitle).toHaveText("Gebündelte Servicefälle nachvollziehen");
  await expect(newTitle).toBeFocused();
  const next = (await backlogFiles()).filter((path) => !paths.includes(path));
  expect(next).toHaveLength(1);
  const [created] = next;
  if (!created) throw new Error("Missing canonical PBI from the Backlog lane");
  const raw = await readVaultText(created);
  expect(raw).toContain("DeliveryState: Backlog");
  expect(raw).not.toContain("Steward:");
}

const expectFeature = "Servicefälle verwalten";

async function companions(id: string) {
  const actions = card(id).$("details.pe-board-actions");
  expect(await actions.getProperty("open")).toBe(false);
  await press(await actions.$("summary"));
  const trigger = card(id).$("[data-testid=board-add-companion]");
  const original = await backlogFiles();
  for (const [kind, storageType] of [
    ["TASK", "Task"],
    ["ISS", "Issue"],
    ["Q", "Question"],
    ["BUG", "Bug"],
  ] as const) {
    await press(await trigger);
    await expect(browser.$(`${ROOT} [role=dialog]`)).toHaveText(expect.stringContaining(id));
    await el("pbi-companion-" + kind).click();
    await expect(form().$("select[name=state]")).toHaveValue("Open");
    await expect(form().$("select[name=priority]")).toHaveValue("P2");
    await expect(form().$("select[name=owner]")).toHaveValue("");
    await form()
      .$("input[name=title]")
      .setValue("Vom Board " + storageType);
    await press(await el("backlog-save"));
    await expect(trigger).toBeFocused();
  }
  await press(await actions.$("summary"));
  expect(await actions.getProperty("open")).toBe(false);
  const count = actions.$("summary [data-testid=board-companion-count]");
  await expect(count).toBeDisplayed();
  await expect(count).toHaveText("4 offen · 4 insgesamt");
  const added = (await backlogFiles()).filter((path) => !original.includes(path));
  expect(added).toHaveLength(4);
  for (const [kind, storageType] of [
    ["TASK", "Task"],
    ["ISS", "Issue"],
    ["Q", "Question"],
    ["BUG", "Bug"],
  ] as const) {
    const path = added.find((candidate) => candidate.includes("Vom Board " + storageType));
    if (!path) throw new Error("Missing canonical " + storageType);
    const note = await readVaultText(path);
    expect(note).toContain("pe-id: " + kind + "-");
    expect(note).toContain("Gefilterte Servicefälle exportieren");
    expect(note).not.toContain("Steward:");
  }
}

async function checkNarrow(id: string) {
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  const metrics = await browser.execute(
    (root: HTMLElement, pbiId: string) => {
      const surface = root.querySelector<HTMLElement>("[data-testid=project-content]");
      const scroll = root.querySelector<HTMLElement>("[data-testid=board-scroll]");
      const heading = root.querySelector<HTMLElement>(
        `[data-board-card="${pbiId}"] [data-testid=board-card-open]`,
      );
      const label = heading?.firstElementChild;
      return {
        spill: surface ? surface.scrollWidth - surface.clientWidth : Infinity,
        leaf: root.closest(".workspace-leaf")?.getBoundingClientRect().width,
        scroll: Boolean(scroll),
        title: heading?.getBoundingClientRect().width ?? 0,
        visibleTitle: Boolean(
          label && label.clientWidth && label.scrollWidth <= label.clientWidth + 1,
        ),
      };
    },
    await browser.$(ROOT),
    id,
  );
  expect(metrics.leaf).toBe(390);
  expect(metrics.spill).toBeLessThanOrEqual(1);
  expect(metrics.scroll).toBe(true);
  expect(metrics.title).toBeGreaterThan(100);
  expect(metrics.visibleTitle).toBe(true);
  await expect(card(id).$("select")).toBeDisplayed();
}

async function switchProject(title: string) {
  await el("project-rail").$("[data-pe-focus-key=project-picker]").click();
  await browser.$(`${ROOT} [role=dialog] button[aria-label="${title}"]`).click();
  await el("project-rail").$("button=Backlog").click();
}

async function expectMappedStage(outside: string, stage: "Backlog" | "Done") {
  const raw = await readVaultText(exportPath);
  expect(/^pbi_stage_choice: ([^\r\n]+)/m.exec(raw ?? "")?.[1]).toBe(stage);
  expect(raw?.replace(/^pbi_stage_choice: [^\r\n]+\r?\n/m, "")).toBe(
    outside.replace("DeliveryState: Review", "DeliveryState: " + stage),
  );
}

async function dragIntoFoldedBacklog(id: string, outside: string) {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 920,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const source = card(id, "Done").$(".pe-board-card-meta:first-child");
  await expect(source).toBeDisplayed();
  await source.dragAndDrop(await lane("Backlog").$("h3"), { duration: 700 });
  await expect(fold("Backlog")).toHaveAttribute("aria-expanded", "false");
  await expect(fold("Backlog")).toBeFocused();
  await expect(lane("Backlog").$("[data-testid=board-lane-count]")).toHaveText("2");
  await expectMappedStage(outside, "Backlog");
  await press(await fold("Backlog"));
  const move = card(id, "Backlog").$("select");
  await press(await move, "End");
  await expect(card(id, "Done")).toBeDisplayed();
  await press(await fold("Backlog"));
}

async function checkScrolledReturn(id: string) {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1160,
    height: 700,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const title = boardOpen(id, "Done");
  const search = el("backlog-board").$("input[name=backlog-search]");
  await search.setValue(id);
  await title.scrollIntoView({ block: "nearest", inline: "nearest" });
  await browser.execute(
    (element: HTMLElement) => element.focus({ preventScroll: true }),
    await title,
  );
  const labelFits = await browser.execute(
    (element: HTMLElement) => {
      const label = element.firstElementChild;
      return Boolean(label && label.clientWidth && label.scrollWidth <= label.clientWidth + 1);
    },
    await title,
  );
  expect(labelFits).toBe(true);
  const scroll = () => el("board-scroll").getProperty("scrollLeft");
  const offset = await scroll();
  expect(offset).toBeGreaterThan(0);
  await browser.keys("Enter");
  await expect(el("pbi-detail")).toBeDisplayed();
  const companionsTab = el("pbi-tab-companions");
  await expect(companionsTab).toBeDisplayed();
  await press(await companionsTab);
  await expect(companionsTab).toHaveAttribute("aria-selected", "true");
  await press(await el("pbi-return"));
  await expect(title).toBeFocused();
  expect(await scroll()).toBe(offset);
  await expect(search).toHaveValue(id);
  await press(await title);
  await expect(el("pbi-tab-companions")).toHaveAttribute("aria-selected", "true");
  await press(await el("pbi-return"));
}

it("J03: adopts and plans the same mapped backlog in installed Obsidian through Board, Base, Liste and Detail", async () => {
  await seedBacklogVault();
  await browser.executeObsidian(
    async ({ app }, path, note) => {
      await app.vault.create(path, note);
    },
    work + "/Serviceanfragen kategorisieren.md",
    newNoteText(
      {
        type: "Feature",
        "pe-id": "FE-02",
        parent: "[[Kundenservice]]",
        order: 220,
        project_id: customerProject,
      },
      "",
    ),
  );
  await openView();
  await setTheme("light");
  await browser.$(ROOT).$("button=Kundenportal").click();
  await el("project-rail").$("button=Backlog").click();
  await expect(lane("Backlog")).toExist();
  expect(await readViewRoute()).toEqual({ name: "project-backlog", projectId: customerProject });
  const standard = ["Backlog", "Open", "In Progress", "Review", "In Development", "Done"];
  const stages = await browser.execute(
    (root: HTMLElement) =>
      [...root.querySelectorAll("[data-board-stage]")].map((column) =>
        column.getAttribute("data-board-stage"),
      ),
    await browser.$(ROOT),
  );
  expect(stages).toEqual(standard);

  await el("backlog-open-base").click();
  await expect(baseStatus(exportPath)).toHaveText("Active");
  await expect(baseStatus(reviewPath)).toHaveText("Open");
  await openView();
  await list().click();
  const originalPaths = await backlogFiles();
  const baseBefore = await readVaultText(existingBase);
  const id = await adopt();
  expect(await backlogFiles()).toEqual(originalPaths);
  await editDescription("EP-01", epicPath, "## Neues Epic\n\nServicequalität.");
  await editDescription("FE-01", featurePath, "## Neues Feature\n\nServicefälle nachvollziehen.");
  const rankBefore = await readVaultText(featurePath);
  await row("FE-01").$("[data-testid=backlog-row-open]").click();
  await press(await el("backlog-down"));
  await browser.keys("Escape");
  await expect(form()).not.toExist();
  expect(await readVaultText(featurePath)).toBe(rankBefore);

  await board().click();
  await quickAdd();
  await companions(id);
  await el("backlog-open-base").click();
  const native = baseStatus(exportPath);
  await native.setValue("Review");
  await browser.keys("Enter");
  await browser.waitUntil(async () =>
    /DeliveryState: Review/.test((await readVaultText(exportPath)) ?? ""),
  );
  const outside = await readVaultText(exportPath);
  if (outside === null) throw new Error("Missing the mapped Base baseline");
  await openView();
  const move = card(id, "Review").$("select");
  await expect(move).toHaveAttribute("aria-label", expect.stringContaining(id));
  await press(await move, "End");
  await browser.waitUntil(async () =>
    /DeliveryState: Done/.test((await readVaultText(exportPath)) ?? ""),
  );
  await expectMappedStage(outside, "Done");
  await expect(card(id, "Done")).toExist();
  await press(await fold("Backlog"));
  await expect(fold("Done")).toHaveAttribute("aria-expanded", "true");
  await dragIntoFoldedBacklog(id, outside);
  await expectMappedStage(outside, "Done");
  await press(await fold("Done"));
  await expect(lane("Done").$("[data-testid=board-lane-count]")).toHaveText("1");

  await switchProject("Admin Console");
  await expect(fold("Backlog")).toHaveAttribute("aria-expanded", "true");
  await expect(fold("Done")).toHaveAttribute("aria-expanded", "true");
  await expect(card(id)).not.toExist();
  await switchProject("Kundenportal");
  await expect(fold("Backlog")).toHaveAttribute("aria-expanded", "false");
  await expect(fold("Done")).toHaveAttribute("aria-expanded", "false");

  await reloadPlugin();
  await openView();
  await setViewRoute({ name: "project-backlog", projectId: customerProject, tab: "board" });
  await expect(fold("Backlog")).toHaveAttribute("aria-expanded", "false");
  await expect(fold("Done")).toHaveAttribute("aria-expanded", "false");
  await press(await fold("Done"));
  await expect(fold("Done")).toHaveAttribute("aria-expanded", "true");
  await expect(boardOpen(id, "Done")).toBeDisplayed();
  await checkScrolledReturn(id);
  await checkNarrow(id);
  await el("backlog-board").$("input[name=backlog-search]").setValue(id);
  const title = boardOpen(id, "Done");
  await press(await title);
  await expect(el("pbi-stage")).toHaveText(expect.stringContaining("Done"));
  await el("pbi-tab-companions").click();
  await expect(el("pbi-companion-count")).toHaveText("4 offen · 4 insgesamt");
  await press(await el("pbi-return"));
  await expect(title).toBeFocused();
  await expect(el("backlog-board").$("input[name=backlog-search]")).toHaveValue(id);
  await list().click();
  await expect(row(id).$("[data-testid=backlog-row-state]")).toHaveText(
    expect.stringContaining("Done"),
  );
  await el("backlog-open-base").click();
  await expect(baseStatus(exportPath)).toHaveText("Done");
  expect(await readVaultText(existingBase)).toBe(baseBefore);
  const matches = await browser.executeObsidian(
    ({ app }, key) =>
      app.vault
        .getMarkdownFiles()
        .filter((file) => app.metadataCache.getFileCache(file)?.frontmatter?.["pe-id"] === key)
        .map(({ path }) => path),
    id,
  );
  expect(matches).toEqual([exportPath]);
});
