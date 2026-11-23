import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import {
  addProjectMember,
  captureProjectReleaseRules,
  createProject,
  currentProjectMcpCandidate,
  newProjectCriterionId,
  newProjectMemberId,
  projectArtifactPolicy,
  projectById,
  projectDeliverySettings,
  projectDetails,
  projectMemberChoices,
  resolveProjectMember,
  saveProjectCriterion,
  saveProjectDetails,
  setProjectArtifactRule,
  setProjectDataClass,
  setProjectMcpRead,
} from "../../../src/application/projects";
import { testRuntime } from "../../support/runtime";
import type {
  ProjectMember,
  ProjectMemberId,
  ProjectReleaseRuleSnapshot,
} from "../../../src/application/projects";

const first = "project-33333333-3333-4333-8333-000000000001";
const second = "project-33333333-3333-4333-8333-000000000002";

async function setup() {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const a = await run(
    createProject(first, {
      name: "Kundenportal",
      description: "Serviceprozesse für B2B-Kunden",
      repository: "produktteam/kundenportal",
    }),
  );
  const b = await run(
    createProject(second, {
      name: "Admin Console",
      description: "Rollen und Zugriffe verwalten",
      repository: "produktteam/admin-console",
    }),
  );
  await host.vaultReady();
  await vi.waitFor(async () =>
    expect(await run(projectById(second))).toMatchObject({ id: second }),
  );
  return { ...host, run, a, b };
}

it("supplies a stable optional project-member choice independently of the actor and host", async () => {
  const { run, runtime } = await setup();
  try {
    expect(await run(projectMemberChoices(first))).toEqual([]);
    const id: ProjectMemberId = await run(newProjectMemberId);
    const other = await run(newProjectMemberId);
    const choice = { name: "Mara König", role: "product-owner" } as const;
    await run(
      Effect.all([addProjectMember(first, id, choice), addProjectMember(first, id, choice)], {
        concurrency: "unbounded",
      }),
    );
    await run(addProjectMember(second, other, choice));
    await expect(
      run(addProjectMember(first, other, { ...choice, name: "mara könig" })),
    ).rejects.toMatchObject({ _tag: "ProjectMemberError", reason: "duplicate" });
    await vi.waitFor(async () => {
      expect(await run(projectMemberChoices(first))).toEqual([{ id, ...choice }]);
      expect(await run(projectMemberChoices(second))).toEqual([{ id: other, ...choice }]);
    });
    const member: ProjectMember | undefined = await run(resolveProjectMember(first, id));
    expect(member).toEqual({ id, ...choice });
    expect(await run(resolveProjectMember(first, other))).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
});

it("validates location changes before writing and preserves disjoint second-leaf edits", async () => {
  const { run, runtime, notes, projectFiles, a, b } = await setup();
  try {
    const draft = projectDetails(a);
    await run(notes.seed("Destinations/Existing.md", { owner: "outside" }, "Preserve this note."));
    projectFiles.bases.set("Destinations/Protected.base", "Existing Base contents");
    await expect(
      run(saveProjectDetails(a, { ...draft, vault_folder: "../Elsewhere" })),
    ).rejects.toMatchObject({ fields: ["vault_folder"] });
    await expect(
      run(saveProjectDetails(a, { ...draft, vault_folder: b.folder })),
    ).rejects.toMatchObject({ fields: ["vault_folder"] });
    await expect(
      run(saveProjectDetails(a, { ...draft, vault_folder: "Missing" })),
    ).rejects.toMatchObject({ fields: ["vault_folder"] });
    await expect(
      run(
        saveProjectDetails(a, {
          ...draft,
          vault_folder: "Destinations",
          backlog_base: "Protected.base",
        }),
      ),
    ).rejects.toMatchObject({ fields: ["backlog_base"] });
    expect(projectFiles.bases.get("Destinations/Protected.base")).toBe("Existing Base contents");
    const saved = await run(
      saveProjectDetails(a, {
        ...draft,
        name: "Customer Portal",
        repository: "",
        vault_folder: "Destinations",
        backlog_base: "Next.base",
      }),
    );
    expect(saved).toMatchObject({
      id: first,
      notePath: a.notePath,
      folder: "Destinations",
      backlogBasePath: "Destinations/Next.base",
      repository: "",
    });
    expect(notes.body("Destinations/Existing.md")).toBe("Preserve this note.");
    expect(projectFiles.bases.has("Destinations/Next.base")).toBe(false);
    expect(projectFiles.bases.has(a.backlogBasePath)).toBe(true);
    await expect(
      run(saveProjectDetails(a, { ...draft, name: "Conflicting name" })),
    ).rejects.toMatchObject({ _tag: "NoteEditConflictError", conflicts: [{ key: "name" }] });
    await expect(
      run(saveProjectDetails(a, { ...draft, description: "Independent description" })),
    ).resolves.toMatchObject({
      name: "Customer Portal",
      repository: "",
      folder: "Destinations",
      description: "Independent description",
    });
  } finally {
    await runtime.dispose();
  }
});

it("keeps untouched values from a legacy registration byte-equivalent during a rename", async () => {
  const { run, runtime, notes, a } = await setup();
  try {
    await run(
      notes.seed(
        a.notePath,
        { ...a.frontmatter, branch: " main ", external: " keep " },
        "Earlier body",
      ),
    );
    await vi.waitFor(async () =>
      expect(await run(projectById(first))).toMatchObject({ branch: " main " }),
    );
    const base = await run(projectById(first));
    if (!base) throw new Error("Missing legacy registration");
    const saved = await run(
      saveProjectDetails(base, { ...projectDetails(base), name: "Renamed product" }),
    );
    expect(saved.frontmatter).toMatchObject({
      name: "Renamed product",
      branch: " main ",
      external: " keep ",
    });
    expect(notes.body(a.notePath)).toBe("Earlier body");
  } finally {
    await runtime.dispose();
  }
});

it("keeps the request consumer's captured criteria immutable across changes and rejects a stale version", async () => {
  const { run, runtime } = await setup();
  try {
    expect(await run(captureProjectReleaseRules(first))).toEqual({
      projectId: first,
      version: 1,
      ready: [],
      done: [],
    });
    const id = await run(newProjectCriterionId);
    const firstRule = { title: "Scope is documented", enabled: true, type: "scope" } as const;
    await expect(
      run(saveProjectCriterion(first, 1, "ready", id, { ...firstRule, title: "  " })),
    ).rejects.toMatchObject({ reason: "title" });
    await run(saveProjectCriterion(first, 1, "ready", id, firstRule));
    await vi.waitFor(async () =>
      expect((await run(captureProjectReleaseRules(first)))?.version).toBe(2),
    );
    const rules: ProjectReleaseRuleSnapshot | undefined = await run(
      captureProjectReleaseRules(first),
    );
    const release = { requestId: "FR-024", rules };
    const bytes = JSON.stringify(release);
    await run(saveProjectCriterion(first, 2, "ready", id, firstRule));
    await expect(
      run(saveProjectCriterion(first, 1, "ready", id, { ...firstRule, title: "Stale edit" })),
    ).rejects.toMatchObject({ reason: "conflict" });
    await run(
      saveProjectCriterion(first, 2, "ready", id, {
        title: "Scope agreed",
        enabled: true,
        type: "manual",
      }),
    );
    await vi.waitFor(async () =>
      expect(await run(captureProjectReleaseRules(first))).toEqual({
        projectId: first,
        version: 3,
        ready: [{ id, title: "Scope agreed", enabled: true, type: "manual" }],
        done: [],
      }),
    );
    await run(
      saveProjectCriterion(first, 3, "ready", id, {
        title: "Scope agreed",
        enabled: false,
        type: "manual",
      }),
    );
    await vi.waitFor(async () =>
      expect(await run(captureProjectReleaseRules(first))).toEqual({
        projectId: first,
        version: 4,
        ready: [],
        done: [],
      }),
    );
    expect(release.rules?.ready).toEqual([{ id, ...firstRule }]);
    expect(Object.isFrozen(release.rules?.ready[0])).toBe(true);
    expect(JSON.stringify(release)).toBe(bytes);
    expect(await run(captureProjectReleaseRules(second))).toMatchObject({ version: 1, ready: [] });
  } finally {
    await runtime.dispose();
  }
});

it("reads current MCP configuration immediately after writes and keeps requirements project-scoped", async () => {
  const { run, runtime, a } = await setup();
  try {
    await run(setProjectMcpRead(first, true));
    expect(await run(currentProjectMcpCandidate(first))).toMatchObject({
      id: first,
      mcpRead: true,
      dataClass: "internal",
    });
    await run(setProjectMcpRead(first, false));
    await run(setProjectArtifactRule(a, "integration_adr_required", false));
    await run(setProjectDataClass(a, "confidential"));
    expect(await run(currentProjectMcpCandidate(first))).toMatchObject({
      id: first,
      mcpRead: false,
      dataClass: "confidential",
    });
    expect(await run(currentProjectMcpCandidate(second))).toMatchObject({
      id: second,
      mcpRead: false,
      dataClass: "internal",
    });
    await vi.waitFor(async () => {
      expect(await run(projectDeliverySettings(first))).toEqual({
        repository: "produktteam/kundenportal",
        branch: "main",
        mcpRead: false,
        dataClass: "confidential",
      });
      expect(
        (await run(projectArtifactPolicy(first)))?.find(({ id }) => id === "integration-adr")
          ?.required,
      ).toBe(false);
    });
    expect(
      (await run(projectArtifactPolicy(second)))?.find(({ id }) => id === "integration-adr")
        ?.required,
    ).toBe(true);
    expect(await run(projectById(first))).toMatchObject({ id: first, name: "Kundenportal" });
  } finally {
    await runtime.dispose();
  }
});
