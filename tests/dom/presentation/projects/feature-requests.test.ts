import { expect, it } from "vitest";
import {
  backlogBoardRoute,
  backlogRoute,
  pbiDetailRoute,
} from "../../../../src/application/backlog";
import {
  canonicalRequestJson,
  featureRequestsRoute,
  featureRequestsSnapshot,
} from "../../../../src/application/feature-requests";
import { rebuildNoteIndex } from "../../../../src/application/notes";
import { projectById } from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import { find, first, second, withProject } from "./knowledge-fixture";

type Fixture = Parameters<Parameters<typeof withProject>[0]>[0];
const pbi = "UC-09";
const pbiTitle = "Export service cases";
const requestId = "feature-request-33333333-3333-4333-8333-000000000024";
const packagedCase = {
  id: "AC-01",
  text: "Only requested cases",
  scenario_id: "SC-01",
  scenario_name: "Export",
  given: "The selection is ready",
  when: "Export starts",
  then_step: "Only selected data is written",
};
const acceptedId = "feature-request-33333333-3333-4333-8333-000000000030";
const missingId = "feature-request-33333333-3333-4333-8333-000000000031";
const el = (id: string) => `[data-testid="${id}"]`;
const row = (id: string) => `[data-request-row="${id}"]`;
const link = (id: string) => `[data-request-link="${id}"]`;
const field = (name: string) => el("request-form") + ` [name="${name}"]`;
const press = (root: HTMLElement, selector: string) => find(root, selector).click();

const click = (root: HTMLElement, selector: string) =>
  eventually(() => {
    const control = find<HTMLButtonElement>(root, selector);
    expect(control.disabled).toBe(false);
    control.click();
  });

const text = (root: HTMLElement, selector: string, value: string) =>
  eventually(() => expect(find(root, selector).textContent).toContain(value));

function fill(root: HTMLElement, name: string, value: string, event = "input") {
  const control = find<HTMLInputElement>(root, field(name));
  control.value = value;
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

async function seed(context: Fixture, withRequests = false) {
  const { host } = context;
  const run = host.runtime.runPromise.bind(host.runtime);
  const project = await run(projectById(first));
  if (!project) throw new Error("Missing project fixture");
  await run(
    host.notes.seed(project.folder + "/UC-09.md", {
      schema: "product-engineering.backlog/v1",
      id: "backlog-33333333-3333-4333-8333-000000000009",
      project_id: first,
      "pe-id": pbi,
      type: "PBI",
      title: pbiTitle,
      status: "Open",
    }),
  );
  if (withRequests) {
    const records = [
      [requestId, "FR-024", 24, "CSV export · Service cases", "review", pbi, undefined],
      [acceptedId, "FR-030", 30, "Accepted scope", "accepted", pbi, undefined],
      [missingId, "FR-031", 31, "Earlier scope", "released", "UC-88", "dispatch-evidence"],
    ] as const;
    await Promise.all(
      records.map(([id, displayId, sequence, title, state, pbiId, blocker]) =>
        run(
          host.notes.seed(project.folder + "/" + displayId + ".md", {
            schema: "product-engineering.feature-request/v1",
            id,
            project_id: first,
            display_id: displayId,
            pbi_id: pbiId,
            title,
            state,
            scope: "Selected cases",
            sequence,
            revision: 2,
            blocker,
            ...(id === requestId && {
              run_id: "RUN-042",
              done_gates: [
                { id: "base-done", status: "passed" },
                { id: "base-review", status: "open" },
                { id: "extra", title: "Bugs settled", status: "passed" },
              ],
            }),
          }),
        ),
      ),
    );
  }
  await run(rebuildNoteIndex);
}

it("shows scope, verified gate fixture, and missing evidence in exact filtered routes", async () => {
  await withProject(async (context) => {
    const { root, navigation } = context;
    await seed(context, true);
    await navigation.navigate(featureRequestsRoute(first, { stage: "review" }));
    await text(root, el("request-filter-count"), "1 of 3 Requests");
    const rowSelector = row("FR-024");
    expect(find(root, rowSelector).textContent).toContain("RUN-042");
    expect(find(root, rowSelector).textContent).toContain("FR-024 · Revision 2");
    const gates = rowSelector + " " + el("request-row-gates");
    await text(root, gates, "Done · 2/3 met");
    find(root, gates).focus();
    press(root, gates);
    await text(root, el("request-gates"), "Bugs settled");
    expect(find(root, el("request-gates")).textContent).toContain("2/3 met");
    press(root, el("request-return"));
    await eventually(() => expect(document.activeElement).toBe(find(root, gates)));
    press(root, el("request-show-all"));
    await text(root, row("FR-030"), "Accepted scope");
    await navigation.navigate(featureRequestsRoute(first, { stage: "factory" }));
    await text(root, el("request-empty"), "There are no Feature Requests in this delivery stage.");
    await navigation.navigate(featureRequestsRoute(first, { stage: "blocked" }));
    await text(root, row("FR-031"), "The dispatch evidence is missing.");
    await text(root, row("FR-031"), "This PBI is unavailable in this project.");
    press(root, row("FR-031") + " " + el("request-row-title"));
    await text(root, el("request-detail"), "This PBI is unavailable in this project.");
    expect(root.querySelector(el("request-detail-pbi"))).toBeNull();
    press(root, el("request-toggle-gates"));
    await text(root, el("request-gates"), "Evidence unavailable");
    navigation.reset(featureRequestsRoute(first, { requestId: requestId, stage: "review" }));
    await text(root, el("request-detail"), "CSV export");
    press(root, el("request-return"));
    await text(root, el("request-filter-count"), "1 of 3 Requests");
    await navigation.navigate(featureRequestsRoute(second, { requestId }));
    await text(root, el("request-empty"), "This Feature Request is unavailable in this project.");
  });
});

it("opens the canonical PBI editor from an empty register and validates, retries and reads the shared draft", async () => {
  await withProject(async (context) => {
    const { root, host, navigation } = context;
    await navigation.navigate(featureRequestsRoute(first));
    await text(root, el("request-empty"), "Feature Requests appear here");
    const create = el("request-create");
    await click(root, create);
    await text(root, el("request-form"), "A Feature Request requires a PBI");
    press(root, el("request-create-pbi"));
    await text(root, el("backlog-form"), "Title");
    press(root, el("backlog-cancel"));
    await eventually(() => expect(document.activeElement).toBe(find(root, create)));

    await seed(context);
    await click(root, create);
    await click(root, el("request-save"));
    await text(root, el("request-form"), "Select a PBI available in this project.");
    expect(document.activeElement).toBe(find(root, field("pbiId")));
    fill(root, "pbiId", pbi, "change");
    fill(root, "scope", "");
    press(root, el("request-save"));
    await text(root, el("request-form"), "Enter a delivery scope");
    fill(root, "scope", "Include confirmed cases.");
    host.notes.setFailWrites(true);
    press(root, el("request-save"));
    await eventually(() =>
      expect(find(root, el("request-form")).querySelector("[role=alert]")).toBeTruthy(),
    );
    host.notes.setFailWrites(false);
    await click(root, el("request-save"));
    await text(root, el("request-detail"), pbiTitle);
    await text(root, el("request-scope"), "Include confirmed cases.");
    const records = (await host.runtime.runPromise(featureRequestsSnapshot(first))).records;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ title: pbiTitle, pbiId: pbi, state: "draft" });
    press(root, el("request-edit-scope"));
    const selector = el("request-scope-form") + " textarea";
    const editor = await eventually(() => find<HTMLTextAreaElement>(root, selector));
    expect(document.activeElement).toBe(editor);
    editor.value = " ";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    press(root, el("request-save-scope"));
    await text(root, el("request-scope-form"), "Enter a delivery scope");
    expect(document.activeElement).toBe(editor);
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await eventually(() =>
      expect(document.activeElement).toBe(find(root, el("request-edit-scope"))),
    );
    press(root, el("request-edit-scope"));
    const replacement = await eventually(() => find<HTMLTextAreaElement>(root, selector));
    replacement.value = "Only the confirmed CSV rows";
    replacement.dispatchEvent(new Event("input", { bubbles: true }));
    press(root, el("request-save-scope"));
    await text(root, el("request-scope"), "Only the confirmed CSV rows");
    press(root, el("request-toggle-gates"));
    await text(root, el("request-gates"), "0/2 met");
    expect(find(root, el("request-prepare")).textContent).toContain("Link a PRD requirement");
    press(root, el("request-prepare"));
    await text(root, el("pbi-tab-edit"), "Edit");
    expect(navigation.current()).toEqual(pbiDetailRoute(first, pbi, "edit"));
  });
});

it("reads recorded empty scope and associated technical and business evidence from a mounted historical revision", async () => {
  await withProject(async (context) => {
    const { root, host, navigation } = context;
    await seed(context);
    const commit = "a".repeat(40);
    const identity = {
      projectId: first,
      requestId,
      revision: 2,
      checksum: "b".repeat(64),
      runId: "LOCAL-TEST",
      attempt: 2,
      provider: "local-fixture",
    };
    const packagePayload = {
      schemaVersion: 1,
      request: {
        projectId: first,
        id: requestId,
        displayId: "FR-024",
        title: "Frozen export",
        revision: 2,
      },
      scope: "Frozen scope",
      useCase: {
        id: pbi,
        displayId: pbi,
        title: pbiTitle,
        markdown: "## Old content",
        criteria: [packagedCase],
      },
      attachments: [
        {
          id: "knowledge-33333333-3333-4333-8333-000000000010",
          displayId: "PRD-03",
          title: "Reviewed export",
          kind: "prd",
          markdown: "Pinned note Markdown",
          commit,
        },
      ],
      nfrs: [],
      domain: { entities: [], edges: [], neighbors: [] },
      gherkin: "Scenario: Export",
    };
    const data = {
      current: { events: [] },
      history: [
        {
          revision: 2,
          title: "Frozen export",
          scope: "Frozen scope",
          state: "accepted",
          runId: "LOCAL-TEST",
          run: identity,
          exportJson: canonicalRequestJson({ package: packagePayload }),
          events: [
            {
              ...identity,
              id: "verified-test",
              kind: "verified",
              result: {
                pullRequest: "LOCAL-PR",
                commit,
                technicalReview: { verdict: "approved", commit },
                evidence: [
                  {
                    criterionId: "AC-01",
                    scenarioId: "SC-01",
                    commit,
                    outcome: "passed",
                    checkId: "check-1",
                  },
                ],
              },
            },
          ],
          decision: {
            decision: "accepted",
            runId: "LOCAL-TEST",
            attempt: 2,
            commit,
            explanation: "Verified selection",
          },
        },
      ],
    };
    await host.runtime.runPromise(
      host.notes.seed("Projects/Kundenportal/FR-024.md", {
        schema: "product-engineering.feature-request/v1",
        id: requestId,
        project_id: first,
        display_id: "FR-024",
        title: "Live draft",
        state: "draft",
        pbi_id: pbi,
        scope: "Live scope",
        sequence: 24,
        revision: 3,
        delivery_data: canonicalRequestJson(data),
      }),
    );
    await host.runtime.runPromise(rebuildNoteIndex);
    await navigation.navigate(featureRequestsRoute(first, { requestId }));
    await text(root, el("request-state"), "Draft");
    press(root, '[data-history-revision="2"]');
    await text(root, el("request-state"), "Accepted");
    await text(root, el("request-scope"), "Frozen scope");
    await text(root, el("request-nfrs"), "No entries in this scope");
    await text(root, el("request-domain"), "No entries in this scope");
    await text(root, '[data-attachment="PRD-03"]', "Pinned note Markdown");
    press(root, el("request-tab-run"));
    await text(root, el("request-run"), "Attempt 2");
    await text(root, el("request-run"), "Local Factory simulation");
    await text(root, el("request-technical-result"), "LOCAL-PR");
    press(root, el("request-tab-evidence"));
    await text(root, el("request-evidence"), "Verified selection");
    expect(find(root, el("request-evidence")).textContent).toContain("Technically approved");
    await text(root, '[data-evidence-criterion="AC-01"]', "SC-01");
    press(root, el("request-current-revision"));
    await text(root, el("request-scope"), "Live scope");
  });
});

it("reopens active and accepted links with isolated Board, List and PBI return targets", async () => {
  await withProject(async (context) => {
    const { root, navigation } = context;
    await seed(context, true);
    await navigation.navigate(backlogBoardRoute(first));
    await text(root, '[data-board-stage="In Development"] [data-board-card=UC-09]', "CSV export");
    press(root, link("FR-024"));
    await text(root, el("request-return"), "Back to Board");
    expect(navigation.current()).toMatchObject({
      origin: { kind: "board", context: { pbiId: pbi } },
    });
    press(root, el("request-return"));
    await eventually(() => expect(document.activeElement).toBe(find(root, link("FR-024"))));
    await navigation.navigate(backlogRoute(first));
    await click(root, link("FR-024"));
    await text(root, el("request-return"), "Back to List");
    press(root, el("request-return"));
    await eventually(() => expect(document.activeElement).toBe(find(root, link("FR-024"))));
    await navigation.navigate(pbiDetailRoute(first, pbi, "links"));
    await text(root, el("pbi-factory-status"), "In Review");
    await eventually(() =>
      expect(find(root, el("pbi-request-links")).querySelector("summary")).toBeTruthy(),
    );
    press(root, el("pbi-request-links") + " summary");
    press(root, link("FR-030"));
    await text(root, el("request-detail"), "Accepted scope");
    await text(root, el("request-return"), "Back to PBI");
    press(root, el("request-return"));
    await eventually(() => expect(document.activeElement).toBe(find(root, link("FR-030"))));
  });
});
