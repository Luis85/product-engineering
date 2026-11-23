import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { readKnowledgeNote, saveKnowledgeNote } from "../../../src/application/knowledge";
import { NoteStore } from "../../../src/application/notes";
import { testRuntime } from "../../support/runtime";

const id = "knowledge-33333333-3333-4333-8333-000000000005";
const projectId = "project-33333333-3333-4333-8333-000000000001";
const otherProject = "project-33333333-3333-4333-8333-000000000002";
const path = "Projects/Kundenportal/JOB-12.md";
const props = {
  schema: "product-engineering.knowledge/v1",
  id,
  project_id: projectId,
  title: "Servicefälle übergeben",
  kind: "jtbd",
  display_id: "JOB-12",
  approval: "draft",
};
const body = "## Übergabe\n";

async function withNote(test: (host: ReturnType<typeof testRuntime>) => Promise<void>) {
  const host = testRuntime({ language: "en" });
  try {
    await host.runtime.runPromise(host.notes.seed(path, props, body));
    await test(host);
  } finally {
    await host.runtime.dispose();
  }
}

it("rejects out-of-scope reads, invalid reference lines and departed owners before writing", async () => {
  await withNote(async ({ runtime }) => {
    await expect(
      runtime.runPromise(readKnowledgeNote(otherProject, id, path)),
    ).rejects.toMatchObject({
      _tag: "NoteNotFoundError",
    });
    const current = await runtime.runPromise(readKnowledgeNote(projectId, id, path));
    await expect(
      runtime.runPromise(saveKnowledgeNote(current, "Draft", { references: ["Two\nlines"] })),
    ).rejects.toMatchObject({ _tag: "KnowledgeEditError", reason: "references" });
    await expect(
      runtime.runPromise(
        saveKnowledgeNote(current, "Draft", {
          owner_id: "project-member-33333333-3333-4333-8333-000000000003",
        }),
      ),
    ).rejects.toMatchObject({ _tag: "KnowledgeEditError", reason: "owner_id" });
    expect(
      await runtime.runPromise(NoteStore.use((store) => store.readContent(path))),
    ).toMatchObject({
      frontmatter: props,
      body,
    });
  });
});

it("retains a disjoint outside body when only metadata is edited and accepts a converging body write", async () => {
  await withNote(async ({ runtime, notes }) => {
    const current = await runtime.runPromise(readKnowledgeNote(projectId, id, path));
    const outside = "Outside body";
    await runtime.runPromise(notes.seed(path, { ...props, extra: "Keep" }, outside));
    const metadata = await runtime.runPromise(
      saveKnowledgeNote(current, current.body, { approval: "approved" }),
    );
    expect(metadata.body).toBe(outside);
    expect(metadata.frontmatter).toMatchObject({ approval: "approved", extra: "Keep" });
    const bodyOnly = await runtime.runPromise(saveKnowledgeNote(current, outside, {}));
    expect(bodyOnly.body).toBe(outside);
    expect(bodyOnly.frontmatter).toMatchObject({ approval: "approved", extra: "Keep" });
  });
});

it("leaves a replacement file unchanged when its project reassigned the note after opening", async () => {
  await withNote(async ({ runtime, notes }) => {
    const current = await runtime.runPromise(readKnowledgeNote(projectId, id, path));
    await runtime.runPromise(notes.seed(path, { ...props, project_id: otherProject }, body));
    await expect(
      runtime.runPromise(saveKnowledgeNote(current, "New draft", {})),
    ).rejects.toMatchObject({
      _tag: "NoteWriteRefusedError",
      reason: "identity",
    });
    expect(
      await runtime.runPromise(NoteStore.use((store) => store.readContent(path))),
    ).toMatchObject({
      frontmatter: { project_id: otherProject },
      body,
    });
  });
});

it("refuses a body write before mutation when an outside edit removed required note metadata", async () => {
  await withNote(async ({ runtime, notes }) => {
    const current = await runtime.runPromise(readKnowledgeNote(projectId, id, path));
    await runtime.runPromise(notes.seed(path, { ...props, title: undefined }, body));
    const write = await runtime.runPromise(
      saveKnowledgeNote(current, "New draft", {}).pipe(Effect.result),
    );
    expect(notes.body(path)).toBe(body);
    expect(Result.isFailure(write) && write.failure).toMatchObject({
      _tag: "NoteWriteRefusedError",
    });
  });
});
