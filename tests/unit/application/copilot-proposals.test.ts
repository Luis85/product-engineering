import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  applyCopilotProposal,
  loadCopilot,
  prepareCopilotProposal,
  saveCopilot,
} from "../../../src/application/integrations";
import { knowledgeDetailRoute, knowledgeNoteOptions } from "../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import type { Note } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import { parseCopilotProposal } from "../../../src/domain/integrations";
import type { CopilotComposer, CopilotThread } from "../../../src/domain/integrations";
import { testRuntime } from "../../support/runtime";

const projectId = "project-33333333-3333-4333-8333-000000000001";
const foreignProject = "project-33333333-3333-4333-8333-000000000002";
const target = "knowledge-33333333-3333-4333-8333-000000000059";
const targetKey = "knowledge:" + target;
const supporting = "knowledge-33333333-3333-4333-8333-000000000060";
const supportingKey = "knowledge:" + supporting;
const answer = { title: "Reviewed revision", body: "## Updated requirement\n\nMeasure it." };

async function withNote(
  test: (fixture: {
    run: ReturnType<typeof testRuntime>["runtime"]["runPromise"];
    path: string;
    folder: string;
    notes: ReturnType<typeof testRuntime>["notes"];
  }) => Promise<void>,
  targetFields: Note["frontmatter"] = {},
) {
  const host = testRuntime({ language: "en" });
  const run = host.runtime.runPromise;
  try {
    const project = await run(
      createProject(projectId, {
        name: "Scoped project",
        description: "Review fixture",
        repository: "team/fixture",
      }),
    );
    const path = project.folder + "/PRD-03.md";
    await run(
      host.notes.seed(
        path,
        {
          schema: "product-engineering.knowledge/v1",
          id: target,
          project_id: projectId,
          kind: "prd",
          title: "Original PRD",
          display_id: "PRD-03",
          approval: "approved",
          ...targetFields,
        },
        "Original requirement.",
      ),
    );
    await host.vaultReady();
    await run(rebuildNoteIndex);
    await test({ run, path, folder: project.folder, notes: host.notes });
  } finally {
    await host.runtime.dispose();
  }
}

const supportingFields = {
  schema: "product-engineering.knowledge/v1",
  id: supporting,
  project_id: projectId,
  kind: "research",
  title: "Corroborating research",
  display_id: "RES-01",
  approval: "approved",
};

function proposal(revise?: string, selected: readonly string[] = [targetKey]) {
  return prepareCopilotProposal({
    projectId,
    provider: "codex",
    kind: "prd",
    selected,
    ...(revise !== undefined && { revise }),
  });
}

const composer = (prompt: string): CopilotComposer => ({
  activeId: "",
  prompt,
  mode: "review",
  selected: [targetKey],
  locked: true,
});
const thread = (id: string, content: string) => ({
  id,
  selected: [targetKey],
  messages: [{ role: "user", content }] as const,
});

it("validates proposal envelopes and strips automatic image and raw HTML execution", () => {
  const body =
    "## Requirement\n\n![Alt](https://example.invalid/img.png) ![[embedded.png]] <script>raw</script>";
  const json = JSON.stringify({ title: "  Scoped PRD  ", body, sourceKeys: ["foreign"] });
  expect(parseCopilotProposal("```json\n" + json + "\n```")).toEqual({
    title: "Scoped PRD",
    body: "## Requirement\n\nAlt [embedded.png] &lt;script>raw&lt;/script>",
  });
  for (const invalid of [
    "",
    "draft prose",
    "{}",
    "[]",
    '{"title":" ","body":"hello"}',
    '{"title":"title","body":" "}',
    '{"title":"title","body":4}',
    '{"title":"title","body":"\\u0000"}',
    JSON.stringify({ title: "a".repeat(161), body: "Content" }),
    JSON.stringify({ title: "Title", body: "a".repeat(48_001) }),
  ])
    expect(parseCopilotProposal(invalid)).toBeUndefined();
});

it("applies a validated revision once to the exact note and returns it to draft", () =>
  withNote(async ({ run, path }) => {
    const prepared = await run(proposal(targetKey));
    const store = await run(NoteStore);
    expect(prepared.base?.id).toBe(target);
    expect(prepared.base?.body).toBe("Original requirement.");
    await expect(run(applyCopilotProposal(projectId, prepared, answer, false))).resolves.toEqual(
      knowledgeDetailRoute(projectId, target),
    );
    const first = await run(store.readContent(path));
    expect(first.frontmatter.approval).toBe("draft");
    expect(first.frontmatter.applied_proposal).toBe(prepared.id);
    expect(first.body).toBe(answer.body);
    await expect(
      run(applyCopilotProposal(projectId, prepared, { ...answer, body: "Repeat attempt" }, false)),
    ).resolves.toEqual(knowledgeDetailRoute(projectId, target));
    expect((await run(store.readContent(path))).text).toBe(first.text);
  }));

it("refuses foreign, invalid and stale writes, then saves a new canonical note once", () =>
  withNote(async ({ run, path }) => {
    const prepared = await run(proposal(targetKey));
    const store = await run(NoteStore);
    await expect(
      run(applyCopilotProposal(foreignProject, prepared, answer, false)),
    ).rejects.toMatchObject({ _tag: "NoteEditConflictError" });
    await expect(
      run(applyCopilotProposal(projectId, prepared, { title: "", body: "Invalid" }, false)),
    ).rejects.toMatchObject({ reason: "invalid-proposal" });
    const changed = await run(
      store.updateContent(path, () =>
        Result.succeed({
          patch: { set: { outside_field: "Independent revision" } },
        }),
      ),
    );
    await expect(
      run(applyCopilotProposal(projectId, prepared, answer, false)),
    ).rejects.toMatchObject({ _tag: "NoteEditConflictError" });
    expect((await run(store.readContent(path))).text).toBe(changed.text);
    const route = knowledgeDetailRoute(projectId, prepared.id);
    const saved = await Promise.all(
      [true, true].map((asNew) => run(applyCopilotProposal(projectId, prepared, answer, asNew))),
    );
    expect(saved).toEqual([route, route]);
    await run(rebuildNoteIndex);
    const copies = (await run(knowledgeNoteOptions(projectId))).filter(
      ({ id }) => id === prepared.id,
    );
    expect(copies).toHaveLength(1);
    expect(copies[0]?.values.source_links).toEqual([{ kind: "knowledge", id: target }]);
  }));

it("requires a selected editable revision target", () =>
  withNote(async ({ run }) => {
    expect((await run(proposal())).base).toBeUndefined();
    await expect(run(proposal(targetKey, []))).rejects.toMatchObject({
      reason: "target-unavailable",
    });
    await expect(run(proposal("pbi:UC-01", ["pbi:UC-01"]))).rejects.toMatchObject({
      reason: "target-unavailable",
    });
  }));

it("refuses to revise a note written by a newer schema and keeps its original bytes", () =>
  withNote(
    async ({ run, path }) => {
      const store = await run(NoteStore);
      const before = await run(store.readContent(path));
      expect(await run(knowledgeNoteOptions(projectId))).toEqual([]);
      await expect(run(proposal(targetKey))).rejects.toMatchObject({
        reason: "target-unavailable",
      });
      expect((await run(store.readContent(path))).text).toBe(before.text);
    },
    { schema: "product-engineering.knowledge/v2" },
  ));

it("uses the requested draft kind when saving a copy of a different editable kind", () =>
  withNote(
    async ({ run, path }) => {
      const store = await run(NoteStore);
      const before = await run(store.readContent(path));
      const prepared = await run(proposal(targetKey));
      expect(prepared.base?.kind).toBe("actor");
      expect(prepared.kind).toBe("prd");
      const route = await run(applyCopilotProposal(projectId, prepared, answer, true));
      expect(route).toEqual(knowledgeDetailRoute(projectId, prepared.id));
      await run(rebuildNoteIndex);
      const copy = (await run(knowledgeNoteOptions(projectId))).find(
        ({ id }) => id === prepared.id,
      );
      expect(copy).toMatchObject({
        kind: "prd",
        values: { approval: "draft", source_links: [{ kind: "knowledge", id: target }] },
      });
      expect((await run(store.readContent(path))).text).toBe(before.text);
    },
    { kind: "actor", actor_type: "human", display_id: "ACT-01" },
  ));

it("refuses a revision when the target gains a duplicate identity before Apply", () =>
  withNote(async ({ run, notes, folder, path }) => {
    const store = await run(NoteStore);
    const prepared = await run(proposal(targetKey));
    const original = await run(store.readContent(path));
    const duplicate = folder + "/Copied PRD.md";
    await run(
      notes.seed(duplicate, { ...original.frontmatter, title: "Copied PRD" }, "Copy body."),
    );
    await run(rebuildNoteIndex);
    const copied = await run(store.readContent(duplicate));
    await expect(run(proposal(targetKey))).rejects.toMatchObject({ reason: "target-unavailable" });
    await expect(
      run(applyCopilotProposal(projectId, prepared, answer, false)),
    ).rejects.toMatchObject({
      reason: "source-unavailable",
    });
    expect((await run(store.readContent(path))).text).toBe(original.text);
    expect((await run(store.readContent(duplicate))).text).toBe(copied.text);
  }));

it("refuses to save a new draft after an explicitly selected supporting source disappears", () =>
  withNote(async ({ run, notes, folder, path }) => {
    const store = await run(NoteStore);
    const before = await run(store.readContent(path));
    const evidence = folder + "/Research.md";
    await run(notes.seed(evidence, supportingFields, "Additional interview."));
    await run(rebuildNoteIndex);
    const prepared = await run(proposal(undefined, [targetKey, supportingKey]));
    await run(store.trash(evidence));
    await run(rebuildNoteIndex);
    await expect(
      run(applyCopilotProposal(projectId, prepared, answer, true)),
    ).rejects.toMatchObject({
      reason: "source-unavailable",
    });
    expect((await run(knowledgeNoteOptions(projectId))).map(({ id }) => id)).toEqual([target]);
    expect((await run(store.readContent(path))).text).toBe(before.text);
  }));

const longFolder = Array.from(
  { length: 9 },
  (_, index) => "division-" + index + "a".repeat(85),
).join("/");

it.each([
  ["bracketed folder", "Research [Archive]"],
  ["long path", longFolder],
])("retains the surviving typed citation without an ambiguous raw link for %s", (_, location) =>
  withNote(async ({ run, notes, folder, path }) => {
    const store = await run(NoteStore);
    const evidence = folder + "/" + location + "/Research.md";
    await run(notes.seed(evidence, supportingFields, "Corroborated decision."));
    await run(rebuildNoteIndex);
    const prepared = await run(proposal(targetKey, [targetKey, supportingKey, supportingKey]));
    await run(store.trash(path));
    await run(rebuildNoteIndex);
    const route = await run(applyCopilotProposal(projectId, prepared, answer, true));
    expect(route).toEqual(knowledgeDetailRoute(projectId, prepared.id));
    await run(rebuildNoteIndex);
    const saved = (await run(knowledgeNoteOptions(projectId))).find(({ id }) => id === prepared.id);
    expect(saved?.values.source_links).toEqual([{ kind: "knowledge", id: supporting }]);
    expect(saved?.values.references).toEqual([]);
    expect((await run(store.readContent(evidence))).body).toBe("Corroborated decision.");
  }),
);

const movedMapId = "story-map-33333333-3333-4333-8333-000000000061";
const movedNfrId = "nfr-33333333-3333-4333-8333-000000000062";
const selectedRecords = [
  {
    name: "story map",
    key: "map:" + movedMapId,
    fields: {
      schema: "product-engineering.story-map/v1",
      id: movedMapId,
      display_id: "SM-01",
      title: "Handover steps",
      persona: "Coordinator",
      goal: "Transfer cases",
      activities: [],
      steps: [],
      slices: [],
      cards: [],
    },
  },
  {
    name: "NFR",
    key: "nfr:" + movedNfrId,
    fields: {
      schema: "product-engineering.nfr/v1",
      id: movedNfrId,
      title: "Availability",
      requirement: "Readers retain access",
      acceptance: "Requests succeed across a restart",
    },
  },
] as const;

function moveAtRead(store: NoteStore["Service"], path: string): NoteStore["Service"] {
  const move = store
    .update(path, () => Result.succeed({ set: { project_id: foreignProject } }))
    .pipe(Effect.orDie);
  return {
    ...store,
    readContent: (readPath) =>
      readPath === path
        ? Effect.andThen(move, store.readContent(path))
        : store.readContent(readPath),
    readFresh: (readPath) =>
      readPath === path ? Effect.andThen(move, store.readFresh(path)) : store.readFresh(readPath),
  };
}

it.each(selectedRecords)(
  "refuses a selected $name that moves projects before the fresh read",
  ({ key, fields }) =>
    withNote(async ({ run, notes, folder, path }) => {
      const store = await run(NoteStore);
      const evidence = folder + "/Planning source.md";
      await run(
        notes.seed(evidence, { ...fields, project_id: projectId }, "Original planning text."),
      );
      await run(rebuildNoteIndex);
      const prepared = await run(proposal(targetKey, [targetKey, key]));
      const original = await run(store.readContent(path));
      const apply = applyCopilotProposal(projectId, prepared, answer, false).pipe(
        Effect.provideService(NoteStore, moveAtRead(store, evidence)),
      );
      await expect(run(apply)).rejects.toMatchObject({ reason: "source-unavailable" });
      expect((await run(store.readFresh(evidence))).frontmatter.project_id).toBe(foreignProject);
      expect((await run(store.readContent(path))).text).toBe(original.text);
    }),
);

it("coalesces concurrent draft saves while retaining distinct threads and project instructions", () =>
  withNote(async ({ run }) => {
    expect(await run(loadCopilot(projectId))).toBeUndefined();
    await Promise.all([
      run(saveCopilot(projectId, { composer: composer("a") })),
      run(saveCopilot(projectId, { thread: thread("one", "first message") })),
      run(saveCopilot(projectId, { instructions: "Project instructions" })),
      run(saveCopilot(projectId, { composer: composer("last unsent draft") })),
      run(saveCopilot(projectId, { thread: thread("two", "second message") })),
    ]);
    await run(saveCopilot(projectId, { thread: thread("one", "updated message") }));
    expect(await run(loadCopilot(projectId))).toEqual({
      composer: composer("last unsent draft"),
      instructions: "Project instructions",
      threads: [thread("one", "updated message"), thread("two", "second message")],
    });
    expect(await run(loadCopilot(foreignProject))).toBeUndefined();
  }));

it("preserves per-reply attribution and reads historical messages without citation keys", () =>
  withNote(async ({ run }) => {
    const stored: CopilotThread = {
      id: "review",
      selected: [targetKey],
      messages: [
        { role: "user", content: "First review" },
        { role: "assistant", content: "Historical reply" },
        { role: "user", content: "Second review" },
        { role: "assistant", content: "Attributed reply", sources: [targetKey] },
      ],
    };
    await run(saveCopilot(projectId, { thread: stored }));
    expect((await run(loadCopilot(projectId)))?.threads).toEqual([stored]);
  }));
