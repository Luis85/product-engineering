import { Result } from "effect";
import { expect, it, vi } from "vitest";
import {
  backlogSnapshot,
  moveBacklogItem,
  readBacklogItem,
  saveBacklogItem,
  undoBacklogMove,
} from "../../../src/application/backlog";
import { NoteStore } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";

const projectId = "project-33333333-3333-4333-8333-000000000001";
const otherProject = "project-33333333-3333-4333-8333-000000000002";

async function withHierarchy(
  test: (fixture: Awaited<ReturnType<typeof hierarchy>>) => Promise<void>,
) {
  const setup = await hierarchy();
  try {
    await test(setup);
  } finally {
    await setup.host.runtime.dispose();
  }
}

async function hierarchy() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const project = await run(
    createProject(projectId, {
      name: "Kundenportal",
      description: "Serviceprozesse",
      repository: "team/kundenportal",
    }),
  );
  const rows = [
    ["First epic", "Epic", "EP-01", 1000, ""],
    ["Second epic", "Epic", "EP-02", 5000, ""],
    ["Moving feature", "Feature", "FE-01", 2000, "First epic"],
    ["First sibling", "Feature", "FE-02", 3000, "First epic"],
    ["Last feature", "Feature", "FE-03", 7000, "Second epic"],
  ] as const;
  await Promise.all(
    rows.map(([name, type, id, order, parent]) =>
      run(
        host.notes.seed(
          project.folder + "/" + name + ".md",
          {
            project_id: projectId,
            type,
            "pe-id": id,
            order,
            ...(parent && { parent: "[[" + parent + "]]" }),
            sentinel: "Preserve metadata",
          },
          "\n## Preserve body\n",
        ),
      ),
    ),
  );
  await host.vaultReady();
  await vi.waitFor(async () =>
    expect((await run(backlogSnapshot(projectId))).items).toHaveLength(5),
  );
  const store = await run(NoteStore);
  const edited = await run(readBacklogItem(projectId, "FE-01"));
  return { host, run, store, edited, project, destination: project.folder + "/Last feature.md" };
}

it("appends a keyboard reparent to the same destination rank as drag-inside and undoes both fields", async () => {
  await withHierarchy(async ({ run, store, edited, project, destination }) => {
    const before = await run(store.readContent(edited.item.path));
    const peer = await run(store.readContent(destination));
    const draft = { ...edited.draft, parent: "EP-02" };
    const keyboard = await run(saveBacklogItem(projectId, edited, draft));

    expect(keyboard.frontmatter.parent).toBe(`[[${project.folder}/Second epic]]`);
    expect(keyboard.frontmatter.order).toBeGreaterThan(7000);
    expect(keyboard.body).toBe(before.body);
    expect(await run(store.readContent(destination))).toEqual(peer);
    expect(await run(undoBacklogMove(otherProject))).toBe(false);
    await run(
      store.update(edited.item.path, () =>
        Result.succeed({ set: { outside: "Keep newer value" } }),
      ),
    );
    expect(await run(undoBacklogMove(projectId))).toBe(true);
    expect((await run(store.readFresh(edited.item.path))).frontmatter).toEqual({
      ...before.frontmatter,
      outside: "Keep newer value",
    });
    await run(moveBacklogItem(projectId, "FE-01", { target: "EP-02", zone: "inside" }));
    expect((await run(store.readFresh(edited.item.path))).frontmatter.order).toBe(
      keyboard.frontmatter.order,
    );
  });
});

it("rejects a rank target outside the chosen parent when the previous list level is focused", async () => {
  await withHierarchy(async ({ run, store, edited }) => {
    const before = await run(store.readContent(edited.item.path));
    await expect(
      run(
        saveBacklogItem(
          projectId,
          edited,
          { ...edited.draft, parent: "EP-02" },
          {
            target: "FE-02",
            zone: "before",
            level: "FE",
          },
        ),
      ),
    ).rejects.toMatchObject({ reason: "rank" });
    expect(await run(store.readContent(edited.item.path))).toEqual(before);
    expect(await run(undoBacklogMove(projectId))).toBe(false);
  });
});
