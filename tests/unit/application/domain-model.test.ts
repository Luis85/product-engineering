import { Effect } from "effect";
import { expect, it } from "vitest";
import {
  deleteDomainEdge,
  resolveDomainScope,
  saveDomainEdge,
  setEntityArchived,
  setEntityScope,
} from "../../../src/application/domain-model";
import type { DomainScopeContributor } from "../../../src/application/domain-model";
import { readKnowledgeNote, resolveKnowledgeNote } from "../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import type { ProjectId } from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";

const project = "project-33333333-3333-4333-8333-000000000001";
const other = "project-33333333-3333-4333-8333-000000000002";
const source = "knowledge-33333333-3333-4333-8333-000000000041";
const target = "knowledge-33333333-3333-4333-8333-000000000042";
const sibling = "knowledge-33333333-3333-4333-8333-000000000043";
const foreign = "knowledge-33333333-3333-4333-8333-000000000044";
const map = { kind: "map", id: "map-handoff" } as const;
const item = { kind: "item", id: "item-case" } as const;
const unrelated = { kind: "item", id: "item-sibling" } as const;
const base = {
  id: "REL-01",
  source,
  target,
  verb: "meldet",
  rule: "Vor der Freigabe",
  sourceCardinality: "1",
  targetCardinality: "0..*",
} as const;
const from = "Organisation.md";
const to = "Servicefall.md";
const { source: _source, ...stored } = base;

async function withModel(action: (host: ReturnType<typeof testRuntime>) => Promise<void>) {
  const host = testRuntime();
  const seed = (
    path: string,
    id: string,
    display_id: string,
    fields: Record<string, unknown>,
    project_id: ProjectId = project,
  ) =>
    host.runtime.runPromise(
      host.notes.seed(
        path,
        {
          schema: "product-engineering.knowledge/v1",
          kind: "entity",
          id,
          display_id,
          title: path.replace(".md", ""),
          project_id,
          ...fields,
        },
        "Definition",
      ),
    );
  try {
    await seed(from, source, "ENT-01", { domain_edges: [stored] });
    await seed(to, target, "ENT-02", {});
    await seed("Nachbar.md", sibling, "ENT-03", { domain_scope: [unrelated] });
    await seed("Extern.md", foreign, "ENT-01", { domain_scope: [map] }, other);
    await host.vaultReady();
    await host.runtime.runPromise(rebuildNoteIndex);
    await action(host);
  } finally {
    await host.runtime.dispose();
  }
}

it("retains rename identity and prevents stale, duplicate, invalid, retired and foreign relationship writes", async () => {
  await withModel(async ({ runtime, notes }) => {
    const path = "Servicefall extern.md";
    const write = runtime.runPromise;
    const content = NoteStore.use((store) => store.readContent(from));
    const before = await write(content);
    const rejected = [
      [saveDomainEdge(project, { ...base, id: "REL-02", verb: " MELDET " }), "duplicate"],
      [saveDomainEdge(project, { ...base, id: "REL-03", target: foreign }), "entity"],
      [saveDomainEdge(project, { ...base, id: "bad ID" }), "edge"],
      [saveDomainEdge(project, { ...base, verb: "fragt" }), "changed"],
    ] as const;
    await Promise.all(
      rejected.map(([mutation, reason]) =>
        expect(write(mutation)).rejects.toMatchObject({ _tag: "DomainModelError", reason }),
      ),
    );
    expect(await write(content)).toEqual(before);
    await write(NoteStore.use((store) => store.rename(to, "Servicefall extern")));
    await write(rebuildNoteIndex);
    expect(await write(resolveKnowledgeNote(project, target))).toMatchObject({ id: target, path });
    const current = await write(saveDomainEdge(project, { ...base, rule: "Aktuell" }, base));
    await expect(
      write(saveDomainEdge(project, { ...base, rule: "Alt" }, base)),
    ).rejects.toMatchObject({ reason: "changed" });
    await write(deleteDomainEdge(project, current));
    await write(deleteDomainEdge(project, current));
    await expect(write(saveDomainEdge(project, base))).rejects.toMatchObject({ reason: "edge" });
    expect((await write(content)).frontmatter).toMatchObject({
      domain_edges: [],
      domain_retired_edges: ["REL-01"],
    });
    await write(notes.removeOutside(path));
    await expect(write(saveDomainEdge(project, { ...base, id: "REL-04" }))).rejects.toMatchObject({
      reason: "entity",
    });
  });
});

const contribute: DomainScopeContributor = (_, requested) => {
  if (requested.id === map.id) {
    return Effect.succeed({
      source: { ...map, projectId: project, title: "Übergabe" },
      origins: [
        { ...item, projectId: project, title: "Servicefall" },
        { ...unrelated, projectId: other, title: "Foreign" },
      ],
      foundationEntities: [target, foreign],
    });
  }
  return Effect.succeed({ source: { ...item, projectId: project, title: "Servicefall" } });
};

it("validates contributed item and map origins, omits foreign and unrelated scope, and filters archived edges", async () => {
  await withModel(async ({ runtime }) => {
    const write = runtime.runPromise;
    const invalid = { kind: "prd", id: "PRD-03" } as const;
    await expect(write(setEntityScope(project, source, invalid, true))).rejects.toMatchObject({
      reason: "scope",
    });
    await expect(
      write(setEntityScope(project, source, unrelated, true, contribute)),
    ).rejects.toMatchObject({ reason: "scope" });
    await write(setEntityScope(project, source, item, true, contribute));
    const scope = await write(resolveDomainScope(project, [map, invalid], contribute));
    expect(
      scope.entities.map(({ id, origins }) => [id, origins.map(({ id: origin }) => origin)]),
    ).toEqual([
      [source, [item.id]],
      [target, [map.id]],
    ]);
    expect(scope.edges).toHaveLength(1);
    expect(scope.neighbors).toEqual([]);
    const note = await write(readKnowledgeNote(project, source, from));
    await write(setEntityArchived(note, true));
    await expect(
      write(setEntityScope(project, source, map, true, contribute)),
    ).rejects.toMatchObject({ reason: "entity" });
    const archived = await write(resolveDomainScope(project, [map], contribute));
    expect(archived.entities.map(({ id }) => id)).toEqual([target]);
    expect(archived.edges).toEqual([]);
    await write(setEntityScope(project, source, item, false, contribute));
    expect((await write(readKnowledgeNote(project, source, from))).values.domain_scope).toEqual([]);
  });
});
