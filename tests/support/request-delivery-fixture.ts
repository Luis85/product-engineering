import { Effect, Hash, Layer, Result } from "effect";
import { vi } from "vitest";
import {
  createFeatureRequest,
  FeatureRequestDelivery,
  featureRequestsSnapshot,
} from "../../src/application/feature-requests";
import { ArtifactGit, ArtifactGitError } from "../../src/application/git";
import { NoteStore, rebuildNoteIndex } from "../../src/application/notes";
import { createProject } from "../../src/application/projects";
import { encodeProjectReleaseRules } from "../../src/domain/projects";
import { localFactoryFixture } from "../../src/infrastructure/local-factory";
import { testRuntime } from "./runtime";

export const project = "project-33333333-3333-4333-8333-000000000481";
export const request = "feature-request-33333333-3333-4333-8333-000000000491";
export const manual = "project-criterion-33333333-3333-4333-8333-000000000410";
export const prd = "knowledge-33333333-3333-4333-8333-000000000470";
const job = "knowledge-33333333-3333-4333-8333-000000000471";
const research = "knowledge-33333333-3333-4333-8333-000000000472";
const vision = "knowledge-33333333-3333-4333-8333-000000000473";
export const sha = "a".repeat(40);
export const title = "CSV export";
export const scope = "Only confirmed cases";
export const pbiId = "UC-09";
export const criterion = {
  id: "AC-09",
  text: "Exports only confirmed cases",
  scenario_id: "SC-09",
  scenario_name: "Confirmed cases",
  given: "One case is confirmed",
  when: "Export starts",
  then_step: "Only that case is exported",
};
const sources = {
  pbi_prd_id: prd,
  pbi_requirement_id: "REQ-03",
  pbi_job_id: job,
  pbi_research_id: research,
  pbi_adr_id: "",
};

export async function deliveryFixture(language: "en" | "de" = "de") {
  const revisions = new Map<string, Uint8Array>();
  const dirty = new Set<string>();
  const artifactGit = Layer.succeed(ArtifactGit, {
    inspect: ({ path }) =>
      Effect.gen(function* () {
        const bytes = revisions.get(path);
        if (!bytes) return yield* new ArtifactGitError({ reason: "path" });
        const current = { path, bytes };
        const revision = {
          oid: sha,
          parents: [],
          author: "Fixture",
          time: "",
          message: "Tracked fixture",
          path,
        };
        return {
          current,
          base: current,
          state: dirty.has(path) ? ("changed" as const) : ("clean" as const),
          revisions: [revision],
          worktree: "/fixture",
          ref: "refs/heads/main",
          head: sha,
        };
      }),
    readRevision: ({ path }, oid) => {
      const bytes = revisions.get(path);
      return bytes && oid === sha
        ? Effect.succeed({ bytes, path })
        : Effect.fail(new ArtifactGitError({ reason: "path" }));
    },
    compare: () => Effect.fail(new ArtifactGitError({ reason: "unavailable" })),
    commit: () => Effect.fail(new ArtifactGitError({ reason: "unavailable" })),
  });
  const delivery = await Effect.runPromise(
    FeatureRequestDelivery.pipe(Effect.provide(localFactoryFixture)),
  );
  const dispatch = vi.fn<typeof delivery.dispatch>(delivery.dispatch);
  const retry = vi.fn<typeof delivery.retry>(delivery.retry);
  const host = testRuntime({
    language,
    artifactGit,
    requestDelivery: Layer.succeed(FeatureRequestDelivery, { ...delivery, dispatch, retry }),
  });
  const run = host.runtime.runPromise;
  const p = await run(
    createProject(project, {
      name: "Customers",
      description: "Case delivery",
      repository: "team/customer",
    }),
  );
  await host.vaultReady();
  const store = await run(NoteStore);
  const rules = encodeProjectReleaseRules({
    version: 3,
    ready: [{ id: manual, title: "Selection checked", type: "manual", enabled: true }],
    done: [],
  });
  await run(store.update(p.notePath, () => Result.succeed({ set: { release_rules: rules } })));
  const seed = async (path: string, fields: Record<string, unknown>, body: string) => {
    await run(host.notes.seed(path, fields, body));
    revisions.set(path, new TextEncoder().encode((await run(store.readContent(path))).text));
  };
  const pbiPath = p.folder + "/UC-09.md";
  const prdPath = p.folder + "/PRD-03.md";
  const pbiBody = "\nBody citing [[PRD-03#REQ-03|Requirement]].\n";
  const linked = [
    [prd, "prd", "PRD-03"],
    [job, "jtbd", "JOB-01"],
    [research, "research", "RES-01"],
    [vision, "vision", "VIS-01"],
  ] as const;
  await Promise.all(
    linked.map(([id, kind, display_id]) =>
      seed(
        p.folder + "/" + display_id + ".md",
        {
          schema: "product-engineering.knowledge/v1",
          id,
          project_id: project,
          title: display_id,
          kind,
          display_id,
          approval: "approved",
          ...(kind === "prd" && { requirement_id: "REQ-03" }),
        },
        `\nExact ${display_id} text\n`,
      ),
    ),
  );
  await seed(
    pbiPath,
    {
      schema: "product-engineering.backlog/v1",
      id: "backlog-33333333-3333-4333-8333-000000000490",
      project_id: project,
      "pe-id": pbiId,
      title,
      type: "PBI",
      ...sources,
      pbi_criteria: [criterion],
      pbi_approved_revision: 1,
      pbi_approval_fingerprint: Hash.string(
        JSON.stringify([title, pbiBody, sources, [Object.values(criterion)], undefined, false]),
      ),
    },
    pbiBody,
  );
  await run(rebuildNoteIndex);
  await run(createFeatureRequest(project, request, { pbiId, title, scope }));
  async function record() {
    await run(rebuildNoteIndex);
    const current = (await run(featureRequestsSnapshot(project))).records[0];
    if (!current) throw new Error("Missing delivery fixture request");
    return current;
  }
  return { host, run, record, store, p, prdPath, dirty, delivery, dispatch, retry, seed };
}
