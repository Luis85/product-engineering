import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { confirmNfrImport, planNfrImport } from "../../../src/application/backlog/nfr/import";
import { nfrSnapshot } from "../../../src/application/backlog";
import {
  NoteNotFoundError,
  NoteStore,
  NoteWriteError,
  rebuildNoteIndex,
} from "../../../src/application/notes";
import { addProjectMember, createProject } from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";

const project = "project-33333333-3333-4333-8333-000000000001";
const foreign = "project-33333333-3333-4333-8333-000000000002";
const kim = "project-member-33333333-3333-4333-8333-000000000010";
const header = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien";
const source = `${header}\nIndex;"Mehr\nZeilen";Unter 1 s;Kim;performance-efficiency\nSchutz;Mandanten;Null Fremddaten;;27001:technological`;

async function fixture() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const customer = await run(
    createProject(project, {
      name: "Kundenportal",
      description: "Fälle",
      repository: "team/customer",
    }),
  );
  await run(
    createProject(foreign, { name: "Admin", description: "Rollen", repository: "team/admin" }),
  );
  await host.vaultReady();
  await run(rebuildNoteIndex);
  await run(addProjectMember(project, kim, { name: "Kim", role: "product-owner" }));
  const store = await run(NoteStore);
  return { ...host, run, customer, store };
}

it("binds validation to the current source and project and keeps conflicting CSV byte-identical", async () => {
  const { run, runtime, store, customer, notes } = await fixture();
  try {
    const original = customer.folder + "/Independent.md";
    await run(
      notes.seed(original, { title: "Independent", extra: ["keep"] }, "\n# Keep [[note]].\n"),
    );
    const before = await run(store.readContent(original));
    const plan = await run(planNfrImport(project, source));
    expect(plan.preview.rows.map(({ line, status }) => [line, status])).toEqual([
      [2, "new"],
      [4, "new"],
    ]);
    await expect(run(confirmNfrImport(foreign, source, plan))).rejects.toMatchObject({
      reason: "stale",
    });
    await expect(run(confirmNfrImport(project, source + "\n", plan))).rejects.toMatchObject({
      reason: "stale",
    });
    const conflictSource = source + "\nIndex;Andere Angaben;Unter 1 s;Kim;performance-efficiency";
    const conflict = await run(planNfrImport(project, conflictSource));
    expect(conflict.preview.issues).toEqual([{ line: 5, code: "conflict" }]);
    await expect(run(confirmNfrImport(project, conflictSource, conflict))).rejects.toMatchObject({
      reason: "stale",
    });
    const foreignPlan = await run(planNfrImport(foreign, source));
    expect(foreignPlan.preview.issues).toEqual([{ line: 2, code: "owner", value: "Kim" }]);
    expect(
      (await run(store.sources)).filter(
        ({ frontmatter }) => frontmatter.schema === "product-engineering.nfr/v1",
      ),
    ).toEqual([]);
    expect(await run(store.readContent(original))).toEqual(before);
  } finally {
    await runtime.dispose();
  }
});

it("recovers a partial native write with stable preview identities and keeps an outside edit across retry", async () => {
  const { run, runtime, store } = await fixture();
  try {
    const plan = await run(planNfrImport(project, source));
    expect(plan.identities.size).toBe(2);
    const partial = {
      ...store,
      create: (input: Parameters<typeof store.create>[0]) =>
        input.frontmatter.title === "Schutz"
          ? Effect.fail(new NoteWriteError())
          : store.create(input),
    };
    await expect(
      run(Effect.provideService(confirmNfrImport(project, source, plan), NoteStore, partial)),
    ).rejects.toMatchObject({ _tag: "NoteWriteError" });
    const notes = (await run(store.sources)).filter(
      ({ frontmatter }) => frontmatter.schema === "product-engineering.nfr/v1",
    );
    expect(notes.map(({ frontmatter }) => [frontmatter.id, frontmatter.title])).toEqual([
      [plan.identities.get(2), "Index"],
    ]);
    const first = notes[0];
    if (!first) throw new Error("Missing recovered note");
    const outside = await run(
      store.updateContent(first.path, () =>
        Result.succeed({
          patch: { set: { outside: ["keep", "these"] } },
          body: "\n# Outside edit\n",
        }),
      ),
    );
    expect(await run(confirmNfrImport(project, source, plan))).toEqual({
      state: "saved",
      created: 1,
      skipped: 1,
    });
    expect(await run(store.readContent(first.path))).toEqual(outside);
    expect(await run(confirmNfrImport(project, source, plan))).toEqual({
      state: "saved",
      created: 0,
      skipped: 2,
    });
    expect(
      (await run(store.sources))
        .filter(({ frontmatter }) => frontmatter.schema === "product-engineering.nfr/v1")
        .map(({ frontmatter }) => frontmatter.id)
        .toSorted(),
    ).toEqual([...plan.identities.values()].toSorted());
  } finally {
    await runtime.dispose();
  }
});

it("checks the live native Vault before confirmation and refuses a post-preview conflicting title", async () => {
  const { run, runtime, customer, store, notes } = await fixture();
  try {
    const plan = await run(planNfrImport(project, source));
    const path = customer.folder + "/NFRs/New from outside.md";
    await run(
      notes.seed(
        path,
        {
          schema: "product-engineering.nfr/v1",
          project_id: project,
          id: "nfr-33333333-3333-4333-8333-000000000100",
          title: "Schutz",
          requirement: "Outside criterion",
          acceptance: "Preserve me",
        },
        "\n# Working copy\n",
      ),
    );
    const before = await run(store.readContent(path));
    expect(await run(confirmNfrImport(project, source, plan))).toMatchObject({
      state: "changed",
      preview: { issues: [{ line: 4, code: "conflict" }] },
    });
    expect(
      (await run(store.sources))
        .filter(({ frontmatter }) => frontmatter.schema === "product-engineering.nfr/v1")
        .map(({ path: note }) => note),
    ).toEqual([path]);
    expect(await run(store.readContent(path))).toEqual(before);
  } finally {
    await runtime.dispose();
  }
});

it("keeps a damaged title blocked and requires a fresh preview when a skipped note disappears", async () => {
  const { run, runtime, customer, store, notes } = await fixture();
  try {
    const original = await run(planNfrImport(project, source));
    await run(confirmNfrImport(project, source, original));
    const index = (await run(store.sources)).find(
      ({ frontmatter }) => frontmatter.title === "Index",
    );
    if (!index) throw new Error("Missing stored criterion");
    const duplicate = await run(planNfrImport(project, source));
    expect(duplicate.preview.rows.map(({ status }) => status)).toEqual(["skip", "skip"]);
    await run(store.trash(index.path));
    expect(await run(confirmNfrImport(project, source, duplicate))).toMatchObject({
      state: "changed",
      preview: { rows: [{ status: "new" }, { status: "skip" }], issues: [] },
    });
    const broken = customer.folder + "/NFRs/Missing acceptance.md";
    await run(
      notes.seed(
        broken,
        {
          ...index.frontmatter,
          acceptance: null,
        },
        "# Repair this record.",
      ),
    );
    const invalid = await run(planNfrImport(project, source));
    expect(invalid.preview).toMatchObject({
      rows: [
        { line: 2, status: "invalid" },
        { line: 4, status: "skip" },
      ],
      issues: [{ line: 2, code: "conflict" }],
    });
    expect(invalid.identities.size).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("identifies duplicate and malformed NFR notes and rechecks a file moved since inventory", async () => {
  const { run, runtime, customer, store, notes } = await fixture();
  try {
    const nfrs = customer.folder + "/NFRs";
    const base = {
      id: "nfr-33333333-3333-4333-8333-000000000099",
      project_id: project,
      schema: "product-engineering.nfr/v1",
      title: "Schutz",
      requirement: "Mandanten",
      acceptance: "Null Fremddaten",
      categories: ["technological"],
    };
    const copied = nfrs + "/Accidental copy.md";
    const malformed = nfrs + "/Unusable.md";
    await run(notes.seed(nfrs + "/Schutz.md", base));
    await run(notes.seed(copied, base));
    await run(notes.seed(malformed, { ...base, id: "broken-id", title: 123 }));
    await run(notes.seed(nfrs + "/Ordinary note.md", {}, "# Independent Markdown"));
    await run(rebuildNoteIndex);
    const catalog = await run(nfrSnapshot(project));
    expect(catalog.records).toEqual([]);
    expect(catalog.invalid).toHaveLength(3);
    expect(catalog.invalid).toContainEqual({ path: malformed, label: malformed, id: undefined });
    const duplicate = await run(planNfrImport(project, source));
    expect(duplicate.preview.issues).toEqual([{ line: 4, code: "conflict" }]);
    const movingStore = {
      ...store,
      readFresh: (path: string) =>
        path === copied ? Effect.fail(new NoteNotFoundError()) : store.readFresh(path),
    };
    const rechecked = await run(
      Effect.provideService(planNfrImport(project, source), NoteStore, movingStore),
    );
    expect(rechecked.preview.rows.map(({ status }) => status)).toEqual(["new", "skip"]);
    expect((await run(store.readFresh(copied))).frontmatter).toEqual(base);
  } finally {
    await runtime.dispose();
  }
});
