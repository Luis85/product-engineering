import { Effect, Result } from "effect";
import { expect, it, vi } from "vitest";
import {
  boardRequestDestination,
  boardRequestHandoff,
  backlogSnapshot,
  moveBoardCard,
  pbiBoardStage,
  readBacklogItem,
  saveBacklogItem,
} from "../../../src/application/backlog";
import type { BoardRequest, BoardRequestHandoff } from "../../../src/application/backlog";
import { NoteStore } from "../../../src/application/notes";
import {
  createProject,
  projectDetails,
  saveProjectDetails,
} from "../../../src/application/projects";
import { mappedBoardStage, normalizedBoardStage } from "../../../src/domain/backlog";
import { testRuntime } from "../../support/runtime";

const projectId = "project-33333333-3333-4333-8333-000000000001";
const pbiId = "UC-09";
const handoffFor = (value: BoardRequest) => boardRequestHandoff(projectId, pbiId, [value]);
const request = {
  projectId,
  pbiId,
  id: "FR-09",
  title: "CSV export",
  state: "running",
  sequence: 3,
  runId: "run-09",
} satisfies BoardRequest;

it("projects a linked running request without rewriting legacy stage, while manual and Done win", () => {
  const legacy = Object.freeze({
    state: "In Arbeit",
    fields: Object.freeze({ DeliveryState: "In Arbeit" }),
  });
  expect(pbiBoardStage(legacy, handoffFor(request))).toBe("In Development");
  expect(legacy).toEqual({ state: "In Arbeit", fields: { DeliveryState: "In Arbeit" } });
  expect(
    pbiBoardStage({ ...legacy, fields: { pbi_stage_choice: "In Progress" } }, handoffFor(request)),
  ).toBe("In Progress");
  expect(pbiBoardStage({ ...legacy, state: "Erledigt" }, handoffFor(request))).toBe("Done");
  expect(pbiBoardStage(legacy, handoffFor({ ...request, state: "changes-requested" }))).toBe(
    "In Development",
  );
  expect(
    pbiBoardStage(legacy, handoffFor({ ...request, state: "changes-requested", runId: "" })),
  ).toBe("In Progress");
  for (const state of ["draft", "released", "accepted", "closed"] as const) {
    expect(pbiBoardStage(legacy, handoffFor({ ...request, state }))).toBe("In Progress");
  }
  expect(normalizedBoardStage(" Offen ")).toBe("Open");
  expect(normalizedBoardStage("mystery")).toBeUndefined();
  expect(mappedBoardStage("In Progress", ["Backlog", "Active"])).toBe("Active");
  expect(mappedBoardStage("In Development", ["Backlog", "Active"])).toBe("In Development");
});

it("deduplicates same linked request snapshots and returns only the scoped active and prior records", () => {
  const draft = { ...request, id: "FR-11", state: "draft" as const, sequence: 2 };
  const accepted = { ...request, id: "FR-02", state: "accepted" as const, sequence: 1 };
  const running = { ...request, sequence: 6 };
  const input: BoardRequest[] = [
    request,
    accepted,
    { ...running, projectId: "project-33333333-3333-4333-8333-000000000002" },
    { ...running, pbiId: "UC-10" },
    running,
    draft,
    running,
    { ...accepted, sequence: 0 },
  ];
  expect(boardRequestHandoff(projectId, pbiId, input)).toEqual({
    active: running,
    development: running,
    previous: [draft, accepted],
  });
  expect(boardRequestHandoff(projectId, pbiId, [draft, draft])).toEqual({
    active: draft,
    previous: [],
  });
  expect(boardRequestHandoff(projectId, pbiId, [accepted])).toEqual({ previous: [accepted] });
  expect(boardRequestHandoff(projectId, pbiId, [])).toEqual({ previous: [] });
});

it("keeps an older running request in development and sends repeated attempts to the newest active request", () => {
  const draft = { ...request, id: "FR-11", sequence: 7, state: "draft" as const };
  const foreign = { ...request, pbiId: "UC-12", id: "FR-12", sequence: 8 };
  const previous = { ...request, id: "FR-05", sequence: 2, state: "accepted" as const };
  const handoff: BoardRequestHandoff = boardRequestHandoff(projectId, pbiId, [
    draft,
    foreign,
    previous,
    request,
  ]);
  expect(handoff).toMatchObject({ active: draft, previous: [request, previous] });
  expect(pbiBoardStage({ state: "Offen", fields: {} }, handoff)).toBe("In Development");
  expect(boardRequestDestination(projectId, pbiId, handoff.active)).toEqual({
    kind: "open-request",
    projectId,
    pbiId,
    requestId: draft.id,
  });
  expect(boardRequestDestination(projectId, pbiId)).toEqual({
    kind: "create-request",
    projectId,
    pbiId,
  });
});

async function withMappedPbi(
  check: (host: ReturnType<typeof testRuntime>, path: string) => Promise<void>,
) {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  try {
    const project = await run(
      createProject(projectId, {
        name: "Portal",
        description: "Service product",
        repository: "team/portal",
      }),
    );
    await host.vaultReady();
    const path = project.folder + "/Existing PBI.md";
    host.projectFiles.seedBacklog(project.folder + "/Mapped.base", "# owned fixture", {
      filters: `file.inFolder("${project.folder}")`,
      views: [
        {
          type: "product-backlog",
          stateProperty: "note.DeliveryState",
          stateValues: ["Backlog", "Offen", "Active", "Review", "Erledigt"],
        },
      ],
    });
    await run(
      saveProjectDetails(project, { ...projectDetails(project), backlog_base: "Mapped.base" }),
    );
    await run(
      host.notes.seed(
        path,
        {
          schema: "product-engineering.backlog/v1",
          id: "backlog-33333333-3333-4333-8333-000000000009",
          project_id: projectId,
          "pe-id": pbiId,
          type: "PBI",
          parent: "[[Service overview]]",
          order: 300,
          DeliveryState: "In Arbeit",
          pbi_revision: 3,
          pbi_approved_revision: 3,
          pbi_approval_fingerprint: 123,
          pbi_prd_id: "knowledge-33333333-3333-4333-8333-000000000041",
          pbi_requirement_id: "REQ-07",
          keep: "exact",
        },
        "## Stored description",
      ),
    );
    await vi.waitFor(async () =>
      expect((await run(backlogSnapshot(projectId))).items.map(({ id }) => id)).toContain(pbiId),
    );
    await check(host, path);
  } finally {
    await host.runtime.dispose();
  }
}

it.each(["Board", "Liste"] as const)(
  "keeps the %s manual stage chosen before an already-running legacy request becomes visible",
  async (surface) => {
    await withMappedPbi(async (host, path) => {
      const run = host.runtime.runPromise.bind(host.runtime);
      const store = await run(NoteStore);
      const before = await run(store.readContent(path));
      const legacy = await run(readBacklogItem(projectId, pbiId));
      const destination = surface === "Board" ? "Review" : "Open";
      const raw = surface === "Board" ? "Review" : "Offen";
      if (surface === "Board") {
        await run(moveBoardCard(projectId, pbiId, legacy.draft.state, "Review"));
      } else {
        await run(saveBacklogItem(projectId, legacy, { ...legacy.draft, state: raw }));
      }

      const manual = await run(readBacklogItem(projectId, pbiId));
      const saved = await run(store.readContent(path));
      expect(manual.item.state).toBe(raw);
      const projected = pbiBoardStage(manual.item, handoffFor(request));
      expect((await run(store.readContent(path))).text).toBe(saved.text);
      expect(projected).toBe(destination);
      expect(saved.frontmatter).toEqual({
        ...before.frontmatter,
        DeliveryState: raw,
        pbi_stage_choice: destination,
      });
      expect(saved.body).toBe(before.body);
    });
  },
);

it("keeps explicit mapped choices through Board and List writes and ignores a stale choice after an outside edit", async () => {
  await withMappedPbi(async (host, path) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const store = await run(NoteStore);
    const before = await run(store.readContent(path));
    const legacy = await run(readBacklogItem(projectId, pbiId));
    const handoff = handoffFor(request);
    expect(pbiBoardStage(legacy.item, handoff)).toBe("In Development");
    expect((await run(store.readContent(path))).text).toBe(before.text);
    await run(moveBoardCard(projectId, pbiId, legacy.draft.state, "In Progress"));
    const firstChoice = await run(readBacklogItem(projectId, pbiId));
    expect(firstChoice.item.fields).toEqual({
      ...before.frontmatter,
      DeliveryState: "Active",
      pbi_stage_choice: "In Progress",
    });
    expect(pbiBoardStage(firstChoice.item, handoff)).toBe("In Progress");
    await run(saveBacklogItem(projectId, firstChoice, { ...firstChoice.draft, state: "Review" }));
    const reviewed = await run(readBacklogItem(projectId, pbiId));
    expect(reviewed.item.fields).toEqual({
      ...before.frontmatter,
      DeliveryState: "Review",
      pbi_stage_choice: "Review",
    });
    expect(pbiBoardStage(reviewed.item, handoff)).toBe("Review");
    expect(reviewed.draft.body).toBe(before.body);

    await run(
      store.updateContent(path, () =>
        Result.succeed({ patch: { set: { DeliveryState: "Offen" } } }),
      ),
    );
    const outside = await run(readBacklogItem(projectId, pbiId));
    expect(pbiBoardStage(outside.item, handoff)).toBe("In Development");
    expect(pbiBoardStage(outside.item, handoffFor({ ...request, state: "accepted" }))).toBe("Open");
    const stale = await run(Effect.result(moveBoardCard(projectId, pbiId, "Review", "Backlog")));
    expect(stale).toMatchObject({ _tag: "Failure", failure: { reason: "conflict" } });
    const identity = await run(Effect.result(moveBoardCard(projectId, path, "Offen", "Backlog")));
    expect(identity).toMatchObject({ _tag: "Failure", failure: { reason: "identity" } });
    expect((await run(store.readContent(path))).frontmatter.DeliveryState).toBe("Offen");
  });
});
