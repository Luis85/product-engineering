import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { appNoteTypes } from "../../../src/application/note-types";
import { noteSnapshot } from "../../../src/application/notes";
import {
  createProject,
  projectById,
  projectRecordRoute,
  resolveProjectReference,
  searchProjectRecords,
} from "../../../src/application/projects";
import type { ProjectReference, ProjectSearchRecord } from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";

const id = "project-33333333-3333-4333-8333-000000000001";
const path = "Produkte/Kundenportal/Project.md";
const fields = {
  name: "Kundenportal",
  description: "Serviceprozesse für B2B-Kunden",
  repository: "produktteam/kundenportal",
  branch: "main",
  backlog_base: "Kundenportal Backlog.base",
};

it("indexes a project registration at its actual vault path with no plugin settings", async () => {
  const fixture = testRuntime();
  try {
    await fixture.runtime.runPromise(
      fixture.notes.seed(path, { schema: "product-engineering.project/v1", id, ...fields }),
    );
    await fixture.vaultReady();
    const type = appNoteTypes.find((candidate) => candidate.type === "project");
    await vi.waitFor(async () => {
      const snapshot = type && (await fixture.runtime.runPromise(noteSnapshot(type)));
      expect(snapshot?.notes).toMatchObject([{ kind: "editable", path, id, values: fields }]);
    });
    await expect(fixture.runtime.runPromise(projectById(id))).resolves.toMatchObject({
      id,
      folder: "Produkte/Kundenportal",
      backlogBasePath: "Produkte/Kundenportal/Kundenportal Backlog.base",
    });
  } finally {
    await fixture.runtime.dispose();
  }
});

it("keeps overlapping display IDs and typed record links scoped to their own projects", () => {
  const first: ProjectReference = {
    projectId: id,
    kind: "knowledge",
    recordId: "prd-kundenportal",
  };
  const second: ProjectReference = {
    ...first,
    projectId: "project-33333333-3333-4333-8333-000000000002",
    recordId: "prd-admin",
  };
  const crossScope = { ...second, recordId: "accidental", route: projectRecordRoute(first) };
  const records: readonly ProjectSearchRecord[] = [
    {
      ...first,
      route: projectRecordRoute(first),
      displayId: "PRD-03",
      title: "Customer onboarding",
    },
    { ...second, route: projectRecordRoute(second), displayId: "PRD-03", title: "Role assignment" },
    { ...crossScope, displayId: "PRD-03", title: "Wrong route" },
  ];
  const sources = [() => records];
  expect(
    searchProjectRecords(first.projectId, "prd-03", sources).map(({ title }) => title),
  ).toEqual(["Customer onboarding"]);
  expect(
    searchProjectRecords(second.projectId, "PRD-03", sources).map(({ title }) => title),
  ).toEqual(["Role assignment"]);
  expect(resolveProjectReference(first, sources)?.route).toEqual(projectRecordRoute(first));
  expect(
    resolveProjectReference({ ...first, projectId: second.projectId }, sources),
  ).toBeUndefined();
  expect(resolveProjectReference(first, [...sources, ...sources])).toBeUndefined();
});

it("registers one durable project when the same creation is submitted twice", async () => {
  const fixture = testRuntime();
  try {
    const creation = createProject(id, fields);
    const attempts = await fixture.runtime.runPromise(
      Effect.all([creation, creation].map(Effect.result), { concurrency: "unbounded" }),
    );
    const expected = {
      id,
      name: fields.name,
      folder: "Product Engineering/Projects/Kundenportal",
      notePath: "Product Engineering/Projects/Kundenportal/Project.md",
      backlogBasePath: "Product Engineering/Projects/Kundenportal/Backlog.base",
    };
    expect(attempts).toMatchObject([
      { _tag: "Success", success: expected },
      { _tag: "Success", success: expected },
    ]);
    expect(fixture.notes.body(expected.notePath)).toBeDefined();
  } finally {
    await fixture.runtime.dispose();
  }
});

it("reuses its reserved folder when a project note write is retried", async () => {
  const fixture = testRuntime();
  try {
    fixture.notes.setFailWrites(true);
    await expect(fixture.runtime.runPromise(createProject(id, fields))).rejects.toMatchObject({
      _tag: "NoteWriteError",
    });
    fixture.notes.setFailWrites(false);
    await expect(fixture.runtime.runPromise(createProject(id, fields))).resolves.toMatchObject({
      id,
      folder: "Product Engineering/Projects/Kundenportal",
    });
  } finally {
    await fixture.runtime.dispose();
  }
});
