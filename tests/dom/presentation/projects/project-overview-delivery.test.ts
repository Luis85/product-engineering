import { expect, it } from "vitest";
import {
  backlogBoardRoute,
  backlogSnapshot,
  pbiDetailRoute,
} from "../../../../src/application/backlog";
import { featureRequestsRoute } from "../../../../src/application/feature-requests";
import { rebuildNoteIndex } from "../../../../src/application/notes";
import { projectById, projectOverviewRoute } from "../../../../src/application/projects";
import { deliveryStages } from "../../../../src/domain/feature-requests";
import { eventually } from "../../../support/wait";
import { find, first, second, withProject } from "./knowledge-fixture";

type Fixture = Parameters<Parameters<typeof withProject>[0]>[0];
type RequestState = "accepted" | "draft" | "released" | "review" | "running";

const testId = (id: string) => `[data-testid="${id}"]`;
const action = testId("overview-featured-action");
const phase = testId("overview-featured");
const tasks = testId("overview-tasks") + " li";
const metric = (stage: string) => `[data-overview-stage="${stage}"]`;
const folder = "Projects/Kundenportal/";
const tail = (sequence: number) => String(sequence).padStart(12, "0");
const requestId = (sequence: number) =>
  `feature-request-33333333-3333-4333-8333-${tail(sequence)}` as const;

function seedRequest(
  { host }: Fixture,
  sequence: number,
  state: RequestState,
  options: { readonly pbi?: string; readonly delivery?: string; readonly foreign?: boolean } = {},
) {
  const displayId = "FR-" + String(sequence).padStart(3, "0");
  const projectId = options.foreign ? second : first;
  return host.runtime.runPromise(
    host.notes.seed(folder + displayId + ".md", {
      schema: "product-engineering.feature-request/v1",
      id: requestId(sequence),
      project_id: projectId,
      display_id: displayId,
      pbi_id: options.pbi ?? "UC-09",
      title: `Scope ${displayId}`,
      state,
      scope: "Only the requested cases are in scope.",
      sequence,
      revision: 2,
      ...(options.delivery && { delivery_data: options.delivery }),
    }),
  );
}

function seedPbi(
  { host }: Fixture,
  projectFolder: string,
  id: number,
  order: number,
  status: "Open" | "Done",
) {
  const displayId = "UC-" + String(id).padStart(2, "0");
  return host.runtime.runPromise(
    host.notes.seed(projectFolder + "/" + displayId + ".md", {
      schema: "product-engineering.backlog/v1",
      id: `backlog-33333333-3333-4333-8333-${tail(id)}`,
      project_id: first,
      "pe-id": displayId,
      type: "PBI",
      title: `Work ${displayId}`,
      status,
      order,
    }),
  );
}

const reindex = ({ host }: Fixture) => host.runtime.runPromise(rebuildNoteIndex);
const headline = (root: HTMLElement, text: string) =>
  eventually(() => expect(find(root, phase + " h2").textContent).toBe(text));
const count = (root: HTMLElement, stage: string, expected: number) =>
  eventually(() =>
    expect(find(root, metric(stage) + " strong").textContent).toBe(String(expected)),
  );

function activate(root: HTMLElement, selector: string) {
  const control = find<HTMLButtonElement>(root, selector);
  control.focus();
  control.click();
}

it("keeps empty planning first and opens authoritative zero-result delivery filters", async () => {
  await withProject(async ({ root, navigation }) => {
    const planning = testId("project-overview-planning");
    await eventually(() =>
      expect(find(root, planning + " h2").textContent).toContain("From Job to Backlog"),
    );
    expect(root.querySelector(testId("overview-delivery"))).toBeNull();
    const disclosure = find<HTMLDetailsElement>(root, ".pe-overview-disclosure");
    activate(root, ".pe-overview-disclosure summary");
    expect(disclosure.open).toBe(true);
    await headline(root, "Prepare product work");
    await Promise.all(deliveryStages.map((stage) => count(root, stage, 0)));

    activate(root, metric("review"));
    await eventually(() =>
      expect(find(root, testId("request-filter-count")).textContent).toBe("0 of 0 Requests"),
    );
    expect(navigation.current()).toEqual(featureRequestsRoute(first, { stage: "review" }));
    await navigation.back();
    await eventually(() => expect(document.activeElement).toBe(find(root, metric("review"))));
    activate(root, action);
    await eventually(() => expect(navigation.current()).toEqual(backlogBoardRoute(first)));
  });
});

it("prefers the leading open PBI over past acceptance and offers the exact accepted filter when work is done", async () => {
  await withProject(async (fixture) => {
    const { root, navigation, host } = fixture;
    const project = await host.runtime.runPromise(projectById(first));
    if (!project) throw new Error("Missing overview project fixture");
    await Promise.all([
      seedRequest(fixture, 24, "accepted"),
      seedPbi(fixture, project.folder, 9, 100, "Done"),
      seedPbi(fixture, project.folder, 21, 300, "Open"),
      seedPbi(fixture, project.folder, 17, 200, "Open"),
    ]);
    await reindex(fixture);
    const backlog = await host.runtime.runPromise(backlogSnapshot(first));
    expect(backlog.items.map(({ id }) => id)).toEqual(["UC-09", "UC-17", "UC-21"]);
    await headline(root, "Prepare the next PBI");
    await eventually(() => expect(find(root, phase + " p").textContent).toContain("UC-17"));
    activate(root, action);
    await eventually(() => expect(navigation.current()).toEqual(pbiDetailRoute(first, "UC-17")));
    await navigation.back();
    await Promise.all([
      seedPbi(fixture, project.folder, 17, 200, "Done"),
      seedPbi(fixture, project.folder, 21, 300, "Done"),
    ]);
    await reindex(fixture);
    await headline(root, "Acceptance recorded");
    expect(find(root, phase + " p").textContent).toBe("1 request has been accepted.");
    activate(root, action);
    await eventually(() =>
      expect(find(root, testId("request-filter-count")).textContent).toBe("1 of 1 Requests"),
    );
    expect(find(root, "[data-request-row=FR-024]").textContent).toContain("Scope FR-024");
  });
});

it("orders ready, active and draft actions by phase and shows five unique scoped alternatives", async () => {
  await withProject(async (fixture) => {
    const { root, navigation } = fixture;
    await Promise.all([
      seedRequest(fixture, 24, "released"),
      seedRequest(fixture, 25, "running"),
      ...[26, 27, 28, 29, 30, 31].map((sequence) => seedRequest(fixture, sequence, "draft")),
      seedRequest(fixture, 41, "running", { foreign: true }),
    ]);
    await reindex(fixture);
    await headline(root, "A package is ready for Factory");
    await eventually(() => {
      const otherActions = [...root.querySelectorAll(tasks)].map((row) => row.textContent);
      expect(otherActions).toHaveLength(5);
      expect(otherActions[0]).toContain("FR-025");
      expect(otherActions[0]).toContain("Check the Factory run");
      expect(new Set(otherActions).size).toBe(5);
      expect(otherActions.join(" ")).not.toMatch(/FR-024|FR-041/);
    });
    activate(root, action);
    await eventually(() =>
      expect(navigation.current()).toEqual(
        featureRequestsRoute(first, {
          requestId: requestId(24),
          revision: 2,
          origin: { kind: "overview" },
        }),
      ),
    );
    await navigation.back();
    await seedRequest(fixture, 24, "accepted");
    await reindex(fixture);
    await headline(root, "A request is in the Factory");
    activate(root, action);
    await eventually(() =>
      expect(navigation.current()).toEqual(
        featureRequestsRoute(first, {
          requestId: requestId(25),
          revision: 2,
          tab: "run",
          origin: { kind: "overview" },
        }),
      ),
    );
    await navigation.back();
    await seedRequest(fixture, 25, "accepted");
    await reindex(fixture);
    await headline(root, "A handoff is being prepared");
    activate(root, action);
    await eventually(() =>
      expect(navigation.current()).toEqual(
        featureRequestsRoute(first, {
          requestId: requestId(31),
          revision: 2,
          tab: "gates",
          origin: { kind: "overview" },
        }),
      ),
    );
  });
});

it("keeps invalid modern review and dispatch evidence in the shared blocked filter", async () => {
  await withProject(async (fixture) => {
    const { root, navigation } = fixture;
    const missingEvidence = '{"current":{"events":[]},"history":[]}';
    await Promise.all([
      seedRequest(fixture, 31, "review", { delivery: missingEvidence }),
      seedRequest(fixture, 28, "released", { delivery: missingEvidence }),
      seedRequest(fixture, 25, "running"),
    ]);
    await reindex(fixture);
    await headline(root, "A request needs clarification");
    expect(find(root, phase + " p").textContent).toContain("FR-031");
    expect(find(root, action).textContent).toContain("Check request");
    await count(root, "review", 0);
    await count(root, "ready", 0);
    await count(root, "blocked", 2);
    activate(root, metric("blocked"));
    await eventually(() =>
      expect(find(root, testId("request-filter-count")).textContent).toBe("2 of 3 Requests"),
    );
    expect(navigation.current()).toEqual(featureRequestsRoute(first, { stage: "blocked" }));
    expect(
      [...root.querySelectorAll("[data-request-row]")].map((row) =>
        row.getAttribute("data-request-row"),
      ),
    ).toEqual(["FR-031", "FR-028"]);
    await navigation.navigate(projectOverviewRoute(first));
    await headline(root, "A request needs clarification");
  });
});
