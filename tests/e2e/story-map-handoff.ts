import { browser, expect } from "@wdio/globals";
import { parse } from "yaml";
import { pbiDetailRoute } from "../../src/application/backlog";
import type { ProjectId } from "../../src/application/projects";
import { storyMapSliceRoute, storyMapsRoute } from "../../src/application/story-maps";
import { isBacklogId } from "../../src/domain/backlog";
import { splitNoteText } from "../../src/domain/notes";
import type { StoryMapId } from "../../src/domain/story-maps";
import { readVaultText, readViewRoute, ROOT } from "./support";

export const firstTitle = "Nachfragen zur Übergabe erkennen";
export const secondTitle = "Antworten für die nächste Schicht sammeln";
export const thirdTitle = "Offene Rückfragen an die nächste Schicht melden";
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const modal = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const field = (name: string) => modal().$(`[name="${name}"]`);

async function stored(path: string) {
  const content = await readVaultText(path);
  if (content === null) throw new Error("No persisted fixture at " + path);
  return content;
}

export function fields(raw: string): Record<string, unknown> {
  const value: unknown = parse(splitNoteText(raw).frontmatter?.yaml ?? "");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Missing fixture frontmatter object");
  return value as Record<string, unknown>;
}

function openReviewFromMap() {
  return browser.$(ROOT).$("button=Fürs Backlog prüfen").click();
}

function openReview(open?: () => Promise<void>) {
  return open ? open() : openReviewFromMap();
}

export async function handoffBlankProject(input: {
  readonly projectId: ProjectId;
  readonly id: StoryMapId;
  readonly folder: string;
  readonly mapFile: string;
  readonly authored: string;
  readonly job: string;
  readonly prdId: string;
  readonly requirementId: unknown;
  readonly openReview?: () => Promise<void>;
  readonly checkDeferred?: () => Promise<void>;
}) {
  const { projectId, id, folder, mapFile, authored, job, prdId, requirementId } = input;
  await openReview(input.openReview);
  const active = await readViewRoute();
  const sliceId = active && typeof active === "object" && "sliceId" in active && active.sliceId;
  if (typeof sliceId !== "string") throw new Error("No typed native slice route");
  const reviewRoute = storyMapSliceRoute(projectId, id, sliceId);
  expect(active).toEqual(reviewRoute);
  await expect(el("slice-review-count")).toHaveText("0 von 3 Storys mit PBI");
  const first = () =>
    el("slice-review")
      .$("h2=" + firstTitle)
      .parentElement()
      .parentElement();
  const second = () =>
    el("slice-review")
      .$("h2=" + secondTitle)
      .parentElement()
      .parentElement();
  const third = () =>
    el("slice-review")
      .$("h2=" + thirdTitle)
      .parentElement()
      .parentElement();
  const create = () => first().$("button=PBI aus Story anlegen");
  await create().click();
  await expect(field("title")).toHaveValue(firstTitle);
  await expect(field("markdown")).toHaveValue(
    "Die offene Frage ist für die nächste Schicht sichtbar.",
  );
  await expect(field("owner")).toHaveValue("");
  await expect(field("job")).toHaveValue(job);
  await expect(field("epicTitle")).toBeDisplayed();
  await expect(field("featureTitle")).toBeDisplayed();
  await field("title").setValue("Verworfener PBI-Entwurf");
  await el("backlog-cancel").click();
  await expect(first()).toBeFocused();
  expect(await stored(mapFile)).toBe(authored);
  expect(await backlogFiles(folder)).toEqual([]);

  await create().click();
  await field("epicTitle").setValue("Schichtübergabe absichern");
  await field("featureTitle").setValue("Offene Rückfragen weitergeben");
  await browser.executeObsidian(({ app }, path) => {
    const original = app.vault.process.bind(app.vault);
    app.vault.process = (file, change, options) =>
      original(
        file,
        (before) => {
          const next = change(before);
          if (file.path === path && next.includes("state: created")) {
            app.vault.process = original;
            throw new Error("Controlled native handoff attachment refusal");
          }
          return next;
        },
        options,
      );
  }, mapFile);
  await el("backlog-save").click();
  await expect(modal().$("[role=alert]")).toHaveText(
    expect.stringContaining("Die Notiz konnte nicht gespeichert werden"),
  );
  await expect(field("title")).toHaveValue(firstTitle);
  expect(await backlogFiles(folder)).toHaveLength(3);
  const interrupted = fields(await stored(mapFile));
  expect(interrupted.card_links).toEqual([]);
  expect(interrupted.story_work).toEqual(fields(authored).story_work);
  expect(interrupted.slice_handoffs).toMatchObject([{ state: "pending", job, prd: prdId }]);
  await el("backlog-cancel").click();
  await waitForReviewRoute(sliceId);
  await browser.reloadObsidian();
  await expect(el("slice-review").$("h1")).toHaveText("Erste Übergabe");
  expect(await readViewRoute()).toEqual(reviewRoute);
  await first().$("button=PBI-Erstellung abschließen").click();
  await expect(field("title")).toHaveValue(firstTitle);
  await expect(field("title")).toBeDisabled();
  await browser.execute(
    (control: HTMLElement) => {
      const button = control as HTMLButtonElement;
      button.form?.requestSubmit(button);
      button.form?.requestSubmit(button);
    },
    await el("backlog-save"),
  );
  await expect(first()).toHaveText(expect.stringContaining("Neu angelegt"));
  await expect(first()).toBeFocused();
  const link = () => first().$('[data-story-item^="UC-"]');
  const pbiId = await link().getAttribute("data-story-item");
  if (!isBacklogId(pbiId)) throw new Error("No canonical PBI");
  await second().$("button=Vorhandenes Item verknüpfen").click();
  await field("story-backlog-item").selectByAttribute("value", pbiId);
  await el("story-map-link-save").click();
  await expect(second()).toHaveText(expect.stringContaining("Bestehendes PBI"));
  await expect(second()).toBeFocused();
  await expect(el("slice-review-count")).toHaveText("2 von 3 Storys mit PBI");
  await third().$("button=Zurückstellen").click();
  await expect(third()).toHaveText(expect.stringContaining("Zurückgestellt"));
  await expect(third()).toBeFocused();
  const deferred = await stored(mapFile);
  expect(fields(deferred)).toMatchObject({
    slice_handoffs: [{ state: "created", itemId: pbiId }],
    slice_deferrals: [{ sliceId, decision: "deferred" }],
    card_links: [{ recordId: pbiId }, { recordId: pbiId }],
    story_work: fields(authored).story_work,
  });
  await waitForReviewRoute(sliceId);
  await browser.reloadObsidian();
  await expect(first()).toHaveText(expect.stringContaining("Neu angelegt"));
  await expect(second()).toHaveText(expect.stringContaining("Bestehendes PBI"));
  await expect(third()).toHaveText(expect.stringContaining("Zurückgestellt"));
  expect(await stored(mapFile)).toBe(deferred);
  await input.checkDeferred?.();
  await third().$("button=Wieder aufnehmen").click();
  await expect(third()).toHaveText(expect.stringContaining("PBI offen"));
  await expect(third()).toBeFocused();
  expect(await backlogFiles(folder)).toHaveLength(3);
  const pbiFile = (await backlogFiles(folder)).find((path) =>
    path.endsWith("/" + firstTitle + ".md"),
  );
  const pbi = await stored(pbiFile ?? "");
  expect(fields(pbi)).toMatchObject({
    type: "PBI",
    "pe-id": pbiId,
    pbi_prd_id: prdId,
    pbi_job_id: job,
    pbi_requirement_id: requirementId,
  });
  expect(pbi).toContain("Die offene Frage ist für die nächste Schicht sichtbar.");
  expect(pbi).not.toContain("Wer beantwortet offene Rückfragen?");

  const finalMap = fields(await stored(mapFile));
  expect(finalMap.story_work).toEqual(fields(authored).story_work);
  expect(finalMap.cards).toEqual(fields(authored).cards);
  expect(finalMap.slice_deferrals).toEqual([]);

  await link().click();
  expect(await readViewRoute()).toEqual(pbiDetailRoute(projectId, pbiId));
  await expect(el("pbi-stage")).toHaveText(expect.stringContaining("Backlog"));
  await el("pbi-tab-links").click();
  const links = el("backlog-story-map-links");
  await expect(links).toBeDisplayed();
  await expect(links.$$("button")).toBeElementsArrayOfSize(2);
  for (const name of [firstTitle, secondTitle]) {
    const backlink = links.$(`button*=${name}`);
    const cardId = await backlink.getAttribute("data-map-card-link");
    if (!cardId) throw new Error("Missing story backlink");
    await backlink.click();
    await expect(browser.$(`${ROOT} [data-story-node="${cardId}"]`)).toBeFocused();
    expect(await readViewRoute()).toEqual(storyMapsRoute(projectId, id, cardId));
    await browser.$(`${ROOT} [data-testid="frame-history"] button[aria-label="Zurück"]`).click();
    await expect(links).toBeDisplayed();
  }
}

function backlogFiles(folder: string) {
  return browser.executeObsidian(async ({ app }, root) => {
    const scoped = app.vault.getMarkdownFiles().filter(({ path }) => path.startsWith(root + "/"));
    const notes = await Promise.all(
      scoped.map(async (note) => ({
        path: note.path,
        raw: await app.vault.cachedRead(note),
      })),
    );
    return notes
      .filter(({ raw }) => /^type: (Epic|Feature|PBI)$/m.test(raw))
      .map(({ path }) => path);
  }, folder);
}

async function waitForReviewRoute(sliceId: string) {
  await browser.waitUntil(
    async () => (await readVaultText(".obsidian/workspace.json"))?.includes(sliceId) ?? false,
  );
}
