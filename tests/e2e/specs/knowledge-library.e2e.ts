import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { projectKnowledgeRoute } from "../../../src/application/knowledge";
import { catalogFor } from "../../../src/application/messages";
import {
  projectAdministrationRoute,
  projectOverviewRoute,
} from "../../../src/application/projects";
import type { ProjectId } from "../../../src/application/projects";
import { newNoteText, splitNoteText } from "../../../src/domain/notes";
import {
  adminProject,
  adminRequirement,
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
  jobTwo,
  mara,
  projectFile,
  seedKnowledgeVault,
  vision,
  wideTitle,
} from "../knowledge-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
  VIEW_TYPE,
} from "../support";

const messages = catalogFor(TEST_LANGUAGE);
const text = messages.knowledge;
const activeDialog = "[role=dialog][data-state=open]";
const library = () => browser.$(`${ROOT} [data-testid=knowledge-library]`);
const row = (id: string) => library().$(`[data-knowledge-record=${JSON.stringify(id)}]`);
const modal = () => browser.$(`${ROOT} ${activeDialog}`);

async function openKnowledge(projectId: ProjectId = customerProject) {
  await openView();
  await setViewRoute(projectOverviewRoute(projectId));
  await browser.$(`${ROOT} [data-testid=project-knowledge-entry]`).click();
  await expect(library().$("h1")).toHaveText(text.title);
  expect(await readViewRoute()).toEqual(projectKnowledgeRoute(projectId));
}

async function activeFile() {
  return browser.executeObsidian(({ app }) => app.workspace.getActiveFile()?.path);
}

async function makeActor(title: string, kind: "human" | "system", owner = "") {
  await openKnowledge();
  await library().$("select[name=knowledge-filter]").selectByAttribute("value", "actor");
  await library().$("[data-testid=knowledge-create]").click();
  const dialog = modal();
  await expect(dialog.$("select[name=kind]")).toHaveValue("actor");
  await dialog.$("input[name=title]").setValue(title);
  await dialog.$("select[name=actor_type]").selectByAttribute("value", kind);
  if (owner) await dialog.$("select[name=owner_id]").selectByAttribute("value", owner);
  await dialog.$("button[type=submit]").click();
  const path = `${customerFolder}/${title}.md`;
  await expect(browser.$(`${ROOT} textarea[name=markdown]`)).toBeFocused();
  const raw = await readVaultText(path);
  if (!raw) throw new Error(`Missing created actor ${path}`);
  return splitNoteText(raw);
}

before(seedKnowledgeVault);

it("opens the project library, keeps scopes isolated and preserves an externally renamed record", async () => {
  await openKnowledge();
  const query = library().$("input[name=knowledge-query]");
  await expect(row(customerRequirement)).toHaveText(expect.stringContaining(wideTitle));
  await expect(row(customerRequirement)).toHaveText(
    expect.stringContaining("Freigaben mit Partnern prüfen."),
  );
  await expect(row(customerRequirement).$("img")).not.toExist();
  await expect(library()).toHaveText(expect.stringContaining("Weitere Notizen"));
  await query.setValue("REQ-03");
  await expect(library().$$("[data-knowledge-record]")).toBeElementsArrayOfSize(1);
  await row(customerRequirement).click();
  await expect(browser.$(`${ROOT} [data-testid=project-workspace] h1`)).toHaveText(wideTitle);
  expect(await readViewRoute()).toMatchObject({
    name: "project-record",
    projectId: customerProject,
    reference: { kind: "knowledge", recordId: customerRequirement },
  });
  const renamed = `${customerFolder}/Extern umbenannt.md`;
  await browser.executeObsidian(
    async ({ app }, target, folder) => {
      const file = app.vault.getFileByPath(`${folder}/PRD-03.md`);
      if (!file) throw new Error("Missing fixture PRD");
      await app.fileManager.renameFile(file, target);
    },
    renamed,
    customerFolder,
  );
  const openFile = browser.$(`${ROOT} [data-testid=knowledge-file]`);
  await expect(openFile).toHaveAttribute("data-note-path", renamed);
  await openFile.click();
  await browser.waitUntil(async () => (await activeFile()) === renamed);
  await openView();
  await browser.$(`${ROOT} [data-testid=project-record-return]`).click();
  await expect(row(customerRequirement)).toBeFocused();
  await expect(query).toHaveValue("REQ-03");
  await query.setValue("Unauffindbare ID");
  await expect(library().$("[data-testid=knowledge-state]")).toHaveText(text.noMatches);
  await library().$(`button=${text.reset}`).click();
  await expect(query).toBeFocused();
  await expect(library().$$("[data-knowledge-record]")).toBeElementsArrayOfSize(8);

  await openKnowledge(adminProject);
  await expect(row(customerRequirement)).not.toExist();
  await expect(row(adminRequirement)).toHaveText(
    expect.stringContaining("Vertrauliche Admin-Daten."),
  );
  await browser
    .$(`${ROOT} button[aria-label=${JSON.stringify(messages.projects.search.open)}]`)
    .click();
  const palette = modal();
  await palette.$("input[type=search]").setValue("PRD-03");
  await expect(palette.$$("ol button")).toBeElementsArrayOfSize(1);
  await browser.keys("Enter");
  await expect(browser.$(`${ROOT} [data-testid=project-workspace] h1`)).toHaveText(wideTitle);
  expect(await readViewRoute()).toMatchObject({
    projectId: adminProject,
    reference: { kind: "knowledge", recordId: adminRequirement },
  });
});

it("writes human and system actor notes, reloads them, and leaves the project team intact", async () => {
  const registration = await readVaultText(projectFile);
  const human = await makeActor("Kundenservice Stellvertretung", "human");
  const system = await makeActor("Portal Berechtigungsdienst", "system", mara);
  for (const [note, subtype, id] of [
    [human, "human", "AKT-03"],
    [system, "system", "AKT-04"],
  ] as const) {
    expect(note.frontmatter?.yaml).toContain("schema: product-engineering.knowledge/v1");
    expect(note.frontmatter?.yaml).toContain(`project_id: ${customerProject}`);
    expect(note.frontmatter?.yaml).toContain(`actor_type: ${subtype}`);
    expect(note.frontmatter?.yaml).toContain(`display_id: ${id}`);
    expect(note.frontmatter?.yaml).toContain("approval: draft");
    expect(note.body).toBe("\n## Rolle und Ziel\n\n## Beitrag zum Ablauf\n\n## Schnittstellen\n");
  }
  expect(human.frontmatter?.yaml).not.toContain("owner_id:");
  expect(system.frontmatter?.yaml).toContain(`owner_id: ${mara}`);
  expect(await readVaultText(projectFile)).toBe(registration);
  await reloadPlugin();
  await openKnowledge();
  await library().$("select[name=knowledge-filter]").selectByAttribute("value", "actor");
  const subtype = library().$("select[name=knowledge-actor]");
  const query = library().$("input[name=knowledge-query]");
  await subtype.selectByAttribute("value", "human");
  await query.setValue("AKT-03");
  await expect(library().$$("[data-knowledge-record]")).toBeElementsArrayOfSize(1);
  await expect(library().$("[data-knowledge-record]")).toHaveText(
    expect.stringContaining("Kundenservice Stellvertretung"),
  );
  await subtype.selectByAttribute("value", "system");
  await query.setValue("Portal Berechtigungsdienst");
  await expect(library().$$("[data-knowledge-record]")).toBeElementsArrayOfSize(1);
  await expect(library().$("[data-knowledge-record]")).toHaveText(
    expect.stringContaining("Mara König"),
  );
});

async function libraryGeometry(scope: string) {
  return browser.execute(
    (selector, id) => {
      const root = document.querySelector(selector);
      const leaf = root?.closest(".workspace-leaf");
      const pane = root?.querySelector<HTMLElement>("[data-testid=project-content]");
      const record = pane?.querySelector(`[data-knowledge-record="${id}"]`);
      const title = record?.querySelector("strong");
      const excerpt = record?.querySelector(":scope > span:not(:last-child)");
      if (!leaf || !pane || !record || !title || !excerpt) {
        throw new Error("Expected a real project leaf, content pane and record text");
      }
      const frame = leaf.getBoundingClientRect();
      const bounds = pane.getBoundingClientRect();
      const outside = (element: Element, container: DOMRect) => {
        const box = element.getBoundingClientRect();
        return Math.max(0, container.left - box.left, box.right - container.right);
      };
      return {
        width: frame.width,
        paneOutside: outside(pane, frame),
        paneScroll: pane.scrollWidth - pane.clientWidth,
        rowOutside: outside(record, bounds),
        titleOutside: outside(title, bounds),
        excerptOutside: outside(excerpt, bounds),
        titleWraps:
          title.getBoundingClientRect().height >
          Number.parseFloat(getComputedStyle(title).lineHeight),
      };
    },
    scope,
    customerRequirement,
  );
}

async function settledScroll(scope: string) {
  return browser.execute(async (selector) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    let scroller = document
      .querySelector(selector)
      ?.querySelector<HTMLElement>("[data-testid=app-frame]");
    while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (!scroller) throw new Error("Expected the scroll owner of the narrow leaf");
    return {
      top: scroller.scrollTop,
      height: scroller.scrollHeight,
      viewport: scroller.clientHeight,
    };
  }, scope);
}

async function checkKeyboardLibraryReturn(scope: string) {
  const id = "knowledge-33333333-3333-4333-8333-000000000020";
  const excerpt = "Der aktuelle Leitfaden gilt für die Weitergabe von Servicefällen.";
  const body = newNoteText(
    {
      schema: "product-engineering.knowledge/v1",
      id,
      project_id: customerProject,
      kind: "field-guide",
      display_id: "GUIDE-02",
      title: wideTitle,
      approval: "draft",
    },
    `\n## Leitfaden\n\n${excerpt}\n`,
  );
  await browser.executeObsidian(
    async ({ app }, path, content) => {
      await app.vault.create(path, content);
    },
    `${customerFolder}/GUIDE-02.md`,
    body,
  );
  const filter = browser.$(`${scope} [name=knowledge-filter]`);
  const query = browser.$(`${scope} [name=knowledge-query]`);
  await filter.selectByAttribute("value", "");
  await query.setValue("knowledge");
  const selector = `${scope} [data-knowledge-record="${id}"]`;
  const target = browser.$(selector);
  await expect(target).toHaveText(expect.stringContaining(excerpt));
  await target.scrollIntoView({ block: "center" });
  await browser.execute((rowSelector) => {
    document.querySelector<HTMLElement>(rowSelector)?.focus({ preventScroll: true });
  }, selector);
  await expect(target).toBeFocused();
  const initialScroll = await settledScroll(scope);
  expect(initialScroll.top).toBeGreaterThan(100);
  await browser.keys("Enter");
  await expect(browser.$(`${scope} [data-testid=project-workspace] h1`)).toHaveText(wideTitle);
  expect(await readViewRoute()).toMatchObject({
    projectId: customerProject,
    reference: { kind: "knowledge", recordId: id },
  });
  await browser.$(`${scope} [data-testid=project-record-return]`).click();
  await expect(target).toBeFocused();
  await expect(target).toHaveText(expect.stringContaining(excerpt));
  await expect(query).toHaveValue("knowledge");
  const returnedScroll = await settledScroll(scope);
  await expect(target).toBeFocused();
  expect([returnedScroll.height, returnedScroll.viewport]).toEqual([
    initialScroll.height,
    initialScroll.viewport,
  ]);
  expect(returnedScroll.top).toBeGreaterThanOrEqual(initialScroll.top - 1);
  expect(returnedScroll.top).toBeLessThanOrEqual(initialScroll.top + 1);
}

it("keeps the library and PRD form inside a 390px leaf and saves or cancels drafts", async () => {
  await openKnowledge();
  const reset = library().$(`button=${text.reset}`);
  if (await reset.isExisting()) await reset.click();
  const initial = `${customerFolder}/Nachvollziehbare Freigabe.md`;
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    const owner = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
    if (!leaf || !owner) throw new Error("Missing product leaf");
    app.workspace.getLeaf("split", "vertical");
    await app.workspace.revealLeaf(leaf);
    owner.style.flex = "0 0 390px";
    owner.style.width = "390px";
    leaf.view.containerEl.dataset.e2e = "knowledge-narrow";
  }, VIEW_TYPE);
  const scope = `[data-e2e=knowledge-narrow] ${ROOT}`;
  const results = browser.$(scope).$$("[data-knowledge-record]");
  const visiblePRD = row(customerRequirement);
  await expect(visiblePRD).toHaveText(expect.stringContaining("Freigaben mit Partnern prüfen."));
  expect(await results.length).toBeGreaterThan(1);
  const fullLibrary = await libraryGeometry(scope);
  await library().$("select[name=knowledge-filter]").selectByAttribute("value", "prd");
  await expect(results).toBeElementsArrayOfSize(1);
  await expect(visiblePRD).toHaveText(expect.stringContaining("Freigaben mit Partnern prüfen."));
  const onePRD = await libraryGeometry(scope);
  const outsidePane = Object.entries({ fullLibrary, onePRD }).filter(
    ([, size]) =>
      size.width !== 390 ||
      size.paneOutside > 1 ||
      size.paneScroll > 1 ||
      size.rowOutside > 1 ||
      size.titleOutside > 1 ||
      size.excerptOutside > 1 ||
      !size.titleWraps,
  );
  expect(outsidePane).toEqual([]);
  await checkKeyboardLibraryReturn(scope);
  await library().$("select[name=knowledge-filter]").selectByAttribute("value", "prd");
  await expect(library().$("select[name=knowledge-filter]")).toHaveValue("prd");

  await browser.$(`${scope} [data-testid=knowledge-create]`).click();
  const panel = browser.$(`${scope} ${activeDialog}`);
  await expect(panel).toBeDisplayed();
  const geometry = await browser.execute(
    (selector, dialog) => {
      const root = document.querySelector(selector);
      const owner = root?.closest(".workspace-leaf");
      const overlay = root?.querySelector(dialog);
      const title = root?.querySelector<HTMLElement>("[data-knowledge-record] strong");
      if (!owner || !overlay || !title) throw new Error("Expected leaf, dialog and note title");
      const a = owner.getBoundingClientRect();
      const b = overlay.getBoundingClientRect();
      return {
        width: a.width,
        inside:
          b.left >= a.left - 1 &&
          b.right <= a.right + 1 &&
          b.top >= a.top - 1 &&
          b.bottom <= a.bottom + 1,
        wraps: title.scrollWidth <= title.clientWidth,
      };
    },
    scope,
    activeDialog,
  );
  expect(geometry).toEqual({ width: 390, inside: true, wraps: true });
  await expect(panel.$("select[name=kind]")).toHaveValue("prd");
  await panel.$("input[name=title]").setValue("Nachvollziehbare Freigabe");
  await panel.$("select[name=vision_id]").selectByAttribute("value", vision);
  await panel.$(`input[value=${JSON.stringify(jobOne)}]`).click();
  await panel.$(`input[value=${JSON.stringify(jobTwo)}]`).click();
  await panel.$("button[type=submit]").click();
  await expect(browser.$(`${scope} textarea[name=markdown]`)).toBeFocused();
  const raw = await readVaultText(initial);
  expect(raw).toContain("display_id: PRD-01");
  expect(raw).toContain("requirement_id: REQ-01");
  expect(raw).toContain(`vision_id: ${vision}`);
  expect(raw).toContain(jobOne);
  expect(raw).toContain(jobTwo);
  expect(raw).toContain("\n## Problem\n\n## REQ-01\n\n## Ziele, Umfang und Erfolgskriterien\n");
  await reloadPlugin();
  await openKnowledge();
  await library().$("input[name=knowledge-query]").setValue("REQ-01");
  await expect(library().$("[data-knowledge-record]")).toHaveText(
    expect.stringContaining("Nachvollziehbare Freigabe"),
  );
  expect(await readVaultText(initial)).toBe(raw);

  await setViewRoute(projectAdministrationRoute(customerProject, "templates"));
  const factory = browser.$(`${ROOT} [data-template=prd]`);
  await factory.click();
  await expect(modal().$("select[name=kind]")).toHaveValue("prd");
  await modal().$("input[name=title]").setValue("Abgebrochener Entwurf");
  await browser.keys("Escape");
  await expect(modal()).not.toBeDisplayed();
  await expect(factory).toBeFocused();
  expect(await readVaultText(`${customerFolder}/Abgebrochener Entwurf.md`)).toBeNull();
  expect(await readViewRoute()).toEqual(projectAdministrationRoute(customerProject, "templates"));
});
