import { expect, it } from "vitest";
import { createKnowledge } from "../../../src/application/knowledge";
import type { KnowledgeDraft } from "../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import type { ProjectId } from "../../../src/application/projects";
import {
  prototypeOutputStatus,
  prototypesForSource,
  prototypesSnapshot,
  resolvePrototypeSource,
  savePrototype,
} from "../../../src/application/prototypes";
import type { PrototypeDesigns } from "../../../src/application/prototypes";
import { testRuntime } from "../../support/runtime";

const owner = "project-33333333-3333-4333-8333-000000000641";
const peer = "project-33333333-3333-4333-8333-000000000642";
const missing = "project-33333333-3333-4333-8333-000000000643";
const primary = "prototype-33333333-3333-4333-8333-000000000644";
const secondary = "prototype-33333333-3333-4333-8333-000000000645";
const styleId = "knowledge-33333333-3333-4333-8333-000000000646";
const systemId = "knowledge-33333333-3333-4333-8333-000000000647";
const foreignStyleId = "knowledge-33333333-3333-4333-8333-000000000648";
const mapId = "story-map-33333333-3333-4333-8333-000000000649";
const source = { projectId: owner, kind: "UC", id: "UC-09" } as const;
const draft = {
  title: "Try exporting cases",
  description: "Download the selected cases.",
  source,
  designs: {},
};
const knowledge = { owner_id: "", actor_type: "", vision_id: "", job_ids: [] } as const;
const style = {
  ...knowledge,
  kind: "style-guide",
  title: "Portal Typography",
  body: "Use a legible typeface.",
} as const;
const system = {
  ...knowledge,
  kind: "design-system",
  title: "Portal Components",
  body: "Use the primary button.",
} as const;
const designDraft = {
  "style-guide": { id: styleId, draft: style },
  "design-system": { id: systemId, draft: system },
} as const satisfies PrototypeDesigns;

const pbi = (projectId: ProjectId, suffix: number, title: string) => ({
  id: `backlog-33333333-3333-4333-8333-00000000065${suffix}`,
  schema: "product-engineering.backlog/v1",
  project_id: projectId,
  "pe-id": "UC-09",
  title,
  type: "PBI",
});

async function fixtures(host: ReturnType<typeof testRuntime>) {
  const run = host.runtime.runPromise.bind(host.runtime);
  const one = await run(
    createProject(owner, {
      name: "Service",
      description: "Service cases",
      repository: "team/service",
    }),
  );
  const two = await run(
    createProject(peer, {
      name: "Operations",
      description: "Operations",
      repository: "team/operations",
    }),
  );
  await host.vaultReady();
  await run(host.notes.seed(`${one.folder}/UC-09.md`, pbi(owner, 0, "Export service cases")));
  await run(host.notes.seed(`${two.folder}/UC-09.md`, pbi(peer, 1, "Export operations cases")));
  await run(
    host.notes.seed(`${one.folder}/SM-01.md`, {
      id: mapId,
      schema: "product-engineering.story-map/v1",
      project_id: owner,
      display_id: "SM-01",
      title: "Service handover",
      persona: "Coordinator",
      goal: "Handover open cases",
      cards: [],
      slices: [],
      steps: [],
      activities: [],
    }),
  );
  await run(rebuildNoteIndex);
}

it("validates both design documents before writing and refuses foreign and ambiguous scope", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  try {
    await fixtures(host);
    const foreign = { ...source, projectId: peer } as const;
    expect(await run(resolvePrototypeSource(peer, foreign))).toMatchObject({
      title: "Export operations cases",
    });
    expect(await run(resolvePrototypeSource(owner, foreign))).toBeUndefined();
    expect(await run(resolvePrototypeSource(owner, { ...source, kind: "BUG" }))).toBeUndefined();
    await expect(run(savePrototype(owner, "prototype-malformed", draft))).rejects.toMatchObject({
      reason: "identity",
    });
    await expect(
      run(savePrototype(owner, primary, { ...draft, title: "\r" })),
    ).rejects.toMatchObject({ reason: "title" });
    await expect(run(savePrototype(missing, primary, draft))).rejects.toMatchObject({
      reason: "project",
    });
    await expect(
      run(savePrototype(owner, primary, { ...draft, source: foreign })),
    ).rejects.toMatchObject({ reason: "source" });
    const foreignNote = await run(createKnowledge({ projectId: peer, id: foreignStyleId }, style));
    await run(rebuildNoteIndex);
    const store = await run(NoteStore);
    const original = await run(store.list);
    const create = (designs: PrototypeDesigns) =>
      run(savePrototype(owner, primary, { ...draft, designs }));
    const malformed: KnowledgeDraft = { ...system, body: " " };
    await expect(
      create({ ...designDraft, "design-system": { id: systemId, draft: malformed } }),
    ).rejects.toMatchObject({ reason: "designDraft" });
    await expect(
      create({ ...designDraft, "design-system": { id: styleId, draft: system } }),
    ).rejects.toMatchObject({ reason: "design" });
    await expect(create({ "style-guide": { id: foreignStyleId } })).rejects.toMatchObject({
      reason: "design",
    });
    await expect(
      create({ "style-guide": { id: foreignStyleId, draft: style } }),
    ).rejects.toMatchObject({ reason: "design" });
    expect(await run(store.list)).toEqual(original);
    expect((await run(store.readFresh(foreignNote.path))).frontmatter.project_id).toBe(peer);
  } finally {
    await host.runtime.dispose();
  }
});

it("serializes requests, keeps one local revision for a repeated no-op and preserves recorded output on change", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  try {
    await fixtures(host);
    const write = () => run(savePrototype(owner, primary, { ...draft, designs: designDraft }));
    expect(await Promise.all([write(), write()])).toEqual([primary, primary]);
    await run(rebuildNoteIndex);
    await expect(
      run(savePrototype(owner, primary, { ...draft, title: "Another use" })),
    ).rejects.toMatchObject({ reason: "identity" });
    const styleSelection = { "style-guide": { id: styleId } } as const satisfies PrototypeDesigns;
    await expect(
      run(
        savePrototype(owner, secondary, {
          ...draft,
          designs: { "design-system": { id: styleId } },
        }),
      ),
    ).rejects.toMatchObject({ reason: "design" });
    const store = await run(NoteStore);
    const recorded = (await run(prototypesSnapshot(owner))).records[0];
    if (!recorded) throw new Error("Expected persisted brief");
    expect(recorded).toMatchObject({ projectId: owner, displayId: "PT-01", revision: 1 });
    expect(prototypeOutputStatus(recorded)).toBe("brief");
    expect(
      (await run(store.list)).filter(({ frontmatter }) =>
        [styleId, systemId].some((id) => id === frontmatter.id),
      ),
    ).toHaveLength(2);
    const body = "<h1>Original saved output</h1>";
    await run(
      host.notes.seed(
        recorded.path,
        {
          ...recorded.frontmatter,
          output_html: body,
          output_file_name: "PT-01.html",
          output_provenance: "manual",
          external_key: "Keep me",
        },
        "## External Markdown",
      ),
    );
    await run(rebuildNoteIndex);
    const [withOutput] = (await run(prototypesSnapshot(owner))).records;
    if (!withOutput) throw new Error("Expected brief with recorded output");
    expect(prototypeOutputStatus(withOutput)).toBe("recorded");
    const unchanged = {
      ...draft,
      designs: { ...styleSelection, "design-system": { id: systemId } },
    } as const;
    await run(savePrototype(owner, primary, unchanged, withOutput));
    expect((await run(store.readFresh(recorded.path))).frontmatter.revision).toBe(1);
    const map = { projectId: owner, id: mapId, kind: "map" } as const;
    await run(
      savePrototype(owner, primary, { ...draft, designs: styleSelection, source: map }, withOutput),
    );
    await run(rebuildNoteIndex);
    const rows = (await run(prototypesSnapshot(owner))).records;
    expect(prototypesForSource(rows, source)).toHaveLength(0);
    const [edited] = prototypesForSource(rows, map);
    if (!edited) throw new Error("Expected reciprocal map scope");
    expect(prototypeOutputStatus(edited)).toBe("stale");
    expect(edited.frontmatter).toMatchObject({
      revision: 2,
      output_revision: 1,
      output_html: body,
      external_key: "Keep me",
    });
    expect(edited.values.design_system_id).toBeUndefined();
    expect((await run(store.readContent(edited.path))).body).toContain("## External Markdown");
    await run(savePrototype(peer, secondary, { ...draft, source: { ...source, projectId: peer } }));
    await run(rebuildNoteIndex);
    expect((await run(prototypesSnapshot(peer))).records[0]).toMatchObject({
      projectId: peer,
      displayId: "PT-01",
    });
  } finally {
    await host.runtime.dispose();
  }
});
