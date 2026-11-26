import { Effect } from "effect";
import { expect, it } from "vitest";
import {
  createKnowledge,
  KnowledgeDeliverableOrigins,
} from "../../../../src/application/knowledge";
import { NoteStore } from "../../../../src/application/notes";
import { addProjectMember, createProject } from "../../../../src/application/projects";
import { first, jobOne, second, seedFoundations, vision, withProject } from "./knowledge-fixture";

it("validates the typed job origin against the current project at submit and persists the accepted origin once", async () => {
  await withProject(async ({ host }) => {
    await host.runtime.runPromise(
      createProject(second, {
        name: "Admin Console",
        description: "Rollen und Zugriffe verwalten",
        repository: "produktteam/admin-console",
      }),
    );
    await seedFoundations(host);
    const request = {
      projectId: first,
      id: "knowledge-33333333-3333-4333-8333-000000000008",
    } as const;
    const draft = {
      kind: "research",
      title: "Service partner research",
      actor_type: "",
      owner_id: "",
      vision_id: "",
      job_ids: [],
    } as const;
    const invalid = {
      ...request,
      origin: { kind: "job", projectId: second, recordId: jobOne },
    } as const;
    const listing = NoteStore.use((store) => store.list);
    const before = await host.runtime.runPromise(listing);
    await expect(host.runtime.runPromise(createKnowledge(invalid, draft))).rejects.toMatchObject({
      _tag: "KnowledgeCreateError",
      reason: "origin",
    });
    expect(await host.runtime.runPromise(listing)).toEqual(before);
    const accepted = {
      ...request,
      origin: { kind: "job", projectId: first, recordId: jobOne },
    } as const;
    const note = await host.runtime.runPromise(createKnowledge(accepted, draft));
    expect(note.frontmatter).toMatchObject({
      id: request.id,
      project_id: first,
      job_ids: [jobOne],
    });
    const same = await host.runtime.runPromise(createKnowledge(accepted, draft));
    expect(same).toEqual(note);
    expect(
      (await host.runtime.runPromise(listing)).filter(
        ({ frontmatter }) => frontmatter.id === request.id,
      ),
    ).toHaveLength(1);
  });
});

it("checks the deliverable resolver by stable ID and project, rejects malformed records and honors a vision origin", async () => {
  await withProject(async ({ host }) => {
    await seedFoundations(host);
    const request = {
      projectId: first,
      id: "knowledge-33333333-3333-4333-8333-000000000009",
    } as const;
    const draft = {
      kind: "prd",
      title: "Delivery source requirement",
      actor_type: "",
      owner_id: "",
      vision_id: "",
      job_ids: [],
    } as const;
    const origin = { kind: "deliverable", projectId: first, recordId: "deliverable-01" } as const;
    const malformed = { ...origin, recordId: "deliverable\n01" };
    const command = (source: typeof origin | typeof malformed) =>
      createKnowledge({ ...request, origin: source }, draft);
    const run = host.runtime.runPromise;
    const listing = NoteStore.use((store) => store.list);
    const before = await run(listing);
    await expect(run(command(origin))).rejects.toMatchObject({ reason: "origin" });
    await expect(
      run(
        Effect.provideService(command(origin), KnowledgeDeliverableOrigins, {
          resolve: (value) => Effect.succeed({ ...value, projectId: second }),
        }),
      ),
    ).rejects.toMatchObject({ reason: "origin" });
    await expect(
      run(
        Effect.provideService(command(malformed), KnowledgeDeliverableOrigins, {
          resolve: (value) => Effect.succeed(value),
        }),
      ),
    ).rejects.toMatchObject({ reason: "origin" });
    expect(await run(listing)).toEqual(before);
    expect(
      (
        await run(
          Effect.provideService(command(origin), KnowledgeDeliverableOrigins, {
            resolve: (value) => Effect.succeed(value),
          }),
        )
      ).frontmatter,
    ).toMatchObject({ deliverable_id: origin.recordId });
    const fromVision = await run(
      createKnowledge(
        {
          ...request,
          id: "knowledge-33333333-3333-4333-8333-000000000010",
          origin: { kind: "vision", projectId: first, recordId: vision },
        },
        draft,
      ),
    );
    expect(fromVision.frontmatter).toMatchObject({ vision_id: vision, requirement_id: "REQ-02" });
  });
});

it("checks owners and foundation types against current vault records without leaving a draft", async () => {
  await withProject(async ({ host }) => {
    const foreign = "project-member-33333333-3333-4333-8333-000000000002";
    const admin = await host.runtime.runPromise(
      createProject(second, {
        name: "Admin Console",
        description: "Rollen und Zugriffe verwalten",
        repository: "produktteam/admin-console",
      }),
    );
    await host.runtime.runPromise(
      addProjectMember(second, foreign, { name: "Administration", role: "requirements" }),
    );
    await seedFoundations(host);
    const request = {
      projectId: first,
      id: "knowledge-33333333-3333-4333-8333-000000000011",
    } as const;
    const draft = {
      kind: "prd",
      title: "Valid PRD",
      actor_type: "",
      owner_id: "",
      vision_id: "",
      job_ids: [],
    } as const;
    const run = host.runtime.runPromise;
    const listing = NoteStore.use((store) => store.list);
    const registration = await run(NoteStore.use((store) => store.readFresh(admin.notePath)));
    const before = await run(listing);
    expect(registration.frontmatter.team).toBeDefined();
    await expect(
      run(createKnowledge(request, { ...draft, owner_id: foreign })),
    ).rejects.toMatchObject({ reason: "owner_id" });
    await expect(run(createKnowledge(request, { ...draft, title: "  " }))).rejects.toMatchObject({
      reason: "title",
    });
    await expect(
      run(createKnowledge(request, { ...draft, vision_id: jobOne })),
    ).rejects.toMatchObject({ reason: "vision_id" });
    await expect(
      run(createKnowledge(request, { ...draft, job_ids: ["invalid"] })),
    ).rejects.toMatchObject({ reason: "job_ids" });
    await expect(
      run(
        createKnowledge(
          {
            ...request,
            origin: { kind: "vision", projectId: first, recordId: vision },
          },
          { ...draft, kind: "research" },
        ),
      ),
    ).rejects.toMatchObject({ reason: "origin" });
    await expect(
      run(
        createKnowledge(
          {
            ...request,
            origin: { kind: "job", projectId: first, recordId: vision },
          },
          draft,
        ),
      ),
    ).rejects.toMatchObject({ reason: "origin" });
    expect(await run(listing)).toEqual(before);
    const draftWithSafeName = await run(createKnowledge(request, { ...draft, title: "NUL" }));
    expect(draftWithSafeName.path).toMatch(/\/PRD-01\.md$/);
    expect(draftWithSafeName.frontmatter.title).toBe("NUL");
  });
});
