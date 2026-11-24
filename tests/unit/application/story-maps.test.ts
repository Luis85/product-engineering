import { expect, it } from "vitest";
import { backlogSnapshot } from "../../../src/application/backlog";
import { createKnowledge } from "../../../src/application/knowledge";
import type { KnowledgeDraft } from "../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import type { ProjectId } from "../../../src/application/projects";
import { createStoryMap } from "../../../src/application/story-maps/create";
import { storyMapPrefill } from "../../../src/application/story-maps/foundations";
import { storyMapsSnapshot } from "../../../src/application/story-maps/records";
import { storyMapRows } from "../../../src/application/story-maps/register";
import type { StoryMapId } from "../../../src/domain/story-maps";
import { testRuntime } from "../../support/runtime";

const projectId = "project-33333333-3333-4333-8333-000000000111";
const otherProject = "project-33333333-3333-4333-8333-000000000112";
const id = "story-map-33333333-3333-4333-8333-000000000113";
const secondId = "story-map-33333333-3333-4333-8333-000000000114";
const thirdId = "story-map-33333333-3333-4333-8333-000000000115";
const draft = {
  title: " Service handover ",
  persona: " Coordinators ",
  goal: " Pass a verified list ",
};
const itemRef = (recordId: string, scope: ProjectId = projectId, kind = "item") => ({
  kind,
  projectId: scope,
  recordId,
});

async function projectFixtures(host: ReturnType<typeof testRuntime>) {
  const run = host.runtime.runPromise.bind(host.runtime);
  await run(
    createProject(projectId, {
      name: "Service",
      description: "Service cases",
      repository: "team/service",
    }),
  );
  await run(
    createProject(otherProject, {
      name: "Operations",
      description: "On-call shifts",
      repository: "team/operations",
    }),
  );
  await host.vaultReady();
}

it("persists independent maps once and retries refusal with project-local display sequences", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const create = (scope: ProjectId = projectId, mapId: StoryMapId = id) =>
    run(createStoryMap({ projectId: scope, id: mapId }, draft));
  try {
    await projectFixtures(host);
    const store = await run(NoteStore);
    await expect(create(projectId, "story-map-malformed")).rejects.toMatchObject({
      _tag: "StoryMapError",
      reason: "identity",
    });
    await expect(create("project-33333333-3333-4333-8333-000000000999")).rejects.toMatchObject({
      _tag: "StoryMapError",
      reason: "scope",
    });
    await expect(
      run(createStoryMap({ projectId, id }, { ...draft, persona: "  " })),
    ).rejects.toMatchObject({
      _tag: "StoryMapError",
      reason: "fields",
    });
    host.notes.setFailWrites(true);
    await expect(create()).rejects.toMatchObject({ _tag: "NoteWriteError" });
    host.notes.setFailWrites(false);
    const [map, duplicate, next, other] = await Promise.all([
      create(),
      create(),
      create(projectId, secondId),
      create(otherProject, thirdId),
    ]);
    expect(map.frontmatter).toEqual({
      schema: "product-engineering.story-map/v1",
      id,
      project_id: projectId,
      display_id: "SM-01",
      title: "Service handover",
      persona: "Coordinators",
      goal: "Pass a verified list",
      activities: [],
      steps: [],
      slices: [],
      cards: [],
      card_links: [],
    });
    expect(map.path).toMatch(/^Product Engineering\/Projects\/Service\/Story Maps\//);
    expect(duplicate).toEqual(map);
    expect(next.frontmatter.display_id).toBe("SM-02");
    expect(other.frontmatter.display_id).toBe("SM-01");
    await expect(create(otherProject)).rejects.toMatchObject({
      _tag: "StoryMapError",
      reason: "identity",
    });
    const maps = (await run(store.list)).filter(
      ({ frontmatter }) => frontmatter.schema === "product-engineering.story-map/v1",
    );
    expect(maps).toHaveLength(3);
  } finally {
    await host.runtime.dispose();
  }
});

it("counts canonical Feature and PBI links once per story and excludes invalid, outside and duplicate items", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const seedItem = (
    itemId: string,
    type: string,
    serial: number,
    scope: ProjectId = projectId,
    canonical = true,
  ) =>
    run(
      host.notes.seed(
        `Product Engineering/Projects/${scope === projectId ? "Service" : "Operations"}/item-${serial}.md`,
        {
          ...(canonical && {
            schema: "product-engineering.backlog/v1",
            id: `backlog-33333333-3333-4333-8333-${String(serial).padStart(12, "0")}`,
          }),
          type,
          "pe-id": itemId,
          project_id: scope,
        },
      ),
    );
  try {
    await projectFixtures(host);
    await seedItem("FE-01", "Feature", 201);
    await seedItem("UC-09", "PBI", 202);
    await seedItem("UC-14", "PBI", 203, otherProject);
    await seedItem("UC-19", "PBI", 204, projectId, false);
    await seedItem("UC-50", "PBI", 205);
    await seedItem("UC-50", "PBI", 206);
    const saved = await run(createStoryMap({ projectId, id }, draft));
    const links = [
      [itemRef("FE-01"), itemRef("FE-01"), itemRef("UC-09")],
      [itemRef("UC-09")],
      [itemRef("UC-14", otherProject), itemRef("UC-14")],
      [itemRef("UC-09", otherProject), itemRef("UC-09", projectId, "knowledge")],
      [itemRef("UC-19"), itemRef("UC-50"), itemRef("UC-404"), null],
    ];
    await run(
      host.notes.seed(saved.path, {
        ...saved.frontmatter,
        cards: links.map((_, index) => ({
          id: `CARD-0${index + 1}`,
          stepId: "STEP-01",
          title: `Story ${index + 1}`,
        })),
        card_links: links
          .flatMap((references, index) =>
            references.map(
              (reference) => reference && { cardId: `CARD-0${index + 1}`, ...reference },
            ),
          )
          .concat([{ cardId: "CARD-404", ...itemRef("FE-01") }]),
      }),
    );
    await run(rebuildNoteIndex);
    const { maps } = await run(storyMapsSnapshot(projectId));
    const { items } = await run(backlogSnapshot(projectId));
    const rows = storyMapRows(maps, items);
    expect(rows).toMatchObject([{ id, displayId: "SM-01", storyCount: 5, linkedStoryCount: 2 }]);
  } finally {
    await host.runtime.dispose();
  }
});

it("prefills from the scoped PRD, Vision and sole valid job, and saves stable IDs after an outside rename", async () => {
  const host = testRuntime({ language: "en" });
  const run = host.runtime.runPromise.bind(host.runtime);
  const job = "knowledge-33333333-3333-4333-8333-000000000121";
  const vision = "knowledge-33333333-3333-4333-8333-000000000122";
  const prd = "knowledge-33333333-3333-4333-8333-000000000123";
  const foreign = "knowledge-33333333-3333-4333-8333-000000000124";
  const missing = "knowledge-33333333-3333-4333-8333-000000000125";
  const secondJob = "knowledge-33333333-3333-4333-8333-000000000126";
  const fields = { actor_type: "", owner_id: "", vision_id: "", job_ids: [] };
  const create = (
    recordId: typeof job | typeof vision | typeof prd | typeof foreign | typeof secondJob,
    kind: KnowledgeDraft["kind"],
    title: string,
    scope: ProjectId = projectId,
  ) => run(createKnowledge({ projectId: scope, id: recordId }, { ...fields, kind, title }));
  const prefill = () => run(storyMapPrefill(projectId, prd));
  try {
    await projectFixtures(host);
    const jobNote = await create(job, "jtbd", "Verified handover");
    const visionNote = await create(vision, "vision", "Vision for service");
    await create(foreign, "jtbd", "Another project's job", otherProject);
    await run(rebuildNoteIndex);
    const prdNote = await run(
      createKnowledge(
        { projectId, id: prd, origin: { kind: "job", projectId, recordId: job } },
        { ...fields, kind: "prd", title: "Hand over service cases", vision_id: vision },
      ),
    );
    await run(
      host.notes.seed(
        jobNote.path,
        jobNote.frontmatter,
        "## Desired progress\n\nShare a verified list in a single handover.",
      ),
    );
    await run(
      host.notes.seed(
        visionNote.path,
        visionNote.frontmatter,
        "## Target audience\n\nService coordinators",
      ),
    );
    const injected = { ...prdNote.frontmatter, job_ids: [job, foreign, missing, vision, job] };
    await run(
      host.notes.seed(
        prdNote.path,
        injected,
        "```markdown\n## Fake Outcome\nWrong.\n```\n\n## REQ-01 · Ergebnis\n\nPass only cases scoped to the current organization.",
      ),
    );
    await run(rebuildNoteIndex);
    expect((await prefill()).draft).toEqual({
      title: "Hand over service cases",
      persona: "Service coordinators",
      goal: "Pass only cases scoped to the current organization.",
    });
    const store = await run(NoteStore);
    const renamed = await run(store.rename(prdNote.path, "Handover renamed outside"));
    await run(
      host.notes.seed(
        renamed.path,
        { ...injected, vision_id: foreign },
        "## Problem\n\nHandover is manual.",
      ),
    );
    await run(rebuildNoteIndex);
    expect((await prefill()).draft).toEqual({
      title: "Hand over service cases",
      persona: "",
      goal: "Share a verified list in a single handover.",
    });
    const map = await run(createStoryMap({ projectId, id, prdId: prd }, draft));
    expect(map.frontmatter).toMatchObject({ prd_id: prd, job_ids: [job] });
    await expect(
      run(createStoryMap({ projectId: otherProject, id: secondId, prdId: prd }, draft)),
    ).rejects.toMatchObject({ _tag: "StoryMapError", reason: "source" });
    await expect(
      run(createStoryMap({ projectId, id: secondId, prdId: missing }, draft)),
    ).rejects.toMatchObject({ _tag: "StoryMapError", reason: "source" });
    await expect(
      run(createStoryMap({ projectId, id: secondId, prdId: job }, draft)),
    ).rejects.toMatchObject({ _tag: "StoryMapError", reason: "source" });
    expect((await run(store.readContent(renamed.path))).frontmatter).toEqual({
      ...injected,
      vision_id: foreign,
    });
    await create(secondJob, "jtbd", "Check responsibilities");
    const twoJobs = { ...injected, vision_id: vision, job_ids: [job, secondJob] };
    await run(host.notes.seed(renamed.path, twoJobs, "## Problem\n\nHandover is manual."));
    await run(rebuildNoteIndex);
    expect((await prefill()).draft.goal).toBe("");
    await run(
      host.notes.seed(
        renamed.path,
        twoJobs,
        "## User Outcome\n\nBoth coordinators have the same queue.",
      ),
    );
    expect((await prefill()).draft.goal).toBe("Both coordinators have the same queue.");
    const alternative = await run(createStoryMap({ projectId, id: secondId, prdId: prd }, draft));
    expect(alternative.frontmatter.job_ids).toEqual([job, secondJob]);
  } finally {
    await host.runtime.dispose();
  }
});

it("ignores a Job in the PRD Vision field and preserves only valid explicitly linked jobs", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const job = "knowledge-33333333-3333-4333-8333-000000000151";
  const vision = "knowledge-33333333-3333-4333-8333-000000000152";
  const prd = "knowledge-33333333-3333-4333-8333-000000000153";
  const missing = "knowledge-33333333-3333-4333-8333-000000000154";
  const folder = "Product Engineering/Projects/Service";
  const fields = { schema: "product-engineering.knowledge/v1", project_id: projectId };
  const externalPrd = {
    ...fields,
    id: prd,
    display_id: "PRD-01",
    kind: "prd",
    title: "Shared shift",
    vision_id: job,
    job_ids: [missing, vision],
  };
  try {
    await projectFixtures(host);
    await run(
      host.notes.seed(
        `${folder}/JOB-01.md`,
        {
          ...fields,
          id: job,
          display_id: "JOB-01",
          kind: "jtbd",
          title: "Verify the queue",
        },
        "## Desired progress\n\nHand over the verified queue.",
      ),
    );
    await run(
      host.notes.seed(
        `${folder}/VIS-01.md`,
        {
          ...fields,
          id: vision,
          display_id: "VIS-01",
          kind: "vision",
          title: "Shared picture",
        },
        "## Target audience\n\nShift coordinators",
      ),
    );
    const prdPath = `${folder}/PRD-01.md`;
    const body = "## Problem\n\nHandover is manual.";
    await run(host.notes.seed(prdPath, externalPrd, body));
    await run(rebuildNoteIndex);
    const prepared = await run(storyMapPrefill(projectId, prd));
    const saved = await run(createStoryMap({ projectId, id, prdId: prd }, draft));
    expect.soft(prepared.draft).toEqual({ title: "Shared shift", persona: "", goal: "" });
    expect.soft(saved.frontmatter).toMatchObject({
      prd_id: prd,
      job_ids: [],
      persona: "Coordinators",
      goal: "Pass a verified list",
    });

    await run(
      host.notes.seed(prdPath, { ...externalPrd, job_ids: [missing, job, vision, job] }, body),
    );
    const corrected = await run(storyMapPrefill(projectId, prd));
    const linked = await run(createStoryMap({ projectId, id: secondId, prdId: prd }, draft));
    expect(corrected.draft.goal).toBe("Hand over the verified queue.");
    expect(linked.frontmatter).toMatchObject({ prd_id: prd, job_ids: [job] });
  } finally {
    await host.runtime.dispose();
  }
});
