import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  backlogSnapshot,
  newBacklogCreation,
  nfrTargets,
  readBacklogItem,
  resolveNfrScope,
  setTargetNfrs,
} from "../../../src/application/backlog";
import { resolveDomainScope, setEntityScope } from "../../../src/application/domain-model";
import { NoteStore, NoteWriteError, rebuildNoteIndex } from "../../../src/application/notes";
import { addProjectMember, createProject } from "../../../src/application/projects";
import {
  createStoryMap,
  moveStoryMapNode,
  saveStoryMapFoundations,
  saveStoryMapHeader,
  saveStoryMapNode,
  saveStoryMapWork,
  setStoryMapItemLink,
  storyMapCardsForCell,
  storyMapDomainContribution,
  storyMapItemBacklinks,
  storyMapNfrContribution,
  storyMapWorkScope,
} from "../../../src/application/story-maps";
import { decodeStoryMap } from "../../../src/application/story-maps/records";
import type { StoryMapWork } from "../../../src/domain/story-maps";
import { testRuntime } from "../../support/runtime";

const project = "project-33333333-3333-4333-8333-000000000601";
const other = "project-33333333-3333-4333-8333-000000000602";
const mapId = "story-map-33333333-3333-4333-8333-000000000603";
const owner = "project-member-33333333-3333-4333-8333-000000000604";
const prd = "knowledge-33333333-3333-4333-8333-000000000605";
const job = "knowledge-33333333-3333-4333-8333-000000000606";
const foreignJob = "knowledge-33333333-3333-4333-8333-000000000607";
const draft = { title: "Handover", goal: "Complete handover", persona: "Coordinator" };
const body = "\n# Workshop notes\n\n[[Discussion|Carry forward]].\n";
const extras = { outside: "Preserve outside changes" };
const link = (recordId: string, projectId = project as typeof project | typeof other) => ({
  kind: "item" as const,
  projectId,
  recordId,
  cardId: "card-1",
});
const first = {
  id: "card-1",
  title: "Prepare briefing",
  stepId: "step-1",
  sliceId: "slice-1",
  external: "person A",
};
const second = { id: "card-2", title: "Check attachments", stepId: "step-1", sliceId: "slice-1" };
const edge = (id: string, destination: string) => ({
  id,
  target: destination,
  verb: "relates to",
  sourceCardinality: "1",
  targetCardinality: "0..*",
  rule: "Named connection.",
});

async function setup() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const own = await run(
    createProject(project, {
      name: "Service",
      description: "Existing service",
      repository: "team/service",
    }),
  );
  const foreign = await run(
    createProject(other, {
      name: "Other",
      description: "Separate service",
      repository: "team/other",
    }),
  );
  await host.vaultReady();
  await run(addProjectMember(project, owner, { name: "Team Lead", role: "requirements" }));
  const map = await run(createStoryMap({ id: mapId, projectId: project }, draft));
  const seed = host.notes.seed;
  await run(
    seed(
      map.path,
      {
        ...map.frontmatter,
        ...extras,
        activities: [
          { id: "activity-1", title: "Prepare" },
          { id: "activity-2", title: "Review" },
        ],
        steps: [
          { id: "step-1", activityId: "activity-1", title: "Review entries" },
          { id: "step-2", activityId: "activity-1", title: "Check results" },
          { id: "step-3", activityId: "activity-2", title: "Confirm" },
        ],
        slices: [
          { id: "slice-1", title: "First" },
          { id: "slice-2", title: "Next" },
        ],
        cards: [first, second, { id: "other", stepId: "step-3", title: "Unscheduled" }],
        card_links: [link("UC-01"), link("UC-02", other), { malformed: "preserve" }],
      },
      body,
    ),
  );
  const seedBacklog = (
    folder: string,
    projectId: typeof project | typeof other,
    peId: string,
    kind: string,
    n: number,
  ) =>
    run(
      seed(
        folder + "/" + peId + ".md",
        {
          schema: "product-engineering.backlog/v1",
          id: `backlog-33333333-3333-4333-8333-0000000006${n}`,
          project_id: projectId,
          "pe-id": peId,
          type: kind,
          ...extras,
        },
        body,
      ),
    );
  await seedBacklog(own.folder, project, "UC-01", "PBI", 11);
  await seedBacklog(foreign.folder, other, "UC-01", "PBI", 12);
  await seedBacklog(foreign.folder, other, "UC-02", "PBI", 13);
  const seedKnowledge = (
    folder: string,
    projectId: typeof project | typeof other,
    id: string,
    kind: string,
    display: string,
  ) =>
    run(
      seed(folder + "/" + display + ".md", {
        schema: "product-engineering.knowledge/v1",
        project_id: projectId,
        id,
        kind,
        title: display,
        display_id: display,
        approval: "draft",
      }),
    );
  await seedKnowledge(own.folder, project, prd, "prd", "PRD-01");
  await seedKnowledge(own.folder, project, job, "jtbd", "JOB-01");
  await seedKnowledge(foreign.folder, other, foreignJob, "jtbd", "JOB-01");
  await run(rebuildNoteIndex);
  const store = await run(NoteStore);
  const fresh = async () => {
    const current = decodeStoryMap(await run(store.readFresh(map.path)));
    if (!current) throw new Error("Fixture map missing");
    return current;
  };
  return { host, run, store, fresh, folder: own.folder, path: map.path };
}

it("guards typed journey edits, preserves raw rows and merges unrelated outside edits", async () => {
  const { host, run, store, fresh, path } = await setup();
  try {
    const base = await fresh();
    await run(store.update(path, () => Result.succeed({ set: { partner: "Outside" } })));
    const edit = {
      kind: "card" as const,
      node: { id: first.id, title: " Moved ", stepId: "step-3" },
    };
    await expect(
      run(saveStoryMapNode(base, { ...edit, node: { ...edit.node, stepId: "missing" } })),
    ).rejects.toMatchObject({ reason: "journey" });
    await run(saveStoryMapNode(base, edit));
    const changed = await fresh();
    expect(storyMapCardsForCell(changed, "step-3")).toMatchObject([
      { id: first.id, title: "Moved", external: "person A" },
      { id: "other" },
    ]);
    expect(changed.cards[0]).not.toHaveProperty("sliceId");
    await expect(
      run(saveStoryMapNode(base, { kind: "card", node: { ...second, title: "Stale" } })),
    ).rejects.toMatchObject({ _tag: "NoteEditConflictError" });
    await run(moveStoryMapNode(changed, "card", first.id, 1));
    await run(moveStoryMapNode(await fresh(), "activity", "activity-1", 1));
    await run(moveStoryMapNode(await fresh(), "step", "step-2", -1));
    await run(moveStoryMapNode(await fresh(), "slice", "slice-2", -1));
    await expect(
      run(moveStoryMapNode(await fresh(), "slice", "slice-2", -1)),
    ).rejects.toMatchObject({ reason: "journey" });
    await expect(run(saveStoryMapHeader(base, { ...draft, title: " " }))).rejects.toMatchObject({
      reason: "fields",
    });
    await run(saveStoryMapHeader(base, { ...draft, goal: "Edited goal" }));
    const saved = await fresh();
    expect(storyMapCardsForCell(saved, "step-3").map(({ id }) => id)).toEqual(["other", first.id]);
    expect(saved.steps.map(({ id }) => id)).toEqual(["step-2", "step-1", "step-3"]);
    expect(saved.activities[0]?.id).toBe("activity-2");
    expect(saved.slices[0]?.id).toBe("slice-2");
    expect(saved.frontmatter).toMatchObject({ ...extras, partner: "Outside", goal: "Edited goal" });
    expect((await run(store.readContent(path))).body).toBe(body);
  } finally {
    await host.runtime.dispose();
  }
});

it("resolves map and item origins without unrelated siblings or second-hop entities", async () => {
  const { host, run, store, fresh, folder, path } = await setup();
  const noted = "knowledge-33333333-3333-4333-8333-000000000681";
  const direct = "knowledge-33333333-3333-4333-8333-000000000682";
  const viaPrd = "knowledge-33333333-3333-4333-8333-000000000683";
  const neighbor = "knowledge-33333333-3333-4333-8333-000000000684";
  const otherHop = "knowledge-33333333-3333-4333-8333-000000000685";
  const unrelated = "knowledge-33333333-3333-4333-8333-000000000686";
  const nfr = "nfr-33333333-3333-4333-8333-000000000687";
  const target = { kind: "map", id: mapId } as const;
  try {
    const seedItem = (peId: string, type: string, parent: string | undefined, seq: number) =>
      run(
        host.notes.seed(folder + "/" + peId + ".md", {
          schema: "product-engineering.backlog/v1",
          project_id: project,
          id: `backlog-33333333-3333-4333-8333-000000000${seq}`,
          type,
          "pe-id": peId,
          ...(parent && { parent: `[[${parent}]]` }),
        }),
      );
    await seedItem("EP-01", "Epic", undefined, 691);
    await seedItem("FE-01", "Feature", "EP-01", 692);
    await run(
      store.update(folder + "/UC-01.md", () => Result.succeed({ set: { parent: "[[FE-01]]" } })),
    );
    await seedItem("UC-03", "PBI", "FE-01", 693);
    await seedItem("TASK-01", "Task", "UC-01", 694);
    const entities = [
      [noted, "ENT-01", "Referenced", { domain_edges: [edge("REL-01", neighbor)] }],
      [direct, "ENT-02", "Direct", {}],
      [viaPrd, "ENT-03", "Through PRD", { domain_scope: [{ kind: "prd", id: prd }] }],
      [neighbor, "ENT-04", "Neighbor", { domain_edges: [edge("REL-02", otherHop)] }],
      [otherHop, "ENT-05", "Two hops", {}],
      [unrelated, "ENT-06", "Unrelated sibling", { domain_scope: [{ kind: "item", id: "UC-03" }] }],
    ] as const;
    await Promise.all(
      entities.map(([id, display_id, title, fields]) =>
        run(
          host.notes.seed(
            folder + "/" + title + ".md",
            {
              schema: "product-engineering.knowledge/v1",
              project_id: project,
              id,
              display_id,
              title,
              kind: "entity",
              approval: "draft",
              ...fields,
            },
            "Definition of " + title,
          ),
        ),
      ),
    );
    await run(
      host.notes.seed(folder + "/NFRs/Telemetry.md", {
        schema: "product-engineering.nfr/v1",
        project_id: project,
        id: nfr,
        title: "Telemetry",
        requirement: "Track handovers.",
        acceptance: "Log every successful handover.",
        targets: [{ kind: "item", id: "TASK-01" }],
      }),
    );
    await run(rebuildNoteIndex);
    await run(
      saveStoryMapFoundations(await fresh(), {
        prdId: prd,
        jobIds: [job],
        references: [`[[${folder}/Referenced.md#Behavior|Reference]]`],
      }),
    );
    await run(setEntityScope(project, direct, target, true, storyMapDomainContribution));
    await expect(
      run(setEntityScope(other, direct, target, true, storyMapDomainContribution)),
    ).rejects.toMatchObject({ reason: "entity" });
    await run(setTargetNfrs(project, target, [nfr], storyMapNfrContribution));
    const maps = (await run(nfrTargets(project, storyMapNfrContribution))).filter(
      ({ kind }) => kind === "map",
    );
    expect(maps).toMatchObject([{ ...target, displayId: "SM-01" }]);
    expect(
      (await run(nfrTargets(other, storyMapNfrContribution))).filter(({ kind }) => kind === "map"),
    ).toEqual([]);
    await run(rebuildNoteIndex);
    const resolve = (scope: Parameters<typeof storyMapDomainContribution>[1]) =>
      run(resolveDomainScope(project, [scope], storyMapDomainContribution));
    const domain = await resolve(target);
    expect(domain.entities.map(({ id }) => id)).toEqual([noted, direct, viaPrd]);
    expect(domain.entities[0]?.origins).toMatchObject([target]);
    expect(domain.entities[2]?.origins).toMatchObject([{ kind: "prd", id: prd }]);
    expect(domain.edges.map(({ id }) => id)).toEqual(["REL-01"]);
    expect(domain.neighbors.map(({ id }) => id)).toEqual([neighbor]);
    const inherited = await resolve({ kind: "item", id: "TASK-01" });
    expect(inherited.entities.map(({ id }) => id)).toEqual([noted, direct, viaPrd]);
    expect((await resolve({ kind: "item", id: "UC-03" })).entities.map(({ id }) => id)).toEqual([
      unrelated,
    ]);
    expect(await run(resolveNfrScope(project, target, storyMapNfrContribution))).toMatchObject([
      {
        id: nfr,
        acceptance: "Log every successful handover.",
        sources: [{ kind: "item", id: "TASK-01" }, target],
      },
    ]);
    expect(
      await run(resolveNfrScope(project, { kind: "item", id: "UC-03" }, storyMapNfrContribution)),
    ).toEqual([]);
    const stale = await fresh();
    await run(store.update(path, () => Result.succeed({ set: { project_id: other } })));
    expect(await run(storyMapNfrContribution(project))).toEqual([]);
    await expect(run(saveStoryMapHeader(stale, draft))).rejects.toMatchObject({
      reason: "identity",
    });
  } finally {
    await host.runtime.dispose();
  }
});

it("validates roles and same-project adopted items and repairs missing typed links without dropping other fields", async () => {
  const { host, run, fresh } = await setup();
  try {
    const map = await fresh();
    const foundation = {
      prdId: prd,
      jobIds: [job, job],
      references: ["[[Source.md]]", "[[Source.md]]"],
    } as const;
    await expect(
      run(saveStoryMapFoundations(map, { ...foundation, prdId: job })),
    ).rejects.toMatchObject({ reason: "source" });
    await expect(
      run(saveStoryMapFoundations(map, { ...foundation, jobIds: [foreignJob, prd] })),
    ).rejects.toMatchObject({ reason: "target" });
    await run(saveStoryMapFoundations(map, foundation));
    expect(await fresh()).toMatchObject({
      prdId: prd,
      jobIds: [job],
      references: ["[[Source.md]]"],
    });
    await run(
      saveStoryMapFoundations(await fresh(), { prdId: undefined, jobIds: [], references: [] }),
    );
    expect((await fresh()).frontmatter).not.toHaveProperty("prd_id");
    await expect(run(setStoryMapItemLink(map, link("UC-02", other), true))).rejects.toMatchObject({
      reason: "target",
    });
    await expect(run(setStoryMapItemLink(map, link("UC-02"), true))).rejects.toMatchObject({
      reason: "target",
    });
    await run(setStoryMapItemLink(map, link("UC-02", other), false));
    await run(setStoryMapItemLink(map, { ...link("UC-01"), cardId: second.id }, true));
    await run(setStoryMapItemLink(map, { ...link("UC-01"), cardId: second.id }, true));
    const current = await fresh();
    expect(current.frontmatter.card_links).toEqual([
      link("UC-01"),
      { malformed: "preserve" },
      { ...link("UC-01"), cardId: second.id },
    ]);
    expect(storyMapItemBacklinks(project, "UC-01", [current]).map(({ card }) => card.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(storyMapItemBacklinks(other, "UC-01", [current])).toEqual([]);
    await expect(
      run(saveStoryMapHeader({ ...map, projectId: other }, draft)),
    ).rejects.toMatchObject({ reason: "identity" });
  } finally {
    await host.runtime.dispose();
  }
});

it("retries a failed second write with one canonical companion and preserves the linked PBI bytes", async () => {
  const { host, run, store, fresh, folder, path } = await setup();
  try {
    const identity = await run(newBacklogCreation("Q"));
    const work: StoryMapWork = {
      cardId: first.id,
      id: identity.item.id,
      recordId: identity.item.record,
      kind: "Q",
      title: "Which entries are visible?",
      body: "## Verify the current scope",
      state: "Open",
      priority: "",
      owner,
    };
    const pbiPath = folder + "/UC-01.md";
    const original = await run(store.readContent(pbiPath));
    const map = await fresh();
    await expect(
      run(saveStoryMapWork(map, { ...work, owner: other }, "story", identity)),
    ).rejects.toMatchObject({ reason: "work" });
    await run(saveStoryMapWork(map, work, "story", identity));
    const before = await fresh();
    expect(
      storyMapWorkScope(before, first.id, (await run(backlogSnapshot(project))).items).owned,
    ).toEqual([work]);
    await expect(run(saveStoryMapWork(before, work, "UC-02", identity))).rejects.toMatchObject({
      reason: "work",
    });
    let writes = 0;
    const failAtFinalMapWrite: NoteStore["Service"] = {
      ...store,
      update: (file, change) =>
        file === path && ++writes === 2
          ? Effect.fail(new NoteWriteError())
          : store.update(file, change),
    };
    const assign = saveStoryMapWork(before, work, "UC-01", identity);
    await expect(
      run(assign.pipe(Effect.provideService(NoteStore, failAtFinalMapWrite))),
    ).rejects.toMatchObject({ _tag: "NoteWriteError" });
    expect((await fresh()).work).toEqual([work]);
    expect((await run(readBacklogItem(project, work.id))).draft).toMatchObject({
      title: work.title,
      state: "Open",
      owner: "Team Lead",
      parent: "UC-01",
    });
    await Promise.all([run(assign), run(assign)]);
    const updated = await fresh();
    expect(updated.work).toEqual([]);
    expect(updated.cardLinks.filter(({ recordId }) => recordId === work.id)).toEqual([
      link(work.id),
    ]);
    await run(rebuildNoteIndex);
    expect(
      storyMapWorkScope(
        updated,
        first.id,
        (await run(backlogSnapshot(project))).items,
      ).attached.map(({ id }) => id),
    ).toEqual([work.id]);
    expect((await run(store.readContent(pbiPath))).text).toBe(original.text);
  } finally {
    await host.runtime.dispose();
  }
});
