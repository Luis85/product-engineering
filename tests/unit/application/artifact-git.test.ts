import { Effect, Layer } from "effect";
import { expect, it, vi } from "vitest";
import {
  ArtifactGit,
  commitArtifactGit,
  inspectArtifactGit,
  readArtifactRevision,
} from "../../../src/application/git";
import type {
  GitArtifactSource,
  GitArtifactTarget,
  GitJournal,
} from "../../../src/application/git";
import { knowledgeDetailRoute, knowledgeGitSource } from "../../../src/application/knowledge";
import { createProject } from "../../../src/application/projects";
import { eventually } from "../../support/wait";
import { testRuntime } from "../../support/runtime";

const project = "project-33333333-3333-4333-8333-000000000001";
const other = "project-33333333-3333-4333-8333-000000000002";
const id = "knowledge-33333333-3333-4333-8333-000000000005";
const otherNote = "knowledge-33333333-3333-4333-8333-000000000014";
const path = "Vault/Fixture note.md";
const otherPath = "Other/Fixture note.md";
const oid = "a".repeat(40);
const snapshot = { path, bytes: new TextEncoder().encode("Frozen source\r\n") };
const journal: GitJournal = {
  state: "changed",
  worktree: "/fixture",
  ref: "refs/heads/main",
  head: oid,
  base: snapshot,
  current: { path, bytes: new TextEncoder().encode("Saved after freeze\n") },
  revisions: [],
};

it("resolves the active project and canonical record for shared Git consumers and returns an immutable source", async () => {
  const inspect = vi.fn<(typeof ArtifactGit.Service)["inspect"]>((_target: GitArtifactTarget) =>
    Effect.succeed(journal),
  );
  const readRevision = vi.fn<(typeof ArtifactGit.Service)["readRevision"]>(
    (_target: GitArtifactTarget, _revision: string) => Effect.succeed(snapshot),
  );
  const commit = vi.fn<(typeof ArtifactGit.Service)["commit"]>(() => Effect.succeed(oid));
  const artifactGit = Layer.succeed(ArtifactGit, {
    inspect,
    compare: () =>
      Effect.succeed({ current: snapshot, base: undefined, parent: undefined, merge: false }),
    readRevision,
    commit,
  });
  const host = testRuntime({ artifactGit });
  const run = host.runtime.runPromise;
  try {
    await run(
      createProject(project, {
        name: "First",
        description: "First product",
        repository: "teams/first",
      }),
    );
    await run(
      createProject(other, {
        name: "Second",
        description: "Second product",
        repository: "teams/second",
      }),
    );
    await run(
      host.notes.seed(path, {
        schema: "product-engineering.knowledge/v1",
        id,
        project_id: project,
        title: "Same display ID",
        kind: "prd",
        display_id: "PRD-03",
        approval: "draft",
      }),
    );
    await run(
      host.notes.seed(otherPath, {
        schema: "product-engineering.knowledge/v1",
        id: otherNote,
        project_id: other,
        title: "Same display ID",
        kind: "prd",
        display_id: "PRD-03",
        approval: "draft",
      }),
    );
    await host.vaultReady();
    const first = knowledgeGitSource(knowledgeDetailRoute(project, id));
    const second = knowledgeGitSource(knowledgeDetailRoute(other, otherNote));
    const missing = knowledgeGitSource(knowledgeDetailRoute(other, id));
    const review = await eventually(() => run(inspectArtifactGit(first)));
    expect(review.target).toEqual({
      path,
      projectId: project,
      branch: "main",
      repository: "teams/first",
    });
    await expect(run(inspectArtifactGit(missing))).rejects.toMatchObject({ reason: "path" });
    await expect(
      run(commitArtifactGit(second, review, "Cross-project attempt")),
    ).rejects.toMatchObject({ reason: "conflict" });
    expect(commit).not.toHaveBeenCalled();
    await expect(run(readArtifactRevision(first, oid))).resolves.toEqual(snapshot);
    expect(readRevision).toHaveBeenCalledWith(review.target, oid);
    const backlogSource: GitArtifactSource = {
      projectId: project,
      resolvePath: Effect.succeed("Vault/Backlog Item.md"),
    };
    const itemJournal = await run(inspectArtifactGit(backlogSource));
    expect(itemJournal.target).toMatchObject({ projectId: project, path: "Vault/Backlog Item.md" });
  } finally {
    await host.runtime.dispose();
  }
});
