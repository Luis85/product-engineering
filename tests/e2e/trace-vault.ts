import { browser } from "@wdio/globals";
import { newNoteText } from "../../src/domain/notes";
import { reviewPath, work } from "./backlog-vault";
import { customerFolder, customerProject, jobOne, vision } from "./knowledge-vault";
import { seedComparisonReviewDecision } from "./review-decision-vault";
import { customerMap, matchedPrdOutcome, matchedPrdTitle } from "./story-maps-vault";

export const traceResearch = "RES-14";
export const traceResearchTitle = "Interview · Servicefälle übergeben";

export async function addTraceSources(comparison = false) {
  await browser.executeObsidian(
    async ({ app, plugins }, input) => {
      const prd = app.vault.getFileByPath(input.prd);
      if (!prd) throw new Error("Missing trace PRD");
      await app.fileManager.processFrontMatter(prd, (fields: Record<string, unknown>) => {
        Object.assign(fields, input.prdFields);
      });
      for (const { path, text } of input.pbis) await app.vault.create(path, text);
      if (input.comparison) {
        const research = app.vault.getFileByPath(input.research);
        const job = app.vault.getFileByPath(input.job);
        const legacy = app.vault.getFileByPath(input.legacy);
        if (!research || !job || !legacy) throw new Error("Missing trace comparison source");
        await app.fileManager.processFrontMatter(research, (fields: Record<string, unknown>) => {
          Object.assign(fields, input.researchFields);
        });
        await app.fileManager.processFrontMatter(job, (fields: Record<string, unknown>) => {
          fields.title = "Offene Fälle verlässlich übergeben";
        });
        await app.vault.process(prd, (text) => text + input.requirement);
        await app.vault.delete(legacy);
      }
      const created = await plugins.noteStoreProbe.api.create({
        folder: input.folder,
        name: "SM-01",
        frontmatter: input.map,
      });
      if (!created.success) throw new Error("Could not write trace fixture Story Map");
    },
    {
      prd: customerFolder + "/PRD-03.md",
      prdFields: {
        title: matchedPrdTitle,
        requirement_id: "REQ-18",
        job_ids: [jobOne],
        vision_id: vision,
      },
      pbis: [
        { id: "UC-14", title: "Fallübersicht nach Status filtern", rank: 325, state: "Done" },
        { id: "UC-12", title: "Leere Trefferliste erklären", rank: 350, state: "Open" },
      ].map(({ id, title, rank, state }, index) => ({
        path: `${work}/${title}.md`,
        text: newNoteText({
          schema: "product-engineering.backlog/v1",
          id: `backlog-33333333-3333-4333-8333-00000000024${index}`,
          "pe-id": id,
          project_id: customerProject,
          type: "PBI",
          title,
          DeliveryState: state,
          order: rank,
          parent: "[[Servicefälle verwalten]]",
        }),
      })),
      comparison,
      research: customerFolder + "/RES-02.md",
      researchFields: { display_id: traceResearch, title: traceResearchTitle },
      job: customerFolder + "/JOB-12.md",
      requirement: `\n## REQ-18 · Ergebnis\n\n${matchedPrdOutcome}\n`,
      legacy: reviewPath,
      folder: customerFolder + "/Story Maps",
      map: customerMap(),
    },
  );
}

export async function seedComparisonTrace() {
  let sourceCommit = "";
  const revision = await seedComparisonReviewDecision({
    options: { requirement: "REQ-18" },
    async beforeRelease(git) {
      await addTraceSources(true);
      git("add", "--", "PRD-03.md", "JOB-12.md", "RES-02.md");
      git("commit", "--quiet", "-m", "Link the Trace requirement and its Vision");
      sourceCommit = git("rev-parse", "HEAD");
    },
  });
  return { revision, sourceCommit };
}
