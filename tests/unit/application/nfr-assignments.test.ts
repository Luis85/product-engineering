import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  nfrSnapshot,
  nfrTargets,
  resolveNfrScope,
  saveNfr,
  setTargetNfrs,
} from "../../../src/application/backlog";
import type { NfrMapContributor } from "../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import { schemaMarker } from "../../../src/domain/notes";
import type { NfrId, NfrTarget } from "../../../src/domain/backlog";
import { testRuntime } from "../../support/runtime";

const customer = "project-33333333-3333-4333-8333-000000000001";
const admin = "project-33333333-3333-4333-8333-000000000002";
const first: NfrId = "nfr-33333333-3333-4333-8333-000000000001";
const second: NfrId = "nfr-33333333-3333-4333-8333-000000000002";
const missing: NfrId = "nfr-33333333-3333-4333-8333-000000000099";
const pbi: NfrTarget = { kind: "item", id: "UC-09" };
const missingTarget: NfrTarget = { kind: "item", id: "FE-404" };
const map: NfrTarget = { kind: "map", id: "SM-01" };
const draft = {
  title: "Sicherer Zugriff",
  requirement: "Ein isolierter Mandant.",
  acceptance: "0 Zeilen aus fremden Mandanten.",
  categories: ["security"],
} as const;
const maps: NfrMapContributor = () =>
  Effect.succeed([
    { projectId: customer, id: map.id, title: "Kundenportal", links: [] },
    { projectId: admin, id: "SM-OTHER", title: "Admin", links: [] },
  ] as const);

async function setup() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const project = await run(
    createProject(customer, {
      name: "Kundenportal",
      description: "Fälle",
      repository: "team/customer",
    }),
  );
  const remote = await run(
    createProject(admin, {
      name: "Admin",
      description: "Rollen",
      repository: "team/admin",
    }),
  );
  await host.vaultReady();
  const pbiPath = project.folder + "/PBI.md";
  await run(
    host.notes.seed(pbiPath, {
      schema: schemaMarker("backlog", 1),
      id: "backlog-33333333-3333-4333-8333-000000000003",
      project_id: customer,
      "pe-id": pbi.id,
      type: "PBI",
    }),
  );
  const path = project.folder + "/NFRs/Renamable.md";
  const other = project.folder + "/NFRs/Second.md";
  const foreign = remote.folder + "/NFRs/Separate.md";
  const seed = (
    file: string,
    id: NfrId,
    project_id: typeof customer | typeof admin,
    targets: readonly NfrTarget[],
  ) =>
    host.notes.seed(
      file,
      {
        schema: schemaMarker("nfr", 1),
        id,
        ...draft,
        project_id,
        targets,
        extra: ["outside"],
        ...(id === second && { title: "Zweite Regel" }),
      },
      "\n# Existing body with [[Links]]\n",
    );
  await run(seed(path, first, customer, [map, missingTarget]));
  await run(seed(other, second, customer, []));
  await run(seed(foreign, missing, admin, []));
  await run(rebuildNoteIndex);
  const store = await run(NoteStore);
  return { run, runtime: host.runtime, path, other, foreign, store, pbiPath };
}

it("validates the whole reciprocal selection, deduplicates it and leaves all unrelated records and fields intact", async () => {
  const { run, runtime, store, path, other, foreign } = await setup();
  try {
    const own = await run(store.readContent(path));
    const secondBefore = await run(store.readContent(other));
    const foreignBefore = await run(store.readContent(foreign));
    await expect(run(setTargetNfrs(customer, pbi, [first, missing], maps))).rejects.toMatchObject({
      reason: "target",
    });
    expect(await run(store.readContent(path))).toEqual(own);
    expect(await run(store.readContent(other))).toEqual(secondBefore);
    expect(await run(store.readContent(foreign))).toEqual(foreignBefore);
    await run(setTargetNfrs(customer, pbi, [first, second, first], maps));
    const assigned = await run(store.readContent(path));
    expect(assigned).toMatchObject({
      body: own.body,
      frontmatter: { ...own.frontmatter, targets: [map, missingTarget, pbi] },
    });
    expect((await run(store.readFresh(other))).frontmatter.targets).toEqual([pbi]);
    await run(setTargetNfrs(customer, pbi, [second, first], maps));
    expect(await run(store.readContent(path))).toEqual(assigned);
    await run(setTargetNfrs(customer, pbi, [second], maps));
    expect((await run(store.readFresh(path))).frontmatter.targets).toEqual([map, missingTarget]);
    await expect(run(setTargetNfrs(admin, pbi, [missing], maps))).rejects.toMatchObject({
      reason: "target",
    });
    expect(await run(store.readContent(foreign))).toEqual(foreignBefore);
  } finally {
    await runtime.dispose();
  }
});

it("keeps missing targets repairable and edits the same record across an outside rename", async () => {
  const { run, runtime, store, path } = await setup();
  try {
    const base = (await run(nfrSnapshot(customer))).records.find(({ id }) => id === first);
    if (!base) throw new Error("Missing indexed seed");
    const renamed = await run(store.rename(path, "Outside rename"));
    const outside = await run(
      store.updateContent(renamed.path, () =>
        Result.succeed({
          patch: { set: { outside: "keep" } },
          body: "\n# Outside body\n",
        }),
      ),
    );
    await expect(
      run(saveNfr(customer, first, draft, [map, missingTarget, pbi], base, maps)),
    ).rejects.toMatchObject({ reason: "target" });
    await expect(
      run(saveNfr(customer, first, draft, [map, { kind: "map", id: "SM-OTHER" }], base, maps)),
    ).rejects.toMatchObject({ reason: "target" });
    expect(await run(store.readContent(renamed.path))).toEqual(outside);
    await run(
      saveNfr(customer, first, { ...draft, title: "Repariert" }, [map, pbi, pbi], base, maps),
    );
    const after = await run(store.readContent(renamed.path));
    expect(after).toMatchObject({
      body: outside.body,
      frontmatter: {
        ...outside.frontmatter,
        title: "Repariert",
        targets: [map, pbi],
      },
    });
    await run(rebuildNoteIndex);
    expect((await run(nfrSnapshot(customer))).records.find(({ id }) => id === first)).toMatchObject(
      {
        title: "Repariert",
        path: renamed.path,
        targets: [map, pbi],
      },
    );
  } finally {
    await runtime.dispose();
  }
});

it("accepts only current choices, retries one creation, and rejects missing and reassigned identities", async () => {
  const { run, runtime, store, path } = await setup();
  try {
    const record = (await run(nfrSnapshot(customer))).records.find(({ id }) => id === first);
    if (!record) throw new Error("Missing indexed NFR");
    const current = await run(store.readContent(path));
    await expect(run(saveNfr(admin, first, draft, [], record))).rejects.toMatchObject({
      reason: "scope",
    });
    await expect(
      run(saveNfr(customer, first, { ...draft, acceptance: "\n " }, [], record)),
    ).rejects.toMatchObject({ reason: "fields" });
    const unavailableMember = "project-member-33333333-3333-4333-8333-000000000099";
    await expect(
      run(saveNfr(customer, first, { ...draft, owner_id: unavailableMember }, [], record)),
    ).rejects.toMatchObject({ reason: "owner" });
    await expect(
      run(saveNfr(customer, first, { ...draft, title: "Zweite Regel" }, [], record)),
    ).rejects.toMatchObject({ reason: "conflict" });
    expect(await run(store.readContent(path))).toEqual(current);
    const creation: NfrId = "nfr-33333333-3333-4333-8333-000000000088";
    const latest = { ...draft, title: "Neue Regel", categories: [] };
    const stored = await run(saveNfr(customer, creation, latest, [pbi, pbi]));
    expect((await run(saveNfr(customer, creation, latest, [pbi]))).path).toBe(stored.path);
    await expect(
      run(saveNfr(customer, creation, { ...latest, requirement: "Other input" }, [pbi])),
    ).rejects.toMatchObject({ reason: "identity" });
    const options = await run(nfrTargets(customer, maps));
    expect(options.map(({ kind, id }) => [kind, id])).toEqual([
      ["item", "UC-09"],
      ["map", "SM-01"],
    ]);
    await run(rebuildNoteIndex);
    expect((await run(resolveNfrScope(customer, pbi, maps))).map(({ id }) => id)).toEqual([
      creation,
    ]);
    await run(store.trash(path));
    await expect(
      run(saveNfr(customer, first, draft, record.targets, record, maps)),
    ).rejects.toMatchObject({ reason: "missing" });
  } finally {
    await runtime.dispose();
  }
});

it("merges disjoint outside writes and checks the current target and note identity inside native callbacks", async () => {
  const { run, runtime, store, path, pbiPath } = await setup();
  try {
    const record = (await run(nfrSnapshot(customer))).records.find(({ id }) => id === first);
    if (!record) throw new Error("Missing indexed NFR");
    await run(
      store.updateContent(path, () =>
        Result.succeed({
          patch: { set: { acceptance: "Externes Kriterium", unrelated: true } },
        }),
      ),
    );
    await expect(
      run(
        saveNfr(
          customer,
          first,
          { ...draft, acceptance: "Eigener Entwurf" },
          record.targets,
          record,
          maps,
        ),
      ),
    ).rejects.toMatchObject({ _tag: "NoteEditConflictError" });
    const updated = await run(
      saveNfr(customer, first, { ...draft, title: "Nur Titel" }, record.targets, record),
    );
    expect(updated.frontmatter).toMatchObject({
      title: "Nur Titel",
      acceptance: "Externes Kriterium",
      unrelated: true,
      targets: [map, missingTarget],
    });
    const movedTarget = {
      ...store,
      readFresh: (file: string) =>
        Effect.map(store.readFresh(file), (note) =>
          file === pbiPath
            ? { ...note, frontmatter: { ...note.frontmatter, project_id: admin } }
            : note,
        ),
    };
    await expect(
      run(Effect.provideService(setTargetNfrs(customer, pbi, [first]), NoteStore, movedTarget)),
    ).rejects.toMatchObject({ reason: "target" });
    const changedDuringWrite = {
      ...store,
      updateContent: <E>(file: string, change: Parameters<typeof store.updateContent<E>>[1]) =>
        store.updateContent(file, (current) =>
          change({ ...current, frontmatter: { ...current.frontmatter, project_id: admin } }),
        ),
    };
    await expect(
      run(
        Effect.provideService(setTargetNfrs(customer, pbi, [first]), NoteStore, changedDuringWrite),
      ),
    ).rejects.toMatchObject({ reason: "identity" });
    expect(await run(store.readFresh(path))).toMatchObject({
      frontmatter: { ...updated.frontmatter },
    });
  } finally {
    await runtime.dispose();
  }
});
