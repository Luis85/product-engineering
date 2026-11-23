// @vitest-environment happy-dom
import { Effect, Result } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { App, createTestPlugin } from "@test/obsidian";
import {
  domainEdges,
  resolveDomainScope,
  saveDomainEdge,
  setEntityArchived,
  setEntityScope,
} from "../../../../src/application/domain-model";
import { appServicesLayer } from "../../../../src/application/app-services-layer";
import { readKnowledgeNote } from "../../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { EventBus } from "../../../../src/application/shell";
import type { EntityEdge } from "../../../../src/domain/knowledge";
import { newNoteText } from "../../../../src/domain/notes";
import { notesAdapters } from "../../../../src/infrastructure/obsidian/notes";
import { makeRuntime } from "../../../../src/infrastructure/runtime";
import { testAdapters } from "../../../support/adapters";

vi.mock("obsidian", () => import("@test/obsidian"));

const project = "project-33333333-3333-4333-8333-000000000001";
const source = "knowledge-33333333-3333-4333-8333-000000000001";
const target = "knowledge-33333333-3333-4333-8333-000000000002";
const third = "knowledge-33333333-3333-4333-8333-000000000003";
const definition = "\nEine Organisation ist Vertragspartnerin.\n\n![[Bild.png]]\n";

function seededEntity(id: string, title: string, display_id: string, fields = {}) {
  return newNoteText(
    {
      schema: "product-engineering.knowledge/v1",
      id,
      project_id: project,
      title,
      kind: "entity",
      display_id,
      partner_metadata: "Keep",
      ...fields,
    },
    definition,
  );
}

const edge = {
  id: "REL-01",
  target,
  verb: "meldet",
  sourceCardinality: "1",
  targetCardinality: "0..*",
  rule: "Nur mit Freigabe.\nFrist: 24 Stunden.",
} as const;

it("round-trips an outgoing edge and named attributes through actual entity Markdown bytes", async () => {
  const app = new App();
  const { plugin } = createTestPlugin(class extends Plugin {}, { app });
  const layer = notesAdapters(plugin).noteStore;
  const file = await app.vault.seedFile(
    "Kundenportal/Organisation.md",
    seededEntity(source, "Organisation", "ENT-01"),
  );
  const attributes = [{ name: "Kundennummer", description: "Interne Referenz" }];
  const roundTrip = Effect.gen(function* () {
    const store = yield* NoteStore;
    yield* store.update(file.path, () =>
      Result.succeed({
        set: {
          domain_attributes: attributes,
          domain_edges: [edge],
        },
      }),
    );
    return yield* readKnowledgeNote(project, source, file.path);
  }).pipe(Effect.provide(layer));
  await expect(Effect.runPromise(roundTrip)).resolves.toMatchObject({
    displayId: "ENT-01",
    body: definition,
    frontmatter: { partner_metadata: "Keep" },
    values: { domain_attributes: attributes, domain_edges: [edge] },
  });
  const raw = await app.vault.read(file);
  expect(raw).toContain("domain_edges:");
  expect(raw).toContain("REL-01");
  expect(raw.endsWith(definition)).toBe(true);
});

async function withVault(
  test: (app: App, runtime: ReturnType<typeof makeRuntime>) => Promise<void>,
) {
  const app = new App();
  const { plugin } = createTestPlugin(class extends Plugin {}, { app });
  const { adapters } = testAdapters();
  const runtime = makeRuntime(
    appServicesLayer(
      { ...adapters, ...notesAdapters(plugin) },
      {
        language: "de",
        developmentMode: true,
      },
    ),
  );
  try {
    await test(app, runtime);
  } finally {
    await runtime.dispose();
  }
}

async function seedTransfer(
  app: App,
  runtime: ReturnType<typeof makeRuntime>,
  destinationEdges: readonly EntityEdge[] = [],
) {
  const from = await app.vault.seedFile(
    "Organisation.md",
    seededEntity(source, "Organisation", "ENT-01", { domain_edges: [edge] }),
  );
  const to = await app.vault.seedFile(
    "Servicefall.md",
    seededEntity(target, "Servicefall", "ENT-02"),
  );
  const next = await app.vault.seedFile(
    "Fachgruppe.md",
    seededEntity(third, "Fachgruppe", "ENT-03", { domain_edges: destinationEdges }),
  );
  await app.metadataCache.whenIndexed();
  await runtime.runPromise(EventBus.use((bus) => bus.publish({ _tag: "VaultReady" })));
  await runtime.runPromise(rebuildNoteIndex);
  return { from, to, next };
}

function refuseWrite(app: App, path: string) {
  const nativeProcess = app.vault.process.bind(app.vault);
  return vi.spyOn(app.vault, "process").mockImplementation((file, change) => {
    if (file.path === path) return Promise.reject(new Error("Refused entity write"));
    return nativeProcess(file, change);
  });
}

it("moves the persisted edge to a new source exactly once, retaining its ID across a failed write and retry", async () => {
  await withVault(async (app, runtime) => {
    const { from, next } = await seedTransfer(app, runtime);
    const move = saveDomainEdge(
      project,
      { ...edge, source: third, rule: "Updated" },
      { ...edge, source },
    );
    const process = refuseWrite(app, from.path);
    await expect(runtime.runPromise(move)).rejects.toMatchObject({ _tag: "NoteWriteError" });
    expect(await app.vault.read(from)).toContain("REL-01");

    process.mockRestore();
    await runtime.runPromise(move);
    await runtime.runPromise(move);
    const original = await runtime.runPromise(readKnowledgeNote(project, source, from.path));
    const moved = await runtime.runPromise(readKnowledgeNote(project, third, next.path));
    expect(original.values.domain_edges ?? []).toEqual([]);
    expect(moved.values.domain_edges).toEqual([
      expect.objectContaining({ ...edge, rule: "Updated" }),
    ]);
    expect(moved.body).toBe(definition);
  });
});

it("abandons a failed source transfer on an explicit unchanged save and never resurrects it after an external source deletion", async () => {
  await withVault(async (app, runtime) => {
    const unrelated = { ...edge, id: "REL-02", verb: "prüft" };
    const { from, to, next } = await seedTransfer(app, runtime, [unrelated]);
    const original = { ...edge, source } as const;
    const originalBytes = await app.vault.read(from);
    const refusal = refuseWrite(app, from.path);
    const move = saveDomainEdge(
      project,
      { ...original, source: third, verb: "übernimmt" },
      original,
    );
    await expect(runtime.runPromise(move)).rejects.toMatchObject({ _tag: "NoteWriteError" });
    refusal.mockRestore();
    const staged = await app.vault.read(next);
    expect(staged).toContain("movedFrom");
    await expect(runtime.runPromise(saveDomainEdge(project, original))).resolves.toEqual(original);
    expect(await app.vault.read(next)).toBe(staged);

    await expect(runtime.runPromise(saveDomainEdge(project, original, original))).resolves.toEqual(
      original,
    );
    expect(await app.vault.read(from)).toBe(originalBytes);
    expect(await app.vault.read(next)).not.toContain("REL-01");
    await app.vault.removeOutside(from.path);
    expect(app.vault.getFileByPath(from.path)).toBeNull();
    const targetNote = await runtime.runPromise(readKnowledgeNote(project, target, to.path));
    const destination = await runtime.runPromise(readKnowledgeNote(project, third, next.path));
    expect(domainEdges([targetNote, destination])).toEqual([{ ...unrelated, source: third }]);
    expect(destination.body).toBe(definition);
    expect(destination.frontmatter.partner_metadata).toBe("Keep");
  });
});

it("reports refused abandoned-stage cleanup and leaves unmarked relationship duplicates unchanged", async () => {
  await withVault(async (app, runtime) => {
    const { from, next } = await seedTransfer(app, runtime, [{ ...edge, movedFrom: source }]);
    const original = { ...edge, source } as const;
    const originalBytes = await app.vault.read(from);
    const staged = await app.vault.read(next);
    const writer = refuseWrite(app, next.path);
    await expect(
      runtime.runPromise(saveDomainEdge(project, original, original)),
    ).rejects.toMatchObject({
      _tag: "NoteWriteError",
    });
    writer.mockRestore();
    expect(await app.vault.read(from)).toBe(originalBytes);
    expect(await app.vault.read(next)).toBe(staged);

    await app.vault.seedFile(
      next.path,
      seededEntity(third, "Fachgruppe", "ENT-03", { domain_edges: [edge] }),
    );
    const unmarked = await app.vault.read(next);
    await expect(
      runtime.runPromise(saveDomainEdge(project, original, original)),
    ).rejects.toMatchObject({
      _tag: "DomainModelError",
      reason: "changed",
    });
    expect(await app.vault.read(from)).toBe(originalBytes);
    expect(await app.vault.read(next)).toBe(unmarked);
  });
});

it("archives and restores the same entity note, keeping its stable outgoing edges and rejecting an archived destination", async () => {
  await withVault(async (app, runtime) => {
    const from = await app.vault.seedFile(
      "Organisation.md",
      seededEntity(source, "Organisation", "ENT-01", { domain_edges: [edge] }),
    );
    await app.vault.seedFile("Servicefall.md", seededEntity(target, "Servicefall", "ENT-02"));
    await app.metadataCache.whenIndexed();
    await runtime.runPromise(EventBus.use((bus) => bus.publish({ _tag: "VaultReady" })));
    await runtime.runPromise(rebuildNoteIndex);
    const original = await runtime.runPromise(readKnowledgeNote(project, source, from.path));
    await runtime.runPromise(setEntityArchived(original, true));
    const archived = await runtime.runPromise(readKnowledgeNote(project, source, from.path));
    expect(archived).toMatchObject({
      id: source,
      displayId: "ENT-01",
      body: definition,
      values: { domain_archived: true, domain_edges: [edge] },
    });
    await expect(
      runtime.runPromise(
        saveDomainEdge(project, { ...edge, id: "REL-02", source: target, target: source }),
      ),
    ).rejects.toMatchObject({ _tag: "DomainModelError", reason: "entity" });
    await runtime.runPromise(setEntityArchived(archived, false));
    const restored = await runtime.runPromise(readKnowledgeNote(project, source, from.path));
    expect(restored.values.domain_archived).toBeFalsy();
    expect(restored.values.domain_edges).toEqual([edge]);
    expect(restored.path).toBe(archived.path);
  });
});

it("round-trips a PRD assignment and returns the incident relationship plus only its immediate external endpoint", async () => {
  await withVault(async (app, runtime) => {
    const prd = "knowledge-33333333-3333-4333-8333-000000000004";
    const reference = { kind: "prd", id: prd } as const;
    const from = await app.vault.seedFile(
      "Organisation.md",
      seededEntity(source, "Organisation", "ENT-01", {
        approval: "approved",
        domain_edges: [edge],
      }),
    );
    await app.vault.seedFile(
      "Servicefall.md",
      seededEntity(target, "Servicefall", "ENT-02", {
        domain_edges: [{ ...edge, id: "REL-02", target: third }],
        domain_attributes: [{ name: "Extern", description: "Nicht im Umfang" }],
      }),
    );
    await app.vault.seedFile("Aufgabe.md", seededEntity(third, "Aufgabe", "ENT-03"));
    await app.vault.seedFile(
      "PRD.md",
      seededEntity(prd, "Serviceprozess", "PRD-03", { kind: "prd" }),
    );
    await app.metadataCache.whenIndexed();
    await runtime.runPromise(EventBus.use((bus) => bus.publish({ _tag: "VaultReady" })));
    await runtime.runPromise(rebuildNoteIndex);
    const nativeProcess = app.vault.process.bind(app.vault);
    const concurrent = vi.spyOn(app.vault, "process").mockImplementation(async (file, change) => {
      await nativeProcess(file, (raw) =>
        raw.replace("partner_metadata: Keep", "partner_metadata: Outside"),
      );
      return nativeProcess(file, change);
    });
    await runtime.runPromise(setEntityScope(project, source, reference, true));
    concurrent.mockRestore();
    expect(await runtime.runPromise(readKnowledgeNote(project, source, from.path))).toMatchObject({
      body: definition,
      frontmatter: { partner_metadata: "Outside" },
      values: { approval: "draft", domain_scope: [reference], domain_edges: [edge] },
    });
    await nativeProcess(from, (raw) => raw.replace("approval: draft", "approval: approved"));
    const bytes = await app.vault.read(from);
    await runtime.runPromise(setEntityScope(project, source, reference, true));
    expect(await app.vault.read(from)).toBe(bytes);
    const scoped = await runtime.runPromise(resolveDomainScope(project, [reference]));
    expect(scoped).toMatchObject({
      entities: [{ id: source, definition, origins: [{ ...reference, title: "Serviceprozess" }] }],
      edges: [{ ...edge, source }],
    });
    expect(scoped.neighbors).toEqual([{ id: target, title: "Servicefall", displayId: "ENT-02" }]);
    await runtime.runPromise(setEntityScope(project, source, reference, false));
    expect(await app.vault.read(from)).toContain("approval: draft");
    expect(await runtime.runPromise(resolveDomainScope(project, [reference]))).toEqual({
      entities: [],
      edges: [],
      neighbors: [],
    });

    const converged = seededEntity(source, "Organisation", "ENT-01", {
      approval: "approved",
      domain_edges: [edge],
      domain_scope: [reference],
    });
    const outside = vi.spyOn(app.vault, "process").mockImplementation(async (file, change) => {
      await nativeProcess(file, () => converged);
      return nativeProcess(file, change);
    });
    await runtime.runPromise(setEntityScope(project, source, reference, true));
    outside.mockRestore();
    expect(await app.vault.read(from)).toBe(converged);
  });
});
