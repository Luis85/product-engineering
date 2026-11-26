import { Effect, Result } from "effect";
import { expect, it, vi } from "vitest";
import { backlogDomainContribution, resolveBacklogItem } from "../../../src/application/backlog";
import { createBacklogItem } from "../../../src/application/backlog/creation";
import { readBacklogItem, saveBacklogItem } from "../../../src/application/backlog/edit";
import { moveBacklogItem, undoBacklogMove } from "../../../src/application/backlog/placement";
import { adoptBacklogItem, backlogSnapshot } from "../../../src/application/backlog/service";
import { NoteStore, NoteWriteError } from "../../../src/application/notes";
import {
  createProject,
  projectDetails,
  saveProjectDetails,
} from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";

const customer = "project-33333333-3333-4333-8333-000000000001";
const admin = "project-33333333-3333-4333-8333-000000000002";
const identity = (kind: string, number: number) => ({
  id: kind + "-" + String(number).padStart(2, "0"),
  record: "backlog-33333333-3333-4333-8333-" + String(number).padStart(12, "0"),
});
const creation = { epic: identity("EP", 1), feature: identity("FE", 2), item: identity("UC", 3) };

async function fixture() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const project = await run(
    createProject(customer, {
      name: "Kundenportal",
      description: "Serviceprozesse",
      repository: "team/kundenportal",
    }),
  );
  const other = await run(
    createProject(admin, {
      name: "Admin Console",
      description: "Rollen und Zugriffe",
      repository: "team/admin",
    }),
  );
  await host.vaultReady();
  return { ...host, run, project, other };
}

it("reads two existing Base notes, explicitly adopts one file and resolves its stable ID after a rename", async () => {
  const { run, runtime, notes, projectFiles, project, other } = await fixture();
  try {
    const folder = project.folder + "/Existing work";
    const first = folder + "/Export service cases.md";
    const second = folder + "/Find service cases.md";
    const a = {
      type: "PBI",
      order: 100,
      "pbl-id": 72,
      DeliveryState: "Active",
      private: ["keep", "these"],
    };
    const b = { type: "PBI", order: 200, DeliveryState: "Open" };
    await run(notes.seed(first, a, "## Protected body\n\nKeep [[other]]."));
    await run(notes.seed(second, b, "## Leave me untouched"));
    await run(notes.seed(other.folder + "/Other.md", { ...a, project_id: admin }));
    await run(notes.seed(folder + "/README.md", a));
    projectFiles.seedBacklog(`${project.folder}/Existing.base`, "# protected", {
      filters: { and: [`file.inFolder("${folder}")`, 'file.name != "README"'] },
      views: [
        {
          type: "product-backlog",
          homeFolder: folder,
          stateProperty: "note.DeliveryState",
          stateValues: "Open, Active, Done",
        },
      ],
    });
    await run(
      saveProjectDetails(project, { ...projectDetails(project), backlog_base: "Existing.base" }),
    );
    await vi.waitFor(async () => {
      const snapshot = await run(backlogSnapshot(customer));
      expect(snapshot.items.map(({ path, state }) => [path, state])).toEqual([
        [first, "Active"],
        [second, "Open"],
      ]);
    });
    expect(await run(NoteStore.use((store) => store.readFresh(first)))).toEqual({
      path: first,
      frontmatter: a,
    });
    const before = (await run(backlogSnapshot(customer))).items.find(({ path }) => path === first);
    if (!before) throw new Error("Missing source item");
    const adopted = await run(adoptBacklogItem(customer, before.key));
    expect(adopted.id).toMatch(/^UC-/);
    expect(await run(NoteStore.use((store) => store.readContent(first)))).toMatchObject({
      frontmatter: { ...a, "pe-id": adopted.id, project_id: customer },
      body: "## Protected body\n\nKeep [[other]].",
    });
    expect(await run(NoteStore.use((store) => store.readFresh(second)))).toEqual({
      path: second,
      frontmatter: b,
    });
    const rename = await run(NoteStore.use((store) => store.rename(first, "Renamed outside")));
    await vi.waitFor(async () => {
      const snapshot = await run(backlogSnapshot(customer));
      expect(snapshot.items.find(({ id }) => id === adopted.id)?.path).toBe(rename.path);
      expect(snapshot.items).toHaveLength(2);
    });
    expect(await run(resolveBacklogItem(customer, adopted.key))).toMatchObject({
      path: rename.path,
    });
  } finally {
    await runtime.dispose();
  }
});

it("reads and saves mapped fields and Markdown, keeping disjoint outside changes and rejecting a stale status", async () => {
  const { run, runtime, notes, project, projectFiles } = await fixture();
  try {
    const { folder } = project;
    const path = folder + "/Servicefälle verwalten.md";
    const parent = folder + "/Portal.md";
    await run(notes.seed(parent, { type: "Epic", "pe-id": "EP-01", order: 100 }));
    await run(
      notes.seed(
        path,
        {
          type: "Feature",
          parent: "[[Portal]]",
          "pe-id": "FE-01",
          order: 200,
          DeliveryState: "Open",
          Steward: "External contributor",
          private: "Sentinel",
        },
        "## Original",
      ),
    );
    projectFiles.seedBacklog(`${folder}/Legacy.base`, "# protected", {
      filters: `file.inFolder("${folder}")`,
      views: [
        {
          type: "product-backlog",
          stateProperty: "note.DeliveryState",
          assigneeProperty: "note.Steward",
          stateValues: "Open, Active, Done",
        },
      ],
    });
    await run(
      saveProjectDetails(project, { ...projectDetails(project), backlog_base: "Legacy.base" }),
    );
    await vi.waitFor(async () => {
      expect((await run(readBacklogItem(customer, "FE-01")))?.draft).toMatchObject({
        state: "Open",
        owner: "External contributor",
        body: "## Original",
      });
    });
    const original = await run(readBacklogItem(customer, "FE-01"));
    if (!original) throw new Error("Missing feature");
    const store = await run(NoteStore);
    await run(
      store.update(path, () =>
        Result.succeed({ set: { DeliveryState: "Done", private: "Preserve outside revision" } }),
      ),
    );
    await expect(
      run(saveBacklogItem(customer, original, { ...original.draft, state: "Active" })),
    ).rejects.toMatchObject({ reason: "conflict" });
    await run(
      saveBacklogItem(customer, original, {
        ...original.draft,
        body: "## Neue Beschreibung",
        owner: "",
      }),
    );
    const settled = await run(store.readContent(path));
    expect(settled.body).toBe("## Neue Beschreibung");
    expect(settled.frontmatter).toMatchObject({
      parent: "[[Portal]]",
      order: 200,
      DeliveryState: "Done",
      private: "Preserve outside revision",
    });
    expect(settled.frontmatter).not.toHaveProperty("Steward");
    expect(settled.frontmatter).not.toHaveProperty("status");
  } finally {
    await runtime.dispose();
  }
});

it("creates the first PBI and prerequisites once when the same save is retried after a failed write", async () => {
  const { run, runtime, project } = await fixture();
  try {
    await vi.waitFor(async () => expect((await run(backlogSnapshot(customer))).base).toBeDefined());
    expect((await run(backlogSnapshot(customer))).items).toEqual([]);
    const store = await run(NoteStore);
    const draft = {
      kind: "UC",
      title: "Übergabe starten",
      epicTitle: "Schichtwechsel",
      featureTitle: "Übergaben",
      parent: "",
      body: "\n## Problem\n",
      owner: "",
      state: "",
      priority: "",
    } as const;
    const partial = {
      ...store,
      create: (input: Parameters<typeof store.create>[0]) =>
        input.frontmatter.type === "Feature"
          ? Effect.fail(new NoteWriteError())
          : store.create(input),
    };
    await expect(
      run(Effect.provideService(createBacklogItem(customer, creation, draft), NoteStore, partial)),
    ).rejects.toMatchObject({ _tag: "NoteWriteError" });
    const seeded = (await run(store.sources)).filter(
      ({ path }) => path.startsWith(project.folder + "/") && path.endsWith(".md"),
    );
    expect(seeded.map(({ frontmatter }) => frontmatter.type)).toEqual([undefined, "Epic"]);
    const created = await run(createBacklogItem(customer, creation, draft));
    expect((await run(createBacklogItem(customer, creation, draft))).path).toBe(created.path);
    await vi.waitFor(async () => {
      const { items } = await run(backlogSnapshot(customer));
      expect(items.map(({ id, parent }) => [id, parent])).toEqual([
        ["EP-01", undefined],
        ["FE-02", "EP-01"],
        ["UC-03", "FE-02"],
      ]);
    });
    expect((await run(store.readContent(created.path))).frontmatter).toMatchObject({
      type: "PBI",
      status: "Backlog",
      "pe-id": "UC-03",
      parent: `[[${project.folder}/Übergaben]]`,
    });
  } finally {
    await runtime.dispose();
  }
});

it("moves within level, reparents only into the correct type and undoes only the project's last move", async () => {
  const { run, runtime, notes, project } = await fixture();
  try {
    const folder = project.folder;
    const seed = (name: string, type: string, itemId: string, order: number, parent?: string) =>
      run(
        notes.seed(`${folder}/${name}.md`, {
          project_id: customer,
          type,
          "pe-id": itemId,
          order,
          ...(parent && { parent: `[[${parent}]]` }),
        }),
      );
    await seed("Epic", "Epic", "EP-01", 100);
    await seed("First", "Feature", "FE-01", 200, "Epic");
    await seed("Second", "Feature", "FE-02", 300, "Epic");
    await seed("A", "PBI", "UC-01", 400, "First");
    await seed("B", "PBI", "UC-02", 500, "Second");
    await vi.waitFor(async () =>
      expect((await run(backlogSnapshot(customer))).items).toHaveLength(5),
    );
    const store = await run(NoteStore);
    const a = `${folder}/A.md`;
    await run(moveBacklogItem(customer, "UC-01", { target: "UC-02", zone: "after", level: "UC" }));
    const reordered = await run(store.readFresh(a));
    expect(reordered.frontmatter).toMatchObject({ parent: "[[First]]" });
    expect(reordered.frontmatter.order).toBeGreaterThan(500);
    await expect(
      run(moveBacklogItem(customer, "UC-01", { target: "EP-01", zone: "inside" })),
    ).rejects.toMatchObject({ reason: "parent" });
    expect(await run(store.readFresh(a))).toEqual(reordered);
    await run(moveBacklogItem(customer, "UC-01", { target: "FE-02", zone: "inside" }));
    expect((await run(store.readFresh(a))).frontmatter.parent).toBe(`[[${folder}/Second]]`);
    expect(await run(undoBacklogMove(admin))).toBe(false);
    await run(store.update(a, () => Result.succeed({ set: { sentinel: "external" } })));
    expect(await run(undoBacklogMove(customer))).toBe(true);
    expect((await run(store.readFresh(a))).frontmatter).toMatchObject({
      ...reordered.frontmatter,
      sentinel: "external",
    });
    expect((await run(store.readFresh(`${folder}/B.md`))).frontmatter.order).toBe(500);
  } finally {
    await runtime.dispose();
  }
});

it("validates the complete first-PBI plan and leaves the vault alone until its parent and configured fields are valid", async () => {
  const { run, runtime, notes, project } = await fixture();
  try {
    await vi.waitFor(async () => expect((await run(backlogSnapshot(customer))).base).toBeDefined());
    const draft = {
      kind: "UC",
      title: "Handoff",
      parent: "",
      epicTitle: "Service",
      featureTitle: "Planning",
      body: "",
      owner: "",
      state: "Review",
      priority: "P2",
    } as const;
    const invalid = [
      [{ ...draft, title: " " }, "title"],
      [{ ...draft, state: "No such state" }, "state"],
      [{ ...draft, priority: "P9" }, "priority"],
      [{ ...draft, owner: "Unknown member" }, "owner"],
      [{ ...draft, parent: "FE-99" }, "parent"],
      [{ ...draft, featureTitle: "" }, "parent"],
      [{ ...draft, epic: "EP-99" }, "parent"],
    ] as const;
    const checks = invalid.map(([values, reason]) =>
      expect(run(createBacklogItem(customer, creation, values))).rejects.toMatchObject({ reason }),
    );
    await Promise.all(checks);
    await expect(
      run(createBacklogItem(customer, { ...creation, item: identity("BUG", 3) }, draft)),
    ).rejects.toMatchObject({ reason: "identity" });
    expect((await run(backlogSnapshot(customer))).items).toEqual([]);
    const parent = project.folder + "/Existing service.md";
    await run(
      notes.seed(parent, { type: "Epic", project_id: customer, "pe-id": "EP-55", order: 200 }),
    );
    const item = await run(
      createBacklogItem(customer, creation, { ...draft, epic: "EP-55", epicTitle: "" }),
    );
    const store = await run(NoteStore);
    expect((await run(store.readFresh(item.path))).frontmatter).toMatchObject({
      status: "Review",
      priority: "P2",
    });
    await vi.waitFor(async () => {
      const records = (await run(backlogSnapshot(customer))).items;
      expect(records.map(({ id }) => id)).toEqual(["EP-55", "FE-02", "UC-03"]);
      expect(records.find(({ id }) => id === "FE-02")?.parent).toBe("EP-55");
    });
  } finally {
    await runtime.dispose();
  }
});

it("rejects a stale related rank and preserves a newer outside rank when undo is attempted", async () => {
  const { run, runtime, notes, project } = await fixture();
  try {
    await vi.waitFor(async () => expect((await run(backlogSnapshot(customer))).base).toBeDefined());
    const folder = project.folder;
    const paths = ["Parent", "First", "Second", "Third"].map((name) => `${folder}/${name}.md`);
    const [parent, first, second, third] = paths;
    if (!parent || !first || !second || !third) throw new Error("Missing fixture path");
    await run(
      notes.seed(parent, { type: "Epic", "pe-id": "EP-01", order: 100, project_id: customer }),
    );
    const siblings = [
      [first, "FE-01", 200],
      [second, "FE-02", 300],
      [third, "FE-03", 400],
    ] as const;
    await Promise.all(
      siblings.map(([path, id, order]) =>
        run(
          notes.seed(path, {
            type: "Feature",
            "pe-id": id,
            order,
            parent: "[[Parent]]",
            project_id: customer,
          }),
        ),
      ),
    );
    const store = await run(NoteStore);
    const scanned = await run(store.sources);
    await run(store.update(second, () => Result.succeed({ set: { order: 350 } })));
    const lagging = { ...store, sources: Effect.succeed(scanned) };
    await expect(
      run(
        Effect.provideService(
          moveBacklogItem(customer, "FE-01", { target: "FE-02", zone: "after" }),
          NoteStore,
          lagging,
        ),
      ),
    ).rejects.toMatchObject({ reason: "conflict" });
    expect((await run(store.readFresh(first))).frontmatter.order).toBe(200);
    await expect(
      run(moveBacklogItem(customer, "FE-01", { target: "FE-99", zone: "after" })),
    ).rejects.toMatchObject({ reason: "rank" });
    await run(moveBacklogItem(customer, "FE-01", { target: "FE-02", zone: "after" }));
    expect((await run(store.readFresh(first))).frontmatter.order).toBe(375);
    await run(store.update(first, () => Result.succeed({ set: { order: 600, external: "Keep" } })));
    await expect(run(undoBacklogMove(customer))).rejects.toMatchObject({ reason: "conflict" });
    expect((await run(store.readFresh(first))).frontmatter).toMatchObject({
      order: 600,
      external: "Keep",
    });
    expect((await run(store.readFresh(third))).frontmatter.order).toBe(400);
  } finally {
    await runtime.dispose();
  }
});

it("resolves the canonical ancestor and descendant scope without an unrelated sibling or another project", async () => {
  const { run, runtime, notes, project, other } = await fixture();
  try {
    const data = [
      [project, "Parent.md", "Epic", "EP", 1, ""],
      [project, "Left.md", "Feature", "FE", 2, "[[Parent]]"],
      [project, "Right.md", "Feature", "FE", 3, "[[Parent]]"],
      [project, "PBI.md", "PBI", "UC", 4, "[[Left]]"],
      [project, "Question.md", "Question", "Q", 5, "[[PBI]]"],
      [other, "Other epic.md", "Epic", "EP", 1, ""],
    ] as const;
    await Promise.all(
      data.map(([scope, name, type, kind, ordinal, parent]) => {
        const { id, record } = identity(kind, ordinal);
        const stable =
          scope.id === customer ? record : "backlog-33333333-3333-4333-8333-000000000099";
        return run(
          notes.seed(scope.folder + "/" + name, {
            schema: "product-engineering.backlog/v1",
            id: stable,
            type,
            "pe-id": id,
            project_id: scope.id,
            order: ordinal * 100,
            ...(parent && { parent }),
          }),
        );
      }),
    );
    await vi.waitFor(async () =>
      expect((await run(backlogSnapshot(customer))).items).toHaveLength(5),
    );
    const result = await run(backlogDomainContribution(customer, { kind: "item", id: "UC-04" }));
    expect(result?.source.title).toBe("PBI");
    expect(result?.origins?.map(({ id }) => id)).toEqual(["FE-02", "EP-01", "Q-05"]);
    expect(
      await run(backlogDomainContribution(admin, { kind: "item", id: "UC-04" })),
    ).toBeUndefined();
    expect(
      await run(backlogDomainContribution(customer, { kind: "map", id: "UC-04" })),
    ).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
});
