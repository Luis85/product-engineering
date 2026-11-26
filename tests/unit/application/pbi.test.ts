import { Effect, Layer, Result } from "effect";
import { expect, it, vi } from "vitest";
import {
  backlogDomainContribution,
  backlogSnapshot,
  approvePbi,
  inspectPbiPreparation,
  pbiSourceDraft,
  readBacklogItem,
  readPbiDetail,
  savePbiDraft,
  saveBacklogItem,
} from "../../../src/application/backlog";
import { resolveDomainScope } from "../../../src/application/domain-model";
import { ArtifactGit, ArtifactGitError } from "../../../src/application/git";
import { NoteStore } from "../../../src/application/notes";
import {
  createProject,
  readFreshProject,
  setProjectArtifactRule,
} from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";

const customer = "project-33333333-3333-4333-8333-000000000001";

async function fixture(
  artifactGit?: NonNullable<Parameters<typeof testRuntime>[0]>["artifactGit"],
) {
  const host = testRuntime(artifactGit ? { artifactGit } : {});
  const run = host.runtime.runPromise.bind(host.runtime);
  const project = await run(
    createProject(customer, {
      name: "Kundenportal",
      description: "Serviceprozesse",
      repository: "team/kundenportal",
    }),
  );
  await host.vaultReady();
  const path = project.folder + "/Export cases.md";
  await run(
    host.notes.seed(
      path,
      {
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000009",
        project_id: customer,
        "pe-id": "UC-09",
        type: "PBI",
        pbi_revision: 7,
        pbi_approved_revision: 7,
        pbi_approval_fingerprint: 123,
        extra: "sentinel",
      },
      "## Original",
    ),
  );
  await vi.waitFor(async () =>
    expect((await run(backlogSnapshot(customer))).items[0]?.id).toBe("UC-09"),
  );
  return { ...host, run, project, path };
}

it("keeps approval on a planning-stage change and invalidates it on the V07 description edit", async () => {
  const { run, runtime, path } = await fixture();
  try {
    const store = await run(NoteStore);
    const before = await run(readBacklogItem(customer, "UC-09"));
    await run(saveBacklogItem(customer, before, { ...before.draft, state: "Open" }));
    expect((await run(store.readFresh(path))).frontmatter).toMatchObject({
      pbi_revision: 7,
      pbi_approved_revision: 7,
      pbi_approval_fingerprint: 123,
    });
    const stage = await run(readBacklogItem(customer, "UC-09"));
    await run(saveBacklogItem(customer, stage, { ...stage.draft, body: "## Revised" }));
    const revised = await run(store.readContent(path));
    expect(revised.frontmatter).toMatchObject({ pbi_revision: 8, extra: "sentinel" });
    expect(revised.frontmatter).not.toHaveProperty("pbi_approved_revision");
    expect(revised.frontmatter).not.toHaveProperty("pbi_approval_fingerprint");
    expect(revised.body).toBe("## Revised");
  } finally {
    await runtime.dispose();
  }
});

const rejectGit = () => Effect.fail(new ArtifactGitError({ reason: "unavailable" }));

it("checks exact sources and local commits, honors enabled rules, and resets approval on a source change", async () => {
  const git = Layer.succeed(ArtifactGit, {
    compare: rejectGit,
    commit: rejectGit,
    readRevision: rejectGit,
    inspect: ({ path }) => {
      const name = path.split("/").at(-1) ?? "";
      const file = { path: name, bytes: new Uint8Array([9]) };
      return Effect.succeed({
        state: name === "PRD.md" ? "changed" : "clean",
        head: "fixture-commit",
        ref: "refs/heads/main",
        worktree: "/vault",
        base: file,
        current: file,
        revisions: [
          { oid: "fixture-commit", parents: [], path: name, author: "", time: "", message: "" },
        ],
      });
    },
  });
  const { run, runtime, project, path, notes } = await fixture(git);
  try {
    const prd = "knowledge-33333333-3333-4333-8333-000000000041";
    const vision = "knowledge-33333333-3333-4333-8333-000000000042";
    const adr = "knowledge-33333333-3333-4333-8333-000000000043";
    const other = "project-33333333-3333-4333-8333-000000000002";
    const foreign = "knowledge-33333333-3333-4333-8333-000000000044";
    const sources = [
      [prd, "PRD", "prd", "approved", { requirement_id: "REQ-03", vision_id: vision }],
      [vision, "Vision", "vision", "approved", {}],
      [adr, "ADR", "adr", "draft", {}],
      [foreign, "Foreign", "research", "approved", { project_id: other }],
    ] as const;
    await Promise.all(
      sources.map(([id, title, kind, approval, fields]) =>
        run(
          notes.seed(project.folder + "/" + title + ".md", {
            schema: "product-engineering.knowledge/v1",
            project_id: customer,
            id,
            title,
            kind,
            display_id: title,
            approval,
            ...fields,
          }),
        ),
      ),
    );
    const store = await run(NoteStore);
    await run(
      store.update(path, () =>
        Result.succeed({
          set: {
            pbi_prd_id: prd,
            pbi_requirement_id: "REQ-03",
            pbi_integration_change: true,
            pbi_criteria: [
              {
                id: "AC-01",
                scenario_id: "SC-01",
                text: "CSV downloads",
                scenario_name: "Export cases",
                given: "a case",
                when: "exporting",
                then_step: "CSV downloads",
              },
            ],
          },
        }),
      ),
    );
    const load = () => run(readPbiDetail(customer, "UC-09"));
    await vi.waitFor(async () => expect((await load()).sources[0]?.record?.id).toBe(prd));
    let detail = await load();
    let prep = await run(inspectPbiPreparation(detail));
    expect(prep.prerequisites.map(({ reason }) => reason)).toEqual(["research", "adr"]);
    await expect(run(approvePbi(detail))).rejects.toMatchObject({ reason: "approval" });
    const settings = await run(readFreshProject(customer));
    if (!settings) throw new Error("Missing settings");
    const rules = await run(setProjectArtifactRule(settings, "research_jtbd_required", false));
    await run(store.update(path, () => Result.succeed({ set: { pbi_adr_id: adr } })));
    detail = await load();
    prep = await run(inspectPbiPreparation(detail));
    expect(prep.prerequisites.map(({ reason, record }) => [reason, record?.id])).toEqual([
      ["adrApproval", adr],
    ]);
    await run(setProjectArtifactRule(rules, "integration_adr_required", false));
    await run(approvePbi(detail));
    detail = await load();
    prep = await run(inspectPbiPreparation(detail));
    expect(detail.approval).toBe("approved");
    expect(prep.gaps.map(({ reason, record }) => [reason, record?.id])).toEqual([
      ["gitPending", prd],
    ]);
    expect(
      prep.inputs
        .filter((input) => input.state !== "unavailable")
        .map((input) => [input.id, input.path]),
    ).toContainEqual([vision, project.folder + "/Vision.md"]);
    const draft = {
      ...pbiSourceDraft(detail.edit.item.fields),
      title: detail.edit.draft.title,
      body: detail.edit.draft.body,
      integration: true,
    };
    await expect(
      run(savePbiDraft(customer, detail.edit, { ...draft, pbi_research_id: foreign })),
    ).rejects.toMatchObject({ reason: "sources" });
    await run(savePbiDraft(customer, detail.edit, { ...draft, pbi_adr_id: "" }));
    const edited = await load();
    expect(edited.approval).toBe("draft");
    expect(edited.revision).toBe(detail.revision + 1);
    expect(edited.criteria?.map(({ id, scenario_id }) => [id, scenario_id])).toEqual([
      ["AC-01", "SC-01"],
    ]);
  } finally {
    await runtime.dispose();
  }
});

it("keeps outside Markdown and unrelated metadata while rejecting a stale overlapping body draft", async () => {
  const { run, runtime, path } = await fixture();
  try {
    const before = await run(readPbiDetail(customer, "UC-09"));
    const store = await run(NoteStore);
    await run(
      store.updateContent(path, () =>
        Result.succeed({ patch: { set: { outside: "external" } }, body: "## Outside" }),
      ),
    );
    const draft = {
      ...pbiSourceDraft(before.edit.item.fields),
      title: before.edit.draft.title,
      body: before.edit.draft.body,
      integration: false,
    };
    await expect(
      run(savePbiDraft(customer, before.edit, { ...draft, body: "## Stale draft" })),
    ).rejects.toMatchObject({ reason: "conflict" });
    const merged = await run(savePbiDraft(customer, before.edit, { ...draft, title: "New title" }));
    expect(merged.body).toBe("## Outside");
    expect(merged.frontmatter).toMatchObject({
      outside: "external",
      title: "New title",
      pbi_revision: 8,
    });
  } finally {
    await runtime.dispose();
  }
});

it("includes an entity through the exact linked PRD while excluding an unrelated PRD", async () => {
  const { run, runtime, project, path, notes } = await fixture();
  try {
    const prd = "knowledge-33333333-3333-4333-8333-000000000031";
    const unrelated = "knowledge-33333333-3333-4333-8333-000000000032";
    const store = await run(NoteStore);
    const sources = [
      [prd, "Export rules", "prd", { requirement_id: "REQ-03" }],
      [unrelated, "Other rules", "prd", { requirement_id: "REQ-04" }],
      [
        "knowledge-33333333-3333-4333-8333-000000000033",
        "Service Case",
        "entity",
        { domain_scope: [{ kind: "prd", id: prd }] },
      ],
      [
        "knowledge-33333333-3333-4333-8333-000000000034",
        "Account",
        "entity",
        { domain_scope: [{ kind: "prd", id: unrelated }] },
      ],
    ] as const;
    await Promise.all(
      sources.map(([id, title, kind, values]) =>
        run(
          notes.seed(project.folder + "/" + title + ".md", {
            schema: "product-engineering.knowledge/v1",
            project_id: customer,
            id,
            title,
            kind,
            display_id: title,
            ...values,
          }),
        ),
      ),
    );
    await run(
      store.update(path, () =>
        Result.succeed({ set: { pbi_prd_id: prd, pbi_requirement_id: "REQ-03" } }),
      ),
    );
    await vi.waitFor(async () => {
      const scope = await run(
        resolveDomainScope(customer, [{ kind: "item", id: "UC-09" }], backlogDomainContribution),
      );
      expect(scope.entities.map(({ title, origins }) => ({ title, origins }))).toEqual([
        {
          title: "Service Case",
          origins: [{ kind: "prd", id: prd, title: "Export rules", projectId: customer }],
        },
      ]);
    });
    await run(
      store.update(path, () => Result.succeed({ set: { pbi_requirement_id: "REQ-wrong" } })),
    );
    await vi.waitFor(async () => {
      const scope = await run(
        resolveDomainScope(customer, [{ kind: "item", id: "UC-09" }], backlogDomainContribution),
      );
      expect(scope.entities).toEqual([]);
    });
  } finally {
    await runtime.dispose();
  }
});
