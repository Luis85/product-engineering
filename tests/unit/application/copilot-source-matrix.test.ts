import { expect, it } from "vitest";
import {
  backlogRoute,
  deliverablesRoute,
  nfrCatalogRoute,
  pbiDetailRoute,
} from "../../../src/application/backlog";
import { domainModelRoute } from "../../../src/application/domain-model";
import { copilotRouteSource, scopedChatMessages } from "../../../src/application/integrations";
import type { ChatMessage } from "../../../src/application/integrations";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { rebuildNoteIndex } from "../../../src/application/notes";
import {
  createProject,
  projectOverviewRoute,
  projectRecordRoute,
  projectsRoute,
} from "../../../src/application/projects";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { traceRoute } from "../../../src/application/trace";
import { testRuntime } from "../../support/runtime";

const first = "project-33333333-3333-4333-8333-000000000141";
const other = "project-33333333-3333-4333-8333-000000000142";
const prd = "knowledge-33333333-3333-4333-8333-000000000143";
const sibling = "knowledge-33333333-3333-4333-8333-000000000144";
const foreign = "knowledge-33333333-3333-4333-8333-000000000145";
const entity = "knowledge-33333333-3333-4333-8333-000000000146";
const map = "story-map-33333333-3333-4333-8333-000000000147";
const nfr = "nfr-33333333-3333-4333-8333-000000000148";
const prdKey = "knowledge:" + prd;

it.each([
  ["project choices", projectsRoute, undefined],
  ["overview", projectOverviewRoute(first), undefined],
  ["scope collision", knowledgeDetailRoute(other, prd), undefined],
  ["canonical note", knowledgeDetailRoute(first, prd), prdKey],
  [
    "unsupported record",
    projectRecordRoute({ projectId: first, kind: "project", recordId: "sample" }),
    undefined,
  ],
  ["PBI", pbiDetailRoute(first, "UC-09"), "pbi:UC-09"],
  ["map register", storyMapsRoute(first), undefined],
  ["exact map", storyMapsRoute(first, map, "CARD-03"), "map:" + map],
  ["NFR catalog", nfrCatalogRoute(first), undefined],
  ["exact NFR", nfrCatalogRoute(first, nfr), "nfr:" + nfr],
  ["selected backlog item", backlogRoute(first, "UC-09"), "pbi:UC-09"],
  ["deliverables", deliverablesRoute(first), undefined],
  ["domain model", domainModelRoute(first), undefined],
  ["selected entity", domainModelRoute(first, entity), "knowledge:" + entity],
  ["Trace without selection", traceRoute(first), undefined],
  ["selected Trace PBI", traceRoute(first, "UC-09"), "pbi:UC-09"],
] as const)("uses only the current project's identifiable source for %s", (_, route, key) => {
  expect(copilotRouteSource(route, first)).toBe(key);
});

type Harness = ReturnType<typeof testRuntime>;

async function sourceFixture() {
  const host = testRuntime({ language: "en" });
  const run = host.runtime.runPromise;
  const local = await run(
    createProject(first, {
      name: "Copilot scope",
      description: "Local scope fixture",
      repository: "team/local",
    }),
  );
  const outside = await run(
    createProject(other, {
      name: "Foreign scope",
      description: "Foreign fixture",
      repository: "team/foreign",
    }),
  );
  await host.vaultReady();
  const seedNote = (
    id: string,
    projectId: typeof first | typeof other,
    folder: string,
    displayId: string,
    title: string,
    body: string,
    kind: "prd" | "entity" = "prd",
  ) =>
    run(
      host.notes.seed(
        `${folder}/${displayId}.md`,
        {
          schema: "product-engineering.knowledge/v1",
          id,
          project_id: projectId,
          kind,
          title,
          display_id: displayId,
          approval: "approved",
        },
        body,
      ),
    );
  await Promise.all([
    seedNote(
      prd,
      first,
      local.folder,
      "PRD-03",
      "Chosen handoff",
      "AUTHORED CONTENT\n" + "x".repeat(8_010) + "OVERSIZED TAIL",
    ),
    seedNote(sibling, first, local.folder, "PRD-04", "Unselected sibling", "LOCAL PRIVATE SIBLING"),
    seedNote(foreign, other, outside.folder, "PRD-03", "Foreign duplicate", "FOREIGN PRIVATE BODY"),
    seedNote(entity, first, local.folder, "ENT-02", "Service case", "ENTITY DESCRIPTION", "entity"),
    run(
      host.notes.seed(
        `${local.folder}/UC-09.md`,
        {
          schema: "product-engineering.backlog/v1",
          id: "backlog-33333333-3333-4333-8333-000000000149",
          project_id: first,
          "pe-id": "UC-09",
          type: "PBI",
          title: "Confirmed cases",
          order: 1,
        },
        "PBI EXPLICIT TEXT",
      ),
    ),
    run(
      host.notes.seed(
        `${local.folder}/SM-01.md`,
        {
          schema: "product-engineering.story-map/v1",
          id: map,
          project_id: first,
          display_id: "SM-01",
          title: "First handoff",
          persona: "Operator",
          goal: "MAP GOAL",
          activities: [],
          steps: [],
          slices: [],
          cards: [],
        },
        "MAP OWNED TEXT",
      ),
    ),
    run(
      host.notes.seed(`${local.folder}/NFR-03.md`, {
        schema: "product-engineering.nfr/v1",
        id: nfr,
        project_id: first,
        title: "Reliability",
        requirement: "NFR REQUIREMENT",
        acceptance: "NFR ACCEPTANCE",
        categories: [],
      }),
    ),
  ]);
  await run(rebuildNoteIndex);
  return { host, run, path: `${local.folder}/PRD-03.md` };
}

function query(overrides: Partial<Parameters<typeof scopedChatMessages>[0]> = {}) {
  return scopedChatMessages({
    projectId: first,
    provider: "codex",
    mode: "ask",
    prompt: "Review the handoff.",
    selected: [],
    history: [],
    instructions: "Use the project terminology.",
    ...overrides,
  });
}

async function withSourceFixture(
  check: (fixture: {
    host: Harness;
    run: Harness["runtime"]["runPromise"];
    path: string;
  }) => Promise<void>,
) {
  const fixture = await sourceFixture();
  try {
    await check(fixture);
  } finally {
    await fixture.host.runtime.dispose();
  }
}

it("sends each explicit project source once and bounds chosen text and thread context", () =>
  withSourceFixture(async ({ run }) => {
    const reply = "Useful reply\n" + "y".repeat(8_015) + "OLD HISTORY TAIL";
    const history: ChatMessage[] = [
      ...Array.from({ length: 12 }, (_, index) => ({
        role: "user" as const,
        content: "Earlier " + index,
      })),
      { role: "assistant", content: reply },
    ];
    const messages = await run(
      query({
        mode: "review",
        reviewTarget: prdKey,
        selected: [prdKey, prdKey, "pbi:UC-09", "map:" + map, "nfr:" + nfr, "knowledge:" + entity],
        history,
      }),
    );
    expect(messages).toHaveLength(13);
    expect(messages[0]).toEqual({ role: "user", content: "Earlier 1" });
    expect(messages[11]).toEqual({
      role: "assistant",
      content: reply.slice(0, 8_000),
    });
    const outbound = messages.at(-1);
    if (!outbound) throw new Error("Missing outbound request");
    expect(outbound.role).toBe("user");
    const request = JSON.parse(outbound.content) as {
      mode: string;
      prompt: string;
      instructions: string;
      sources: { name: string; title: string; body: string }[];
    };
    expect(request).toMatchObject({
      mode: "review",
      prompt: "Review the handoff.",
      instructions: "Use the project terminology.",
      reviewTarget: "PRD-03",
    });
    const expectedSources = [
      { name: "PRD-03", title: "Chosen handoff", excerpt: "AUTHORED CONTENT" },
      { name: "UC-09", title: "Confirmed cases", excerpt: "PBI EXPLICIT TEXT" },
      { name: "SM-01", title: "First handoff", excerpt: "MAP GOAL" },
      { name: nfr, title: "Reliability", excerpt: "NFR ACCEPTANCE" },
      { name: "ENT-02", title: "Service case", excerpt: "ENTITY DESCRIPTION" },
    ];
    expect(request.sources.map(({ name, title }) => ({ name, title }))).toEqual(
      expectedSources.map(({ name, title }) => ({ name, title })),
    );
    expectedSources.forEach(({ excerpt }, index) => {
      expect(request.sources[index]?.body).toContain(excerpt);
    });
    expect(request.sources[0]?.body).toHaveLength(8_000);
    expect(outbound.content).not.toMatch(
      /OVERSIZED TAIL|LOCAL PRIVATE SIBLING|FOREIGN PRIVATE BODY/,
    );
  }));

it("rejects foreign, unknown and deleted selections without substituting another record", () =>
  withSourceFixture(async ({ host, run, path }) => {
    const refused = { reason: "source-unavailable", provider: "codex" };
    await expect(run(query({ selected: [prdKey, "knowledge:" + foreign] }))).rejects.toMatchObject(
      refused,
    );
    await expect(run(query({ selected: ["pbi:UC-88"] }))).rejects.toMatchObject(refused);
    await run(host.notes.removeOutside(path));
    await expect(run(query({ selected: [prdKey] }))).rejects.toMatchObject(refused);
    const messages = await run(query({ mode: "ask", selected: [] }));
    expect(messages[0]).toEqual({
      role: "user",
      content: JSON.stringify({
        mode: "ask",
        prompt: "Review the handoff.",
        instructions: "Use the project terminology.",
        sources: [],
      }),
    });
  }));

it("refuses over-limit text or excessive source selection before preparing any request", () =>
  withSourceFixture(async ({ run }) => {
    const reason = { reason: "unsupported-request", provider: "codex" };
    const excess = Array.from({ length: 13 }, (_, index) => `knowledge:${index}`);
    await expect(run(query({ selected: excess }))).rejects.toMatchObject(reason);
    await expect(run(query({ prompt: "a".repeat(8_001) }))).rejects.toMatchObject(reason);
    await expect(run(query({ instructions: "a".repeat(8_001) }))).rejects.toMatchObject(reason);
  }));

it("refuses revision targets outside the explicit project-local selection", () =>
  withSourceFixture(async ({ run }) => {
    const selected = ["knowledge:" + entity];
    const refused = { reason: "target-unavailable", provider: "codex" };
    await expect(
      run(
        query({
          mode: "revise",
          selected,
          proposal: { kind: "prd", target: "knowledge:" + foreign },
        }),
      ),
    ).rejects.toMatchObject(refused);
    await expect(
      run(query({ mode: "revise", selected, proposal: { kind: "prd", target: prdKey } })),
    ).rejects.toMatchObject(refused);
    await expect(
      run(query({ mode: "revise", selected, proposal: { kind: "prd" } })),
    ).rejects.toMatchObject(refused);
    await expect(
      run(
        query({
          mode: "revise",
          selected: ["pbi:UC-09"],
          proposal: { kind: "prd", target: "pbi:UC-09" },
        }),
      ),
    ).rejects.toMatchObject(refused);
  }));

it("refuses reviews without a selected project-local target before serialization", () =>
  withSourceFixture(async ({ run }) => {
    const refused = { reason: "target-unavailable", provider: "codex" };
    await expect(run(query({ mode: "review" }))).rejects.toMatchObject(refused);
    await expect(
      run(query({ mode: "review", selected: [prdKey], reviewTarget: "knowledge:" + foreign })),
    ).rejects.toMatchObject(refused);
    await expect(
      run(query({ mode: "review", selected: ["knowledge:" + entity], reviewTarget: prdKey })),
    ).rejects.toMatchObject(refused);
  }));

it("serializes the verified target's visible label for a revision and drops target keys from drafting", () =>
  withSourceFixture(async ({ run }) => {
    const messages = await run(
      query({ mode: "revise", selected: [prdKey], proposal: { kind: "prd", target: prdKey } }),
    );
    const request = messages.at(-1)?.content;
    expect(JSON.parse(request ?? "{}")).toMatchObject({
      proposal: { kind: "prd", target: "PRD-03" },
      sources: [{ name: "PRD-03", title: "Chosen handoff" }],
    });
    expect(request).not.toContain(prdKey);

    const drafted = await run(
      query({
        mode: "draft",
        selected: [],
        proposal: { kind: "prd", target: "knowledge:" + foreign },
      }),
    );
    expect(JSON.parse(drafted.at(-1)?.content ?? "{}")).toMatchObject({
      proposal: { kind: "prd" },
      sources: [],
    });
    expect(drafted.at(-1)?.content).not.toContain(foreign);
  }));
