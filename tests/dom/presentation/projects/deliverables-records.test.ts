import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  deliverableBacklinks,
  deliverableNote,
  deliverablesSnapshot,
  prepareDeliverableNote,
  saveDeliverable,
  setDeliverableStatus,
} from "../../../../src/application/backlog";
import { createKnowledge, resolveKnowledgeNote } from "../../../../src/application/knowledge";
import { NoteStore, NoteWriteError, rebuildNoteIndex } from "../../../../src/application/notes";
import type { FrontmatterChange } from "../../../../src/application/notes";
import { addProjectMember, createProject } from "../../../../src/application/projects";
import type { DeliverableDraft, DeliverableStatus } from "../../../../src/domain/backlog";
import { first, second, seedFoundations, vision, withProject } from "./knowledge-fixture";

const a = "deliverable-33333333-3333-4333-8333-000000000091";
const b = "deliverable-33333333-3333-4333-8333-000000000092";
const knowledge = "knowledge-33333333-3333-4333-8333-000000000093";
const different = "knowledge-33333333-3333-4333-8333-000000000094";
const foreign = "project-member-33333333-3333-4333-8333-000000000095";
const draft = {
  title: "Betriebshandbuch",
  outcome: "Der Bereitschaftsdienst kann den Ablauf nachvollziehen.",
  status: "planned",
} satisfies DeliverableDraft;

const createSecond = createProject(second, {
  name: "Admin Console",
  description: "Rollen und Zugriffe verwalten",
  repository: "produktteam/admin-console",
});

function fixture<A>(value: A | undefined, label: string): A {
  if (!value) throw new Error("Missing fixture " + label);
  return value;
}

it("validates creation, starts in planned and allocates independent stable display IDs", async () => {
  await withProject(async ({ host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await run(createSecond);
    await run(addProjectMember(second, foreign, { name: "Admin Team", role: "product-owner" }));
    expect((await run(deliverablesSnapshot(first))).records).toEqual([]);
    const errors = [
      [{ ...draft, title: " " }, "fields"],
      [{ ...draft, outcome: "   " }, "fields"],
      [{ ...draft, due: "2027-02-29" }, "fields"],
      [{ ...draft, template: "unknown" }, "template"],
      [{ ...draft, owner_id: foreign }, "owner"],
      [{ ...draft, knowledge_id: vision }, "link"],
    ] as const;
    await Promise.all(
      errors.map(([bad, reason]) =>
        expect(run(saveDeliverable(first, a, bad))).rejects.toMatchObject({ reason }),
      ),
    );
    await expect(run(saveDeliverable(first, "deliverable-invalid", draft))).rejects.toMatchObject({
      reason: "identity",
    });
    expect((await run(deliverablesSnapshot(first))).records).toEqual([]);
    const input = {
      ...draft,
      title: " Betriebshandbuch ",
      due: "2028-02-29",
      status: "done",
    } as const;
    expect(await run(saveDeliverable(first, a, input))).toEqual({ id: a, displayId: "DEL-01" });
    expect(await run(saveDeliverable(first, a, input))).toEqual({ id: a, displayId: "DEL-01" });
    await expect(
      run(saveDeliverable(first, a, { ...draft, outcome: "Different" })),
    ).rejects.toMatchObject({
      reason: "identity",
    });
    await expect(run(saveDeliverable(second, a, draft))).rejects.toMatchObject({
      reason: "identity",
    });
    expect(await run(saveDeliverable(second, b, { ...draft, owner_id: foreign }))).toEqual({
      id: b,
      displayId: "DEL-01",
    });
    await run(rebuildNoteIndex);
    const records = (await run(deliverablesSnapshot(first))).records;
    expect(records.map(({ id, displayId, values }) => ({ id, displayId, values }))).toEqual([
      {
        id: a,
        displayId: "DEL-01",
        values: {
          ...draft,
          project_id: first,
          display_id: "DEL-01",
          due: "2028-02-29",
          status: "planned",
        },
      },
    ]);
    expect((await run(deliverablesSnapshot(second))).records.map(({ id }) => id)).toEqual([b]);
  });
});

it("merges unrelated outside edits and leaves a missing relationship editable until explicitly cleared", async () => {
  await withProject(async ({ host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seedFoundations(host);
    await run(rebuildNoteIndex);
    const values = { ...draft, template: "vision", knowledge_id: vision } as const;
    await run(saveDeliverable(first, a, values));
    await run(saveDeliverable(first, b, values));
    await run(rebuildNoteIndex);
    const { records } = await run(deliverablesSnapshot(first));
    const base = fixture(records[0], "deliverable");
    const note = fixture(await run(resolveKnowledgeNote(first, vision)), "vision");
    expect(deliverableNote(base, [note])).toBe(note);
    expect(deliverableBacklinks(note, records, [note]).map(({ id }) => id)).toEqual([a, b]);
    expect(deliverableBacklinks({ ...note, projectId: second }, records, [note])).toEqual([]);
    await expect(run(saveDeliverable(second, a, values, base))).rejects.toMatchObject({
      reason: "scope",
    });
    await expect(
      run(saveDeliverable(first, a, { ...values, template: "prd" }, base)),
    ).rejects.toMatchObject({
      reason: "link",
    });
    const store = await run(NoteStore);
    await run(
      store.updateContent(base.path, () =>
        Result.succeed({
          patch: { set: { external_value: "keep me", status: "in-review" } },
          body: "\nExternal Markdown.\n",
        }),
      ),
    );
    await run(store.trash(note.path));
    await run(rebuildNoteIndex);
    await run(saveDeliverable(first, a, { ...values, title: "Revised output" }, base));
    const persisted = await run(store.readContent(base.path));
    expect(persisted.frontmatter).toMatchObject({
      external_value: "keep me",
      status: "in-review",
      knowledge_id: vision,
      title: "Revised output",
    });
    expect(persisted.body).toContain("External Markdown.");
    await run(rebuildNoteIndex);
    const updated = fixture((await run(deliverablesSnapshot(first))).records[0], "deliverable");
    await expect(
      run(saveDeliverable(first, a, { ...values, title: "Conflict" }, base)),
    ).rejects.toMatchObject({
      _tag: "NoteEditConflictError",
    });
    await run(saveDeliverable(first, a, { ...draft, title: updated.values.title }, updated));
    expect((await run(store.readFresh(base.path))).frontmatter).not.toHaveProperty("knowledge_id");
    await run(store.trash(base.path));
    await expect(run(saveDeliverable(first, a, values, updated))).rejects.toMatchObject({
      reason: "missing",
    });
  });
});

it("keeps the prepared relationship through a final write refusal and resumes with the original note", async () => {
  await withProject(async ({ host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const values = { ...draft, template: "operations-concept" } as const;
    await run(saveDeliverable(first, a, values));
    await run(rebuildNoteIndex);
    const base = fixture((await run(deliverablesSnapshot(first))).records[0], "deliverable");
    const origin = { kind: "deliverable", recordId: a, projectId: first } as const;
    const request = { projectId: first, id: knowledge, origin } as const;
    const content = {
      kind: "operations-concept",
      title: "Betrieb",
      actor_type: "",
      owner_id: "",
      vision_id: "",
      job_ids: [],
    } as const;
    await expect(run(createKnowledge(request, content))).rejects.toMatchObject({
      reason: "origin",
    });
    await expect(
      run(prepareDeliverableNote(base, { ...request, projectId: second }, content)),
    ).rejects.toMatchObject({ reason: "scope" });
    await expect(
      run(prepareDeliverableNote(base, request, { ...content, kind: "prd" })),
    ).rejects.toMatchObject({ reason: "template" });
    const store = await run(NoteStore);
    const refusing: NoteStore["Service"] = {
      ...store,
      update: <E>(path: string, change: FrontmatterChange<E>) =>
        store.update<E | NoteWriteError>(path, (fields) => {
          const updated = change(fields);
          return Result.isSuccess(updated) && updated.success.set?.knowledge_id === knowledge
            ? Result.fail(new NoteWriteError())
            : updated;
        }),
    };
    await expect(
      run(
        Effect.provideService(prepareDeliverableNote(base, request, content), NoteStore, refusing),
      ),
    ).rejects.toMatchObject({ _tag: "NoteWriteError" });
    await run(rebuildNoteIndex);
    const reserved = fixture((await run(deliverablesSnapshot(first))).records[0], "reservation");
    const note = fixture(await run(resolveKnowledgeNote(first, knowledge)), "prepared note");
    expect(reserved.values.pending_knowledge_id).toBe(knowledge);
    expect(reserved.values.knowledge_id).toBeUndefined();
    expect(deliverableNote(reserved, [note])).toBe(note);
    expect(deliverableNote(reserved, [{ ...note, values: {} }])).toBeUndefined();
    await expect(
      run(saveDeliverable(first, a, { ...draft, template: "prd" }, reserved)),
    ).rejects.toMatchObject({ reason: "pending" });
    await run(
      store.updateContent(note.path, () =>
        Result.succeed({
          patch: { set: { external_term: "durable" } },
          body: "\nKeep this addition.\n",
        }),
      ),
    );
    const final = await run(
      prepareDeliverableNote(reserved, { ...request, id: different }, content),
    );
    expect(final.frontmatter).toMatchObject({
      id: knowledge,
      display_id: "OPS-01",
      external_term: "durable",
    });
    const persisted = await run(store.readFresh(base.path));
    expect(persisted.frontmatter.knowledge_id).toBe(knowledge);
    expect(persisted.frontmatter).not.toHaveProperty("pending_knowledge_id");
    expect(await run(prepareDeliverableNote(base, request, content))).toEqual(final);
    expect((await run(store.readContent(note.path))).body).toContain("Keep this addition.");
    expect(
      (await run(store.list)).filter(({ frontmatter }) => frontmatter.deliverable_id === a),
    ).toHaveLength(1);
  });
});

it("refuses stale handoff identities and leaves a concurrently changed link intact", async () => {
  await withProject(async ({ host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seedFoundations(host);
    await run(rebuildNoteIndex);
    await expect(run(saveDeliverable(second, b, draft))).rejects.toMatchObject({ reason: "scope" });
    await run(saveDeliverable(first, a, draft));
    await run(rebuildNoteIndex);
    const base = fixture((await run(deliverablesSnapshot(first))).records[0], "deliverable");
    const store = await run(NoteStore);
    const request = {
      id: knowledge,
      projectId: first,
      origin: { kind: "deliverable", projectId: first, recordId: a },
    } as const;
    const note = {
      kind: "operations-concept",
      title: "Lost claim",
      actor_type: "",
      owner_id: "",
      vision_id: "",
      job_ids: [],
    } as const;
    await expect(
      run(prepareDeliverableNote(base, { ...request, id: "knowledge-invalid" }, note)),
    ).rejects.toMatchObject({ reason: "identity" });
    await expect(
      run(setDeliverableStatus(base, "archived" as DeliverableStatus)),
    ).rejects.toMatchObject({ reason: "fields" });
    const applyOutside: NoteStore["Service"] = {
      ...store,
      update: (path, change) =>
        store.update(path, (fields) => change({ ...fields, knowledge_id: vision })),
    };
    await expect(
      run(
        Effect.provideService(prepareDeliverableNote(base, request, note), NoteStore, applyOutside),
      ),
    ).rejects.toMatchObject({ reason: "pending" });
    expect((await run(store.readFresh(base.path))).frontmatter).not.toHaveProperty(
      "pending_knowledge_id",
    );
    await run(saveDeliverable(first, a, { ...draft, knowledge_id: vision }, base));
    await expect(run(prepareDeliverableNote(base, request, note))).rejects.toMatchObject({
      reason: "pending",
    });
    expect((await run(store.readFresh(base.path))).frontmatter.knowledge_id).toBe(vision);
    await run(store.trash(base.path));
    await expect(run(prepareDeliverableNote(base, request, note))).rejects.toMatchObject({
      reason: "missing",
    });
    await expect(run(setDeliverableStatus(base, "done"))).rejects.toMatchObject({
      reason: "missing",
    });
    expect((await run(store.list)).some(({ frontmatter }) => frontmatter.id === knowledge)).toBe(
      false,
    );
  });
});
