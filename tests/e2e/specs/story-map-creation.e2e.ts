import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { catalogFor } from "../../../src/application/messages";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { isKnowledgeId } from "../../../src/domain/knowledge";
import { isProjectId } from "../../../src/domain/projects";
import { isStoryMapId } from "../../../src/domain/story-maps";
import {
  openView,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
} from "../support";

const text = catalogFor(TEST_LANGUAGE);
const projectName = "Schichtübergabe";
const folder = `Product Engineering/Projects/${projectName}`;
const jobTitle = "Schichtwechsel vorbereiten";
const visionTitle = "Ein gemeinsamer Überblick";
const prdTitle = "Offene Servicefälle an die nächste Schicht übergeben";
const outcome = "Die nächste Schicht kann die vollständige Liste gefilterter Fälle übernehmen.";
const persona = "Koordination im Service";
const goal = "Die Übergabeliste wird gemeinsam und ohne doppelte Arbeit weitergegeben.";
const title = "Verlässliche Übergabe bei Schichtwechsel";
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const modal = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const field = (name: string) => modal().$(`[name="${name}"]`);
const submit = () => modal().$('button[type="submit"]');
const editor = () => el("knowledge-note").$("textarea[name=markdown]");
const mapsNav = () => el("project-rail").$('button[aria-label="Story Maps"]');

async function stored(path: string) {
  const content = await readVaultText(path);
  if (content === null) throw new Error("No persisted fixture at " + path);
  return content;
}

function mapFiles() {
  return browser.executeObsidian(
    ({ app }, scope) =>
      app.vault
        .getMarkdownFiles()
        .filter(({ path }) => path.startsWith(scope + "/Story Maps/"))
        .map(({ path }) => path),
    folder,
  );
}

async function saveMarkdown(body: string) {
  await editor().setValue(body);
  await el("knowledge-save").click();
  await expect(el("knowledge-note")).toHaveText(expect.stringContaining(text.knowledge.note.saved));
}

async function createKnowledge(kind: "jtbd" | "vision", name: string, body: string) {
  await el("knowledge-library").$("select[name=knowledge-filter]").selectByAttribute("value", kind);
  await el("knowledge-create").click();
  await field("title").setValue(name);
  await submit().click();
  await expect(editor()).toBeFocused();
  await saveMarkdown(body);
  const raw = await stored(`${folder}/${name}.md`);
  const id = /^id: (knowledge-[\da-f-]+)$/m.exec(raw)?.[1];
  if (!isKnowledgeId(id)) throw new Error("Missing Knowledge identity");
  await el("project-record-return").click();
  return id;
}

async function fromPrd() {
  await el("knowledge-note-actions").click();
  const action = el("knowledge-create-story-map");
  await expect(action).toHaveText("Story Map anlegen");
  await expect(el("knowledge-export")).toBeFocused();
  await browser.keys("Tab");
  await expect(action).toBeFocused();
  await browser.keys("Enter");
  await expect(field("title")).toHaveValue(prdTitle);
  await expect(field("title")).toBeFocused();
  await expect(field("persona")).toHaveValue(persona);
  await expect(field("goal")).toHaveValue(outcome);
}

async function createEmptyProject() {
  await openView();
  await el("project-workspace").$(`button=${text.projects.create}`).click();
  await field("name").setValue(projectName);
  await field("description").setValue("Einen vollständigen Schichtwechsel ermöglichen");
  await field("repository").setValue("fixtures/story-map-handoff");
  await submit().click();
  await expect(el("project-workspace").$("h1")).toHaveText(projectName);
  const projectRoute = await readViewRoute();
  const projectId =
    projectRoute &&
    typeof projectRoute === "object" &&
    "projectId" in projectRoute &&
    projectRoute.projectId;
  if (!isProjectId(projectId)) throw new Error("No registered project identity");
  return projectId;
}

it("creates a real Job and PRD in an empty project, cancels and retries its linked Story Map, and follows both entries", async function () {
  this.timeout(120_000);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const projectId = await createEmptyProject();
  await mapsNav().click();
  await expect(el("story-maps-empty")).toHaveText("Hier sind noch keine Story Maps angelegt.");
  await expect(el("story-map-create")).toHaveText("Story Map erstellen");
  await el("project-rail")
    .$(`button[aria-label=${JSON.stringify(text.knowledge.title)}]`)
    .click();
  const job = await createKnowledge(
    "jtbd",
    jobTitle,
    "## Angestrebter Fortschritt\n\nDie Schicht kann ohne Nacharbeit übernehmen.",
  );
  const vision = await createKnowledge("vision", visionTitle, `## Zielgruppe\n\n${persona}`);
  await el("knowledge-library")
    .$("select[name=knowledge-filter]")
    .selectByAttribute("value", "jtbd");
  await browser.$(`${ROOT} [data-knowledge-record="${job}"]`).click();
  await expect(el("knowledge-note").$("h1")).toHaveText(jobTitle);
  await el("knowledge-create-prd").click();
  await expect(modal().$(`input[value="${job}"]`)).toBeSelected();
  await expect(field("vision_id")).toHaveValue(vision);
  await field("title").setValue(prdTitle);
  await submit().click();
  await expect(editor()).toBeFocused();
  await saveMarkdown(`## REQ-01 · Ergebnis\n\n${outcome}`);
  await el("knowledge-content-tab").click();
  const prdPath = `${folder}/${prdTitle}.md`;
  const prd = await stored(prdPath);
  const prdId = /^id: (knowledge-[\da-f-]+)$/m.exec(prd)?.[1];
  if (!isKnowledgeId(prdId)) throw new Error("Missing derived PRD identity");

  await fromPrd();
  await field("title").setValue("Verworfener Entwurf");
  await browser.keys("Escape");
  await expect(el("knowledge-note-actions")).toBeFocused();
  expect(await mapFiles()).toEqual([]);
  await fromPrd();
  await field("title").setValue(title);
  await field("persona").setValue("Serviceteam im Schichtdienst");
  await field("goal").setValue(goal);
  await browser.executeObsidian(({ app }, root) => {
    const create = app.vault.create.bind(app.vault);
    app.vault.create = async (path, ...args) => {
      if (path.startsWith(root + "/Story Maps/")) {
        app.vault.create = create;
        throw new Error("Controlled native Story Map write refusal");
      }
      return create(path, ...args);
    };
  }, folder);
  await submit().click();
  await expect(modal().$("[role=alert]")).toHaveText(
    expect.stringContaining("Die Notiz konnte nicht gespeichert werden"),
  );
  await expect(field("title")).toHaveValue(title);
  await expect(field("persona")).toHaveValue("Serviceteam im Schichtdienst");
  await expect(field("goal")).toHaveValue(goal);
  expect(await mapFiles()).toEqual([]);
  await browser.execute(
    (element: HTMLElement) => {
      const button = element as HTMLButtonElement;
      button.form?.requestSubmit(button);
      button.form?.requestSubmit(button);
    },
    await submit(),
  );
  await expect(el("story-map-detail").$("h1")).toHaveText(title);
  const paths = await mapFiles();
  expect(paths).toHaveLength(1);
  const storedMap = await stored(paths[0] ?? "");
  const id = /^id: (story-map-[\da-f-]+)$/m.exec(storedMap)?.[1];
  if (!isStoryMapId(id)) throw new Error("Missing Story Map identity");
  const mapRoute = storyMapsRoute(projectId, id);
  expect(await readViewRoute()).toEqual(mapRoute);
  expect(storedMap).toContain("display_id: SM-01");
  expect(storedMap).toContain("prd_id: " + prdId);
  expect(storedMap).toContain(job);
  for (const key of ["activities", "steps", "slices", "cards", "card_links"])
    expect(storedMap).toContain(`${key}: []`);
  expect(await stored(prdPath)).toBe(prd);
  const renamedPrd = `${folder}/Anforderung zur Schichtübergabe.md`;
  await browser.executeObsidian(
    async ({ app }, before, after) => {
      const file = app.vault.getFileByPath(before);
      if (!file) throw new Error("Missing authored PRD for external rename");
      await app.vault.rename(file, after);
    },
    prdPath,
    renamedPrd,
  );
  expect(await readVaultText(prdPath)).toBeNull();
  expect(await stored(renamedPrd)).toBe(prd);

  await mapsNav().click();
  await expect(el("story-map-row-counts")).toHaveText("SM-01 · 0 Storys · 0 mit Backlog-Link");
  await el("story-map-row").click();
  expect(await readViewRoute()).toEqual(mapRoute);
  await reloadPlugin();
  await openView();
  await setViewRoute(storyMapsRoute(projectId));
  await el("story-map-row").click();
  await expect(el("story-map-detail").$("h1")).toHaveText(title);
  expect(await readViewRoute()).toEqual(mapRoute);
  await el("story-map-context-foundations").click();
  await el("story-map-source-prd").click();
  await expect(el("knowledge-story-map-backlink")).toHaveText(`SM-01 · ${title}`);
  await el("knowledge-story-map-backlink").click();
  await expect(el("story-map-detail").$("h1")).toHaveText(title);
  expect(await readViewRoute()).toEqual(mapRoute);
  const pbiCount = await browser.executeObsidian(
    ({ app }, root) =>
      app.vault
        .getMarkdownFiles()
        .filter(
          (file) =>
            file.path.startsWith(root + "/") &&
            app.metadataCache.getFileCache(file)?.frontmatter?.type === "PBI",
        ).length,
    folder,
  );
  expect(pbiCount).toBe(0);

  await expect(el("story-map-detail")).toHaveText(
    expect.stringContaining("Lege die erste Aktivität an."),
  );
  const addTitle = async (nodeTitle: string) => {
    await field("title").setValue(nodeTitle);
    await el("story-map-journey-save").click();
  };
  await el("story-map-add-activity").click();
  await addTitle("Schicht vorbereiten");
  await el("story-map-add-step").click();
  await addTitle("Offene Fragen sichten");
  await el("story-map-add-slice").click();
  await addTitle("Erste Übergabe");
  const addStory = browser.$(
    `${ROOT} button[aria-label='Story für „Offene Fragen sichten“ in „Erste Übergabe“ hinzufügen']`,
  );
  await addStory.click();
  await addTitle("Nachfragen zur Übergabe erkennen");
  const card = browser.$(`${ROOT} article[aria-label="Nachfragen zur Übergabe erkennen"]`);
  await addStory.click();
  await addTitle("Antworten für die nächste Schicht sammeln");
  await expect(
    browser.$(`${ROOT} article[aria-label="Antworten für die nächste Schicht sammeln"]`),
  ).toExist();
  await card.$('[data-testid="story-map-work"]').click();
  await el("story-map-work-add").click();
  const workEditor = browser.$(`${ROOT} form:has([data-testid="story-map-work-save"])`);
  await expect(workEditor.$('[name="destination"]')).toHaveValue("story");
  await workEditor.$('[name="kind"]').selectByAttribute("value", "Q");
  await workEditor.$('[name="title"]').setValue("Wer beantwortet offene Rückfragen?");
  await el("story-map-work-save").click();
  await expect(el("story-map-owned-work")).toHaveText(
    expect.stringContaining("Wer beantwortet offene Rückfragen?"),
  );
  const authored = await stored(paths[0] ?? "");
  expect(authored).toContain(job);
  expect(authored).toContain("Nachfragen zur Übergabe erkennen");
  expect(authored).toContain("Antworten für die nächste Schicht sammeln");
  expect(authored).toContain("Wer beantwortet offene Rückfragen?");
  expect(authored).toContain("card_links: []");
});
