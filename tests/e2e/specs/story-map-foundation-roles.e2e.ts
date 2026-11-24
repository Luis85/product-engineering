import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { catalogFor } from "../../../src/application/messages";
import { newNoteText } from "../../../src/domain/notes";
import {
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
  vision,
} from "../knowledge-vault";
import { matchedPrdPath, matchedPrdTitle, seedStoryMapsVault } from "../story-maps-vault";
import { openView, readVaultText, ROOT, TEST_LANGUAGE, writeVaultText } from "../support";

const text = catalogFor(TEST_LANGUAGE);
const missingJob = "knowledge-33333333-3333-4333-8333-000000000251";
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const field = (name: string) => browser.$(`${ROOT} [role=dialog] [name="${name}"]`);

before(seedStoryMapsVault);

it("keeps a Job in the PRD Vision field out of both the Story Map draft and saved foundations", async () => {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await browser.$(ROOT).$("button=Kundenportal").click();
  await el("project-rail")
    .$(`button[aria-label=${JSON.stringify(text.knowledge.title)}]`)
    .click();
  await browser.$(`${ROOT} [data-knowledge-record="${customerRequirement}"]`).click();
  await expect(el("knowledge-note").$("h1")).toHaveText(matchedPrdTitle);
  const externalProblem = "Die gefilterte Fallliste kann noch nicht übergeben werden.";
  const edited = newNoteText(
    {
      schema: "product-engineering.knowledge/v1",
      id: customerRequirement,
      project_id: customerProject,
      display_id: "PRD-03",
      kind: "prd",
      title: matchedPrdTitle,
      approval: "approved",
      requirement_id: "REQ-18",
      vision_id: jobOne,
      job_ids: [missingJob, vision],
    },
    `## Problem\n\n${externalProblem}`,
  );
  await writeVaultText(matchedPrdPath, edited);
  await expect(el("knowledge-body")).toHaveText(expect.stringContaining(externalProblem));
  await browser.waitUntil(() =>
    browser.executeObsidian(
      ({ app }, path, target) => {
        const note = app.vault.getFileByPath(path);
        return Boolean(
          note && app.metadataCache.getFileCache(note)?.frontmatter?.vision_id === target,
        );
      },
      matchedPrdPath,
      jobOne,
    ),
  );

  await el("knowledge-note-actions").click();
  await el("knowledge-create-story-map").click();
  await expect(field("title")).toHaveValue(matchedPrdTitle);
  const initial = {
    persona: await field("persona").getValue(),
    goal: await field("goal").getValue(),
  };
  const manual = {
    persona: "Koordination im Bereitschaftsdienst",
    goal: "Eine aktuelle Fallliste vollständig weitergeben.",
  };
  await field("persona").setValue(manual.persona);
  await field("goal").setValue(manual.goal);
  await el("story-map-submit").click();
  const detail = el("story-map-detail");
  await expect(detail.$("h1")).toHaveText(matchedPrdTitle);
  const mapId = await detail.getAttribute("data-story-map-id");
  const saved = await browser.executeObsidian(
    ({ app, plugins }, folder, id) => {
      const note = app.vault
        .getMarkdownFiles()
        .find(({ path }) => path.startsWith(folder + "/Story Maps/") && path.endsWith(` ${id}.md`));
      return note ? plugins.noteStoreProbe.api.read(note.path) : null;
    },
    customerFolder,
    mapId,
  );
  expect({ initial, saved }).toMatchObject({
    initial: { persona: "", goal: "" },
    saved: {
      success: true,
      value: { frontmatter: { ...manual, prd_id: customerRequirement, job_ids: [] } },
    },
  });
  expect(await readVaultText(matchedPrdPath)).toBe(edited);
});
