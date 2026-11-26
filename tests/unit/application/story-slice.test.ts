import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { backlogSnapshot, newBacklogCreation } from "../../../src/application/backlog";
import { NoteStore, NoteWriteError, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import {
  createStorySlicePbi,
  readStoryMapForEdit,
  setStoryMapItemLink,
  setStorySliceDeferral,
  storySliceStories,
} from "../../../src/application/story-maps";
import { decodeStoryMap } from "../../../src/application/story-maps/records";
import type { StorySliceSources } from "../../../src/application/story-maps";
import { testRuntime } from "../../support/runtime";

const project = "project-33333333-3333-4333-8333-000000000961";
const other = "project-33333333-3333-4333-8333-000000000962";
const mapId = "story-map-33333333-3333-4333-8333-000000000961";
const prd = "knowledge-33333333-3333-4333-8333-000000000961";
const job = "knowledge-33333333-3333-4333-8333-000000000962";
const target = { sliceId: "slice-1", cardId: "card-1" };
const second = { ...target, cardId: "card-2" };
const sources: StorySliceSources = { prd, requirement: "REQ-01", job };
const draft = {
  kind: "UC" as const,
  title: "Publish handover",
  body: "See open requests.",
  parent: "FE-01",
  state: "Done",
  priority: "P1",
  owner: "",
};
const link = (
  cardId: string,
  recordId: string,
  projectId: typeof project | typeof other = project,
) => ({
  cardId,
  kind: "item" as const,
  projectId,
  recordId,
});
const unknownRow = { external: "Preserve this row" };
const denied = (effect: Promise<unknown>, reason: string) =>
  expect(effect).rejects.toMatchObject({ reason });
const storyWork = {
  cardId: target.cardId,
  id: "Q-01",
  recordId: "backlog-33333333-3333-4333-8333-000000000963",
  kind: "Q",
  title: "What is expected?",
  body: "",
  state: "",
  priority: "",
  owner: "",
};

async function setup() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const own = await run(
    createProject(project, {
      name: "Customer",
      description: "Current product",
      repository: "team/customer",
    }),
  );
  const foreign = await run(
    createProject(other, {
      name: "Admin",
      description: "Another product",
      repository: "team/admin",
    }),
  );
  await host.vaultReady();
  const mapPath = own.folder + "/SM-01.md";
  const seedItem = (
    directory: string,
    peId: string,
    kind: string,
    projectId: string,
    key: string,
  ) =>
    run(
      host.notes.seed(
        directory + "/" + peId + ".md",
        {
          schema: "product-engineering.backlog/v1",
          id: "backlog-33333333-3333-4333-8333-000000000" + key,
          "pe-id": peId,
          type: kind,
          project_id: projectId,
          order: 300,
          external: "Same bytes",
        },
        "Outside body",
      ),
    );
  await seedItem(own.folder, "FE-01", "Feature", project, "971");
  await seedItem(own.folder, "UC-01", "PBI", project, "972");
  await seedItem(foreign.folder, "UC-01", "PBI", other, "973");
  await seedItem(foreign.folder, "UC-99", "PBI", other, "974");
  await seedItem(foreign.folder, "FE-99", "Feature", other, "975");
  await run(
    host.notes.seed(own.folder + "/PRD-01.md", {
      schema: "product-engineering.knowledge/v1",
      id: prd,
      project_id: project,
      title: "Continuity",
      kind: "prd",
      display_id: "PRD-01",
      approval: "draft",
      requirement_id: "REQ-01",
    }),
  );
  await run(
    host.notes.seed(own.folder + "/JOB-01.md", {
      schema: "product-engineering.knowledge/v1",
      id: job,
      project_id: project,
      title: "Handover",
      kind: "jtbd",
      display_id: "JOB-01",
      approval: "draft",
    }),
  );
  await run(
    host.notes.seed(
      mapPath,
      {
        schema: "product-engineering.story-map/v1",
        id: mapId,
        project_id: project,
        display_id: "SM-01",
        title: "Prepare handover",
        goal: "Finish a review",
        persona: "Service team",
        prd_id: prd,
        job_ids: [job],
        activities: [{ id: "activity-1", title: "Understand the list" }],
        steps: [{ id: "step-1", activityId: "activity-1", title: "Review open cases" }],
        slices: [
          { id: "slice-1", title: "First" },
          { id: "slice-2", title: "Second" },
        ],
        cards: [
          { id: target.cardId, title: "Publish handover", stepId: "step-1", sliceId: "slice-1" },
          { id: second.cardId, title: "Read handover", stepId: "step-1", sliceId: "slice-1" },
        ],
        card_links: [link(target.cardId, "FE-01"), link(target.cardId, "UC-01", other), unknownRow],
        story_work: [storyWork],
        slice_handoffs: [unknownRow],
        slice_deferrals: [unknownRow],
        external: "Keep my note metadata",
      },
      "Workshop context",
    ),
  );
  await run(rebuildNoteIndex);
  const store = await run(NoteStore);
  const initial = decodeStoryMap(await run(store.readFresh(mapPath)));
  if (!initial) throw new Error("Missing fixture map");
  return {
    host,
    run,
    store,
    initial,
    folder: own.folder,
    fresh: () => run(readStoryMapForEdit(initial)),
    change: (set: Record<string, unknown>) =>
      run(store.update(mapPath, () => Result.succeed({ set }))),
  };
}

it("revalidates project-scoped targets, placement and current coverage before any handoff write", async () => {
  const { host, run, initial, fresh, change } = await setup();
  try {
    const operation = await run(newBacklogCreation("UC"));
    const create = (input = draft, source = sources) =>
      run(createStorySlicePbi(initial, target, operation, input, source));
    await denied(create({ ...draft, parent: "FE-99" }), "target");
    await denied(
      create(draft, { ...sources, job: "knowledge-33333333-3333-4333-8333-000000000966" }),
      "handoff",
    );
    await denied(create(draft, { ...sources, requirement: "REQ-02" }), "sources");
    await denied(create({ ...draft, priority: "P99" }), "priority");
    await denied(
      create({ ...draft, parent: "", epicTitle: "", featureTitle: "" } as typeof draft),
      "parent",
    );
    expect((await fresh()).frontmatter).toEqual(initial.frontmatter);
    await run(setStorySliceDeferral(initial, target, true));
    await denied(create(), "handoff");
    await denied(
      run(setStoryMapItemLink(initial, link(target.cardId, "UC-01"), true, target.sliceId)),
      "handoff",
    );
    await run(setStorySliceDeferral(initial, target, true));
    await run(setStorySliceDeferral(initial, target, false));
    expect((await fresh()).frontmatter.slice_deferrals).toEqual([unknownRow]);
    await denied(
      run(setStoryMapItemLink(initial, link(target.cardId, "UC-99"), true, target.sliceId)),
      "target",
    );
    await denied(
      run(setStoryMapItemLink(initial, link(target.cardId, "UC-01", other), true, target.sliceId)),
      "target",
    );
    await run(setStoryMapItemLink(initial, link(target.cardId, "UC-01"), true, target.sliceId));
    await denied(create(), "handoff");
    await denied(run(setStorySliceDeferral(initial, target, true)), "handoff");
    await change({ cards: initial.cards.map((card) => ({ ...card, sliceId: "slice-2" })) });
    await denied(
      run(setStoryMapItemLink(initial, link(second.cardId, "UC-01"), true, second.sliceId)),
      "handoff",
    );
    await denied(create(), "handoff");
  } finally {
    await host.runtime.dispose();
  }
});

it("recovers the durable operation after an interrupted attachment and returns the same PBI on duplicate submission", async () => {
  const { host, run, store, initial, fresh, folder, change } = await setup();
  try {
    const operation = await run(newBacklogCreation("UC"));
    const create = createStorySlicePbi(initial, target, operation, draft, sources);
    const featureBefore = await run(store.readContent(folder + "/FE-01.md"));
    const pbiBefore = await run(store.readContent(folder + "/UC-01.md"));
    let writes = 0;
    const refused = Effect.provideService(create, NoteStore, {
      ...store,
      update: (path, alter) =>
        path === initial.path && ++writes === 2
          ? Effect.fail(new NoteWriteError())
          : store.update(path, alter),
    });
    await expect(run(refused)).rejects.toMatchObject({ _tag: "NoteWriteError" });
    const partial = await fresh();
    expect(partial.frontmatter.slice_handoffs).toMatchObject([
      unknownRow,
      { state: "pending", itemId: operation.item.id },
    ]);
    expect(partial.frontmatter.card_links).toEqual(initial.frontmatter.card_links);
    await expect(run(setStorySliceDeferral(partial, target, true))).rejects.toMatchObject({
      reason: "handoff",
    });
    await expect(
      run(setStoryMapItemLink(partial, link(target.cardId, "UC-01"), true)),
    ).rejects.toMatchObject({ reason: "target" });
    const newOperation = await run(newBacklogCreation("UC"));
    const destination = { ...target, sliceId: "slice-2" };
    await change({
      cards: initial.cards.map((card) =>
        card.id === target.cardId ? { ...card, sliceId: destination.sliceId } : card,
      ),
    });
    const relocated = await fresh();
    await denied(
      run(createStorySlicePbi(relocated, destination, newOperation, draft, sources)),
      "handoff",
    );
    await denied(run(create), "handoff");
    await denied(run(setStorySliceDeferral(relocated, destination, true)), "handoff");
    expect(storySliceStories(relocated, destination.sliceId, [])).toMatchObject([
      { covered: false, recoverySlice: "First" },
    ]);
    expect(relocated.frontmatter.slice_handoffs).toEqual(partial.frontmatter.slice_handoffs);
    await change({ cards: initial.cards });
    const item = await run(
      createStorySlicePbi(
        partial,
        target,
        newOperation,
        { ...draft, title: "Ignored after refusal" },
        sources,
      ),
    );
    expect(item.id).toBe(operation.item.id);
    expect(item.fields).toMatchObject({
      id: operation.item.record,
      title: draft.title,
      status: "Backlog",
      priority: "P1",
      pbi_prd_id: prd,
      pbi_requirement_id: "REQ-01",
      pbi_job_id: job,
    });
    expect((await run(create)).path).toBe(item.path);
    await run(
      setStoryMapItemLink(initial, link(second.cardId, operation.item.id), true, second.sliceId),
    );
    await run(
      setStoryMapItemLink(initial, link(second.cardId, operation.item.id), true, second.sliceId),
    );
    await run(rebuildNoteIndex);
    const saved = await fresh();
    const backlog = await run(backlogSnapshot(project));
    expect(
      backlog.items
        .filter((candidate) => candidate.kind === "UC")
        .map(({ id }) => id)
        .toSorted(),
    ).toEqual(["UC-01", operation.item.id].toSorted());
    expect(storySliceStories(saved, target.sliceId, backlog.items)).toMatchObject([
      { covered: true, links: [{ created: false }, { item: undefined }, { created: true }] },
      { covered: true, links: [{ created: false }] },
    ]);
    expect(saved.frontmatter).toMatchObject({
      external: initial.frontmatter.external,
      story_work: [storyWork],
      slice_handoffs: [unknownRow, { itemId: operation.item.id, state: "created" }],
      card_links: [
        ...(initial.frontmatter.card_links as readonly unknown[]),
        link(target.cardId, operation.item.id),
        link(second.cardId, operation.item.id),
      ],
    });
    expect(await run(store.readContent(folder + "/FE-01.md"))).toEqual(featureBefore);
    expect(await run(store.readContent(folder + "/UC-01.md"))).toEqual(pbiBefore);
  } finally {
    await host.runtime.dispose();
  }
});
