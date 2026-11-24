import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { projectOverviewRoute } from "../../../src/application/projects";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { isKnowledgeId } from "../../../src/domain/knowledge";
import { isStoryMapId } from "../../../src/domain/story-maps";
import { adminFolder, adminProject } from "../knowledge-vault";
import { seedBlankOverviewVault } from "../overview-vault";
import {
  fields,
  firstTitle,
  handoffBlankProject,
  secondTitle,
  thirdTitle,
} from "../story-map-handoff";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const planning = () => el("project-overview-planning");
const action = (label: string) => planning().$(`button=${label}`);
const field = (name: string) =>
  browser.$(`${ROOT} [role=dialog][data-state=open] [name="${name}"]`);
const back = () => el("frame-history").$('button[aria-label="Zurück"]');
const navbar = () => el("project-rail").$('button[aria-label="Überblick"]');
const overview = projectOverviewRoute(adminProject);

async function read(path: string) {
  const markdown = await readVaultText(path);
  if (markdown === null) throw new Error("Missing persisted file " + path);
  return markdown;
}

async function author(title: string, markdown: string) {
  await field("title").setValue(title);
  await browser.$(`${ROOT} [role=dialog][data-state=open] button[type=submit]`).click();
  const editor = el("knowledge-note").$("textarea[name=markdown]");
  await expect(editor).toBeFocused();
  await editor.setValue(markdown);
  await el("knowledge-save").click();
  await expect(el("knowledge-note")).toHaveText(expect.stringContaining("Im Vault gespeichert"));
  const raw = await read(`${adminFolder}/${title}.md`);
  await el("project-record-return").click();
  await expect(planning()).toBeDisplayed();
  expect(await readViewRoute()).toEqual(overview);
  return fields(raw);
}

async function addMapNode(control: ReturnType<typeof el>, title: string, detail?: string) {
  await control.click();
  await field("title").setValue(title);
  if (detail) await field("detail").setValue(detail);
  await el("story-map-journey-save").click();
}

it("J05: authors the six overview steps and reopens the exact two-story PBI and deferral", async function () {
  this.timeout(160_000);
  await seedBlankOverviewVault();
  await openView();
  await setViewRoute(overview);
  const first = action("Ersten Job beschreiben");
  await expect(first).toBeDisplayed();
  await first.click();
  const job = await author(
    "Schichtwechsel vorbereiten",
    "## Angestrebter Fortschritt\n\nKeine Rückfragen bleiben offen.",
  );
  const createVision = action("Produktvision formulieren");
  await expect(createVision).toBeDisplayed();
  const headings = planning().$$("ol h3");
  await expect(headings).toBeElementsArrayOfSize(6);
  await createVision.click();
  const vision = await author("Gemeinsamer Überblick", "## Zielgruppe\n\nKoordination im Service");
  expect(vision).toMatchObject({ job_ids: [job.id] });
  const createPrd = action("PRD ausarbeiten");
  await expect(createPrd).toBeDisplayed();
  await createPrd.click();
  await expect(field("vision_id")).toHaveValue(String(vision.id));
  await expect(browser.$(`${ROOT} [role=dialog] input[value="${String(job.id)}"]`)).toBeSelected();
  const prd = await author(
    "Offene Fragen weitergeben",
    "## REQ-01 · Ergebnis\n\nAlle Rückfragen bleiben sichtbar.",
  );
  expect(prd).toMatchObject({ job_ids: [job.id], vision_id: vision.id, requirement_id: "REQ-01" });
  if (!isKnowledgeId(job.id) || !isKnowledgeId(prd.id))
    throw new Error("Missing authored knowledge IDs");
  const createMap = action("Story Map erstellen");
  await createMap.click();
  await expect(field("title")).toHaveValue("Offene Fragen weitergeben");
  await expect(field("persona")).toHaveValue("Koordination im Service");
  await expect(field("goal")).toHaveValue("Alle Rückfragen bleiben sichtbar.");
  await field("title").setValue("Verlässliche Übergabe bei Schichtwechsel");
  await el("story-map-submit").click();
  await expect(el("story-map-detail").$("h1")).toHaveText(
    "Verlässliche Übergabe bei Schichtwechsel",
  );
  const route = await readViewRoute();
  const id = route && typeof route === "object" && "mapId" in route && route.mapId;
  if (!isStoryMapId(id)) throw new Error("Missing saved map identity");
  const mapFile = await browser.executeObsidian(
    ({ app }, folder) =>
      app.vault.getMarkdownFiles().find(({ path }) => path.startsWith(folder + "/Story Maps/"))
        ?.path,
    adminFolder,
  );
  if (!mapFile) throw new Error("Missing map file");
  await back().click();
  const planSlice = action("Lieferabschnitt planen");
  await planSlice.click();
  expect(await readViewRoute()).toEqual(storyMapsRoute(adminProject, id));
  await addMapNode(el("story-map-add-activity"), "Schicht vorbereiten");
  await addMapNode(el("story-map-add-step"), "Offene Fragen sichten");
  await addMapNode(el("story-map-add-slice"), "Erste Übergabe");
  await back().click();
  await action("Stories einplanen").click();
  const addStory = () =>
    browser.$(
      `${ROOT} button[aria-label='Story für „Offene Fragen sichten“ in „Erste Übergabe“ hinzufügen']`,
    );
  await addMapNode(
    addStory(),
    firstTitle,
    "Die offene Frage ist für die nächste Schicht sichtbar.",
  );
  await addMapNode(addStory(), secondTitle);
  await addMapNode(addStory(), thirdTitle);
  await browser
    .$(`${ROOT} article[aria-label="${firstTitle}"] [data-testid="story-map-work"]`)
    .click();
  await el("story-map-work-add").click();
  const work = browser.$(`${ROOT} form:has([data-testid="story-map-work-save"])`);
  await work.$('[name="kind"]').selectByAttribute("value", "Q");
  await work.$('[name="title"]').setValue("Wer beantwortet offene Rückfragen?");
  await el("story-map-work-save").click();
  await expect(el("story-map-owned-work")).toHaveText(
    expect.stringContaining("Wer beantwortet offene Rückfragen?"),
  );
  await browser.keys("Escape");
  await back().click();

  await handoffBlankProject({
    projectId: adminProject,
    id,
    folder: adminFolder,
    mapFile,
    authored: await read(mapFile),
    job: job.id,
    prdId: prd.id,
    requirementId: prd.requirement_id,
    openReview: async () => {
      await action("Stories fürs Backlog prüfen").click();
    },
    checkDeferred: async () => {
      await navbar().click();
      await expect(planning()).toHaveText(
        expect.stringContaining("3 von 3 Stories zugeordnet oder zurückgestellt"),
      );
      await expect(planning().$$('[data-testid="overview-slice-pbi"]')).toBeElementsArrayOfSize(1);
      await expect(action("Stories fürs Backlog prüfen")).not.toExist();
      await back().click();
      await expect(el("slice-review").$("h1")).toHaveText("Erste Übergabe");
    },
  });
  await navbar().click();
  await expect(planning()).toHaveText(
    expect.stringContaining("2 von 3 Stories zugeordnet oder zurückgestellt"),
  );
  await expect(planning().$$('[data-testid="overview-slice-pbi"]')).toBeElementsArrayOfSize(1);
  await expect(action("Stories fürs Backlog prüfen")).toBeDisplayed();
});
