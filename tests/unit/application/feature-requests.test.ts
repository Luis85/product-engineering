import { expect, it } from "vitest";
import {
  activeFeatureRequest,
  createFeatureRequest,
  featureRequestStageCounts,
  featureRequestsForPbi,
  featureRequestsSnapshot,
  readDraftRequestGates,
  requestGateProgress,
} from "../../../src/application/feature-requests";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import type { ProjectId } from "../../../src/application/projects";
import { encodeProjectReleaseRules } from "../../../src/domain/projects";
import { testRuntime } from "../../support/runtime";

const project = "project-33333333-3333-4333-8333-000000000751";
const peer = "project-33333333-3333-4333-8333-000000000752";
const first = "feature-request-33333333-3333-4333-8333-000000000753";
const second = "feature-request-33333333-3333-4333-8333-000000000754";
const third = "feature-request-33333333-3333-4333-8333-000000000755";
const fourth = "feature-request-33333333-3333-4333-8333-000000000756";
const draft = { pbiId: "UC-09", title: "", scope: "Export approved cases" };
const pbi = (projectId: ProjectId, suffix: number) => ({
  schema: "product-engineering.backlog/v1",
  id: `backlog-33333333-3333-4333-8333-00000000075${suffix}`,
  project_id: projectId,
  "pe-id": "UC-09",
  type: "PBI",
  title: projectId === project ? "Customer cases" : "Admin cases",
});

it("rechecks contextual submissions under the write lock and isolates explicitly different scopes", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  try {
    const customer = await run(
      createProject(project, {
        name: "Customers",
        description: "Customer product",
        repository: "team/customers",
      }),
    );
    const admin = await run(
      createProject(peer, {
        name: "Admin",
        description: "Admin product",
        repository: "team/admin",
      }),
    );
    await host.vaultReady();
    await run(host.notes.seed(customer.folder + "/UC-09.md", pbi(project, 1)));
    await run(host.notes.seed(admin.folder + "/UC-09.md", pbi(peer, 2)));
    await run(rebuildNoteIndex);
    expect(await run(activeFeatureRequest(project, draft.pbiId))).toBeUndefined();
    await expect(
      run(createFeatureRequest(project, "feature-request-invalid", draft)),
    ).rejects.toMatchObject({ reason: "identity" });
    await expect(
      run(createFeatureRequest("project-33333333-3333-4333-8333-000000000759", first, draft)),
    ).rejects.toMatchObject({ reason: "project" });
    await expect(
      run(createFeatureRequest(project, first, { ...draft, pbiId: "FE-09" })),
    ).rejects.toMatchObject({ reason: "pbi" });
    await expect(
      run(createFeatureRequest(project, first, { ...draft, scope: " \n " })),
    ).rejects.toMatchObject({ reason: "scope" });
    await expect(
      run(createFeatureRequest(project, first, { ...draft, title: "First\nSecond" })),
    ).rejects.toMatchObject({ reason: "title" });
    const create = () => run(createFeatureRequest(project, first, draft, true));
    expect(await Promise.all([create(), create()])).toEqual([first, first]);
    expect(await run(activeFeatureRequest(project, draft.pbiId))).toBe(first);
    expect(
      await run(createFeatureRequest(project, second, { ...draft, scope: "Another scope" }, true)),
    ).toBe(first);
    expect(
      await run(
        createFeatureRequest(project, second, { ...draft, scope: " Export approved cases " }),
      ),
    ).toBe(first);
    expect(
      await run(createFeatureRequest(project, second, { ...draft, scope: "Another scope" })),
    ).toBe(second);
    await expect(
      run(createFeatureRequest(project, first, { ...draft, title: "Changed explicit title" })),
    ).rejects.toMatchObject({ reason: "identity" });
    await expect(run(createFeatureRequest(peer, first, draft))).rejects.toMatchObject({
      reason: "identity",
    });
    await expect(
      run(createFeatureRequest(project, third, { ...draft, pbiId: "UC-88" })),
    ).rejects.toMatchObject({ reason: "pbi" });
    expect(await run(createFeatureRequest(peer, fourth, draft))).toBe(fourth);
    await run(rebuildNoteIndex);
    const customerRequests = (await run(featureRequestsSnapshot(project))).records;
    const adminRequests = (await run(featureRequestsSnapshot(peer))).records;
    expect(customerRequests).toMatchObject([
      { id: second, title: "Customer cases", pbiId: "UC-09", scope: "Another scope", revision: 1 },
      { id: first, title: "Customer cases", displayId: "FR-001" },
    ]);
    expect(adminRequests).toMatchObject([
      { id: fourth, title: "Admin cases", displayId: "FR-001" },
    ]);
    expect(
      featureRequestsForPbi(project, "UC-09", [...customerRequests, ...adminRequests]).active?.id,
    ).toBe(second);
    expect(featureRequestStageCounts([...customerRequests]).get("draft")).toBe(2);
    const record = customerRequests[0];
    if (!record) throw new Error("Missing stored draft");
    expect(
      featureRequestStageCounts([
        { ...record, state: "released" },
        { ...record, state: "review", blocker: "stale-inputs" },
        { ...record, state: "accepted" },
        { ...record, state: "running" },
        { ...record, state: "review" },
      ]),
    ).toEqual(
      new Map([
        ["draft", 0],
        ["blocked", 1],
        ["ready", 1],
        ["factory", 1],
        ["review", 1],
        ["done", 1],
      ]),
    );
    const store = await run(NoteStore);
    expect((await run(store.readFresh(record.path))).frontmatter).toMatchObject({
      state: "draft",
      revision: 1,
      title: "Customer cases",
    });
    await run(host.notes.removeOutside(customer.folder + "/UC-09.md"));
    await run(rebuildNoteIndex);
    expect(await run(createFeatureRequest(project, first, draft))).toBe(first);
  } finally {
    await host.runtime.dispose();
  }
});

it("computes draft gates from the configured active rules, PBI and scope", async () => {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  try {
    const customer = await run(
      createProject(project, {
        name: "Customers",
        description: "Customer product",
        repository: "team/customers",
      }),
    );
    await host.vaultReady();
    const store = await run(NoteStore);
    const note = await run(store.readFresh(customer.notePath));
    await run(
      host.notes.seed(note.path, {
        ...note.frontmatter,
        release_rules: encodeProjectReleaseRules({
          version: 2,
          ready: [
            {
              id: "project-criterion-33333333-3333-4333-8333-000000000751",
              type: "scope",
              title: "Scope provided",
              enabled: true,
            },
            {
              id: "project-criterion-33333333-3333-4333-8333-000000000752",
              type: "manual",
              title: "Manual check",
              enabled: true,
            },
            {
              id: "project-criterion-33333333-3333-4333-8333-000000000753",
              type: "open-bug",
              title: "Bugs settled",
              enabled: true,
            },
            {
              id: "project-criterion-33333333-3333-4333-8333-000000000754",
              type: "open-task",
              title: "Inactive",
              enabled: false,
            },
            {
              id: "project-criterion-33333333-3333-4333-8333-000000000755",
              type: "open-work",
              title: "Companions settled",
              enabled: true,
            },
          ],
          done: [],
        }),
      }),
    );
    await run(host.notes.seed(customer.folder + "/UC-09.md", pbi(project, 1)));
    await run(rebuildNoteIndex);
    await run(createFeatureRequest(project, first, draft));
    await run(rebuildNoteIndex);
    const record = (await run(featureRequestsSnapshot(project))).records[0];
    if (!record) throw new Error("Missing stored draft");
    const gates = await run(readDraftRequestGates(record));
    expect(gates.gaps).toContainEqual({ reason: "prd" });
    expect(gates.ready.map(({ status }) => status)).toEqual([
      "open",
      "open",
      "passed",
      "open",
      "passed",
      "passed",
    ]);
    expect(requestGateProgress(gates.ready)).toEqual({ met: 3, total: 6 });
    expect(requestGateProgress(gates.done)).toEqual({ met: 0, total: 2 });
    expect(requestGateProgress(undefined)).toBeUndefined();
    const unavailable = await run(readDraftRequestGates({ ...record, pbiId: "UC-88" }));
    expect(unavailable.ready.map(({ status }) => status)).toEqual([
      "unavailable",
      "unavailable",
      "passed",
      "open",
      "unavailable",
      "unavailable",
    ]);
    await run(
      host.notes.seed(customer.folder + "/BUG-01.md", {
        project_id: project,
        type: "Bug",
        "pe-id": "BUG-01",
        parent: "[[UC-09]]",
        status: "Open",
      }),
    );
    await run(rebuildNoteIndex);
    const blocked = await run(readDraftRequestGates(record));
    expect(blocked.ready.slice(-2).map(({ status }) => status)).toEqual(["open", "open"]);
    await run(host.notes.seed(note.path, { ...note.frontmatter, release_rules: "{}" }));
    expect((await run(readDraftRequestGates(record))).rulesAvailable).toBe(false);
  } finally {
    await host.runtime.dispose();
  }
});
