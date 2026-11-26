import { expect, it } from "vitest";
import { Effect } from "effect";
import { catalogFor } from "../../../src/application/messages";
import { rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import {
  prototypeBriefMarkdown,
  prototypesSnapshot,
  resolvePrototypeBrief,
  savePrototype,
} from "../../../src/application/prototypes";
import { testRuntime } from "../../support/runtime";

const owner = "project-33333333-3333-4333-8333-000000000671";
const peer = "project-33333333-3333-4333-8333-000000000672";
const prototype = "prototype-33333333-3333-4333-8333-000000000673";
const map = "story-map-33333333-3333-4333-8333-000000000674";
const prd = "knowledge-33333333-3333-4333-8333-000000000675";
const job = "knowledge-33333333-3333-4333-8333-000000000676";
const entity = "knowledge-33333333-3333-4333-8333-000000000677";
const neighbor = "knowledge-33333333-3333-4333-8333-000000000678";
const nfr = "nfr-33333333-3333-4333-8333-000000000679";
const otherNfr = "nfr-33333333-3333-4333-8333-000000000680";
const member = "project-member-33333333-3333-4333-8333-000000000681";
const labels = catalogFor("en");
const bytes = (value: string) => new TextEncoder().encode(value);

const note = (kind: string, recordId: string, displayId: string, title: string) => ({
  schema: "product-engineering.knowledge/v1",
  kind,
  id: recordId,
  display_id: displayId,
  title,
});

async function fixture() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const project = await run(
    createProject(owner, {
      name: "Service cases",
      description: "Handover cases",
      repository: "team/service",
    }),
  );
  const other = await run(
    createProject(peer, {
      name: "Operations",
      description: "Operations",
      repository: "team/ops",
    }),
  );
  await host.vaultReady();
  const seed = (name: string, fields: Record<string, unknown>, body = "") =>
    run(host.notes.seed(`${project.folder}/${name}.md`, { project_id: owner, ...fields }, body));
  const id = "backlog-33333333-3333-4333-8333-000000000684";
  await seed(
    "UC-09",
    {
      id,
      schema: "product-engineering.backlog/v1",
      "pe-id": "UC-09",
      type: "PBI",
      title: "Export case list",
      pbi_prd_id: prd,
      pbi_job_id: job,
      pbi_requirement_id: "REQ-7",
      pbi_criteria: [
        {
          id: "AC-01",
          text: "File contains its own cases",
          scenario_id: "SC-01",
          scenario_name: "Export after filter",
          given: "Cases are filtered",
          when: "I export",
          then_step: "The correct cases are exported",
        },
      ],
    },
    "Backlog body",
  );
  await seed(
    "PRD",
    { ...note("prd", prd, "PRD-01", "Service export"), requirement_id: "REQ-7", job_ids: [job] },
    "Only permitted cases are exported.",
  );
  await seed("Job", note("jtbd", job, "JOB-01", "Pass work forward"), "Reopen the relevant cases.");
  await seed(
    "Case",
    {
      ...note("entity", entity, "ENT-01", "Case"),
      domain_scope: [{ kind: "prd", id: prd }],
      domain_attributes: [{ name: "Reference", description: "Used in external handover" }],
      domain_edges: [
        {
          id: "REL-01",
          target: neighbor,
          verb: "belongs to",
          sourceCardinality: "0..*",
          targetCardinality: "1",
          rule: "An owner has access.",
        },
      ],
    },
    "A case visible to staff.",
  );
  await seed("Owner", {
    ...note("entity", neighbor, "ENT-02", "Organization"),
    domain_attributes: [
      { name: "Outside branch", description: "Do not include neighbor attributes" },
    ],
  });
  await seed("NFR", {
    id: nfr,
    schema: "product-engineering.nfr/v1",
    title: "Export isolation",
    requirement: "Keep the organization private",
    acceptance: "No unrelated cases",
    categories: ["security"],
    targets: [
      { kind: "item", id: "UC-09" },
      { kind: "map", id: map },
    ],
  });
  await seed("Another NFR", {
    id: otherNfr,
    schema: "product-engineering.nfr/v1",
    title: "Separate requirement",
    requirement: "Separate",
    acceptance: "Separate",
    categories: [],
    targets: [{ kind: "item", id: "UC-09" }],
  });
  const foreign = `${other.folder}/foreign.txt`;
  const prdPath = `${project.folder}/PRD.md`;
  const mapPath = `${project.folder}/SM-01.md`;
  const mapValues = {
    schema: "product-engineering.story-map/v1",
    id: map,
    display_id: "SM-01",
    title: "Handover",
    persona: "Coordinator",
    goal: "Share selected cases",
    prd_id: prd,
    job_ids: [job],
    activities: [{ id: "ACT", title: "Prepare" }],
    steps: [{ id: "STEP", activityId: "ACT", title: "Select export" }],
    slices: [{ id: "SL", title: "Initial slice", outcome: "One handover" }],
    cards: [
      {
        id: "CARD",
        stepId: "STEP",
        sliceId: "SL",
        title: "Grant a preview",
        description: "Opening the preview is optional.",
      },
      { id: "OTHER", stepId: "absent", title: "Needs placement" },
    ],
    card_links: [
      { cardId: "CARD", kind: "item", projectId: owner, recordId: "UC-09" },
      { cardId: "CARD", kind: "item", projectId: owner, recordId: "UC-77" },
      { cardId: "CARD", kind: "item", projectId: peer, recordId: "UC-32" },
    ],
    story_work: [
      {
        cardId: "CARD",
        id: "TASK-05",
        recordId: id,
        kind: "TASK",
        title: "Gather examples",
        body: "Only seeded examples",
        owner: "",
        state: "",
        priority: "",
      },
    ],
    slice_deferrals: [{ cardId: "CARD", sliceId: "SL", decision: "deferred" }],
    references: [
      "[[source.txt|A]]",
      "[[source.txt|B]]",
      "[[binary.txt]]",
      "[[missing.md|Missing evidence]]",
      `[[${foreign}]]`,
      `[[${prdPath}]]`,
    ],
  };
  await seed("SM-01", mapValues);
  host.projectFiles.seedReference("source.txt", bytes("Current selected text"));
  host.projectFiles.seedReference("binary.txt", Uint8Array.of(255, 0, 128));
  host.projectFiles.seedReference(prdPath, bytes("Already included elsewhere"));
  host.projectFiles.seedReference(foreign, bytes("Foreign file must stay out"));
  await run(rebuildNoteIndex);
  const create = async (
    source:
      | { projectId: typeof owner; kind: "map"; id: typeof map }
      | { projectId: typeof owner; kind: "nfr"; id: typeof nfr },
  ) => {
    const storedId = await run(
      savePrototype(owner, prototype, {
        title: "Try the service export",
        description: "Test an offline file",
        source,
        designs: {},
      }),
    );
    await run(rebuildNoteIndex);
    const row = (await run(prototypesSnapshot(owner))).records.find(
      (entry) => entry.id === storedId,
    );
    if (!row) throw new Error("Missing saved brief");
    return row;
  };
  return { ...host, run, create, mapPath, nfrPath: `${project.folder}/NFR.md` };
}

it("exports one deterministic map scope with real criteria, missing labels and only explicit materials", async () => {
  const host = await fixture();
  try {
    const base = await host.create({ projectId: owner, kind: "map", id: map });
    const brief = await host.run(resolvePrototypeBrief(base));
    const markdown = prototypeBriefMarkdown(
      brief,
      labels.prototypes.brief,
      (id) => labels.backlog.nfr.category[id],
      "en",
    );
    for (const value of [
      "Grant a preview",
      "Needs placement",
      "Gather examples",
      "Deferred",
      "UC-77 · Source unavailable",
      "No unrelated cases",
      "ISO/IEC 25010:2023",
      "SM-01",
      "REQ-7",
      "SC-01",
      "Export after filter",
      "REL-01",
      "Reference",
      "Sources per target · 0..*",
      "Targets per source · 1",
      "Current selected text",
      "[[source.txt|B]]",
      "Missing evidence",
      "Binary file",
    ])
      expect(markdown).toContain(value);
    for (const excluded of [
      "UC-32",
      "Foreign file must stay out",
      "Do not include neighbor attributes",
      "Already included elsewhere",
    ])
      expect(markdown).not.toContain(excluded);
    expect(markdown.match(/Current selected text/g)).toHaveLength(1);
    expect(brief.inputs?.nfrs[0]?.sources).toHaveLength(2);
    expect(brief.inputs?.documents.filter(({ id }) => id === job)).toHaveLength(1);
    await host.run(host.notes.removeOutside(host.mapPath));
    const unavailable = await host.run(resolvePrototypeBrief(base));
    expect(
      prototypeBriefMarkdown(unavailable, labels.prototypes.brief, (id) => id, "en"),
    ).toContain("Source unavailable");
  } finally {
    await host.runtime.dispose();
  }
});

it("limits a single NFR to itself while resolving domain origins through its assignments", async () => {
  const host = await fixture();
  try {
    const base = await host.create({ projectId: owner, kind: "nfr", id: nfr });
    const { inputs } = await host.run(resolvePrototypeBrief(base));
    expect(inputs?.nfrs.map(({ id }) => id)).toEqual([nfr]);
    expect(inputs?.journey).toBeUndefined();
    expect(inputs?.domain.entities.map(({ id }) => id)).toEqual([entity]);
    expect(inputs?.domain.neighbors.map(({ id }) => id)).toEqual([neighbor]);
  } finally {
    await host.runtime.dispose();
  }
});

it("rereads unassigned scoped NFR fields and keeps sibling requirements outside the brief", async () => {
  const host = await fixture();
  try {
    const base = await host.create({ projectId: owner, kind: "nfr", id: nfr });
    await Effect.runPromise(
      host.notes.seed(host.nfrPath, {
        schema: "product-engineering.nfr/v1",
        id: nfr,
        project_id: owner,
        title: "Independent export rule",
        requirement: "Show the empty state",
        acceptance: "No assigned sources are needed",
        owner_id: member,
      }),
    );
    const brief = await host.run(resolvePrototypeBrief(base));
    expect(brief.selection?.title).toBe("Independent export rule");
    expect(brief.inputs?.nfrs).toEqual([
      {
        id: nfr,
        title: "Independent export rule",
        requirement: "Show the empty state",
        acceptance: "No assigned sources are needed",
        categories: [],
        owner_id: member,
        sources: [{ kind: "nfr", id: nfr, projectId: owner, title: "Independent export rule" }],
      },
    ]);
    expect(brief.inputs?.targets).toEqual([]);
    expect(brief.inputs?.domain.entities).toEqual([]);
  } finally {
    await host.runtime.dispose();
  }
});
