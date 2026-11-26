import { Result } from "effect";
import { expect, it } from "vitest";
import { backlogRoute, pbiDetailRoute } from "../../../../src/application/backlog";
import {
  confirmRequestReady,
  dispatchFeatureRequest,
  prepareRequestFollowup,
  readRequestPackagePreview,
  readReviewWorkspace,
  releaseFeatureRequest,
  requestReviewChange,
  reviewsRoute,
  simulateFactoryEvent,
} from "../../../../src/application/feature-requests";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { rebuildNoteIndex } from "../../../../src/application/notes";
import { createProject } from "../../../../src/application/projects";
import type { ProjectId } from "../../../../src/application/projects";
import { EventBus } from "../../../../src/application/shell";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { readTrace, readTraceSources, traceRoute } from "../../../../src/application/trace";
import {
  criterion,
  deliveryFixture,
  manual,
  pbiId,
  prd,
  project,
  request,
  sha,
} from "../../../support/request-delivery-fixture";
import { mountApp } from "../../../support/surface";
import { eventually } from "../../../support/wait";
import { find, second } from "./knowledge-fixture";

const el = (id: string) => `[data-testid="${id}"]`;
const vision = "knowledge-33333333-3333-4333-8333-000000000473";
const sharedResearch = "knowledge-33333333-3333-4333-8333-000000000472";
const mapId = "story-map-33333333-3333-4333-8333-000000000071";
const secondMapId = "story-map-33333333-3333-4333-8333-000000000072";

function pbi(id: string, rank: number, title: string) {
  return {
    "pe-id": id,
    type: "PBI",
    title,
    order: rank,
  };
}

function map(id: string, withSlice: boolean) {
  return {
    schema: "product-engineering.story-map/v1",
    id,
    project_id: project,
    display_id: withSlice ? "SM-01" : "SM-02",
    title: withSlice ? "Route 1" : "Route 2",
    persona: "Service coordinator",
    goal: "Hand over a filtered list",
    activities: [{ id: "ACT-01", title: "Activity" }],
    steps: [{ id: "STEP-01", title: "Step", activityId: "ACT-01" }],
    slices: withSlice ? [{ id: "SL-01", title: "First release", outcome: "Delivery" }] : [],
    cards: [
      {
        id: "CARD-03",
        stepId: "STEP-01",
        title: "CSV from filters",
        ...(withSlice && { sliceId: "SL-01" }),
      },
    ],
    card_links: [{ cardId: "CARD-03", kind: "item", projectId: project, recordId: pbiId }],
  };
}

type Fixture = Awaited<ReturnType<typeof deliveryFixture>>;

async function patch(f: Fixture, path: string, fields: Record<string, unknown>) {
  await f.run(f.store.update(path, () => Result.succeed({ set: fields })));
  await f.run(rebuildNoteIndex);
}

async function mountTrace(f: Fixture, selected: ProjectId = project) {
  const root = document.body.appendChild(document.createElement("div"));
  const view = await mountApp(root, f.host.runtime, { initial: traceRoute(selected) });
  return {
    root,
    view,
    node: (id: string) => find(root, el(id)),
    matches: (id: string, value: string) =>
      eventually(() => expect(find(root, el(id)).textContent).toContain(value)),
    async close() {
      view.close();
      root.remove();
      await f.host.runtime.dispose();
    },
  };
}

it("opens an empty project's Backlog and scopes ranked PBI sources, shared research and multiple exact cards", async () => {
  const f = await deliveryFixture("en");
  const other = await f.run(
    createProject(second, { name: "Other", description: "Isolated", repository: "team/other" }),
  );
  const ui = await mountTrace(f, second);
  try {
    await ui.matches("trace-workspace", "This project has no PBIs yet");
    ui.node("trace-empty-backlog").click();
    await eventually(() => expect(ui.view.navigation.current()).toEqual(backlogRoute(second)));

    const folder = f.p.folder;
    await patch(f, f.prdPath, { vision_id: vision });
    await patch(f, folder + "/UC-09.md", { order: 5 });
    await f.seed(
      folder + "/Legacy.md",
      { ...pbi("UC-14", 20, "Imported legacy"), project_id: project },
      "",
    );
    await f.seed(
      folder + "/UC-12.md",
      {
        ...pbi("UC-12", 10, "Understand an empty list"),
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000078",
        project_id: project,
        pbi_research_id: sharedResearch,
      },
      "",
    );
    await f.seed(
      other.folder + "/UC-09.md",
      {
        ...pbi(pbiId, 1, "Foreign CSV export"),
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000079",
        project_id: second,
        pbi_prd_id: prd,
        pbi_requirement_id: "REQ-03",
      },
      "",
    );
    await f.seed(folder + "/SM-01.md", map(mapId, true), "");
    await f.seed(folder + "/SM-02.md", map(secondMapId, false), "");
    await f.run(rebuildNoteIndex);
    await ui.view.navigation.navigate(traceRoute(project));
    await ui.matches("trace-source", "PRD-03#REQ-03");
    await ui.matches("trace-source", "VIS-01");
    await ui.matches("trace-source", "SL-01 · First release");
    await ui.matches("trace-source", "No delivery slice");
    await ui.matches("trace-source", sha);
    expect(await f.run(readTraceSources(project, pbiId))).toMatchObject({
      gaps: [],
      maps: [{ map: { id: mapId } }, { map: { id: secondMapId } }],
    });
    expect(await f.run(readTraceSources(second, "UC-12"))).toBeUndefined();
    expect(await f.run(readTrace(second, pbiId))).toMatchObject({
      projectId: second,
      delivery: undefined,
      source: { maps: [], requirement: undefined },
    });
    const select = ui.node("trace-pbi") as HTMLSelectElement;
    expect(Array.from(select.options).map(({ value }) => value)).toEqual([pbiId, "UC-12", "UC-14"]);

    ui.node("trace-source-requirement").click();
    await eventually(() =>
      expect(ui.view.navigation.current()).toEqual(
        knowledgeDetailRoute(project, prd, { section: "trace" }),
      ),
    );
    await eventually(() => expect(find(ui.root, el("project-record-return"))).toBeTruthy());
    ui.node("project-record-return").click();
    await eventually(() =>
      expect(document.activeElement).toBe(ui.node("trace-source-requirement")),
    );
    const card = find(ui.root, '[data-pe-focus-key="trace-card-' + secondMapId + '-CARD-03"]');
    card.click();
    await eventually(() =>
      expect(ui.view.navigation.current()).toEqual(storyMapsRoute(project, secondMapId, "CARD-03")),
    );
    await ui.view.navigation.back();
    await ui.matches("trace-source", "SM-02:CARD-03");

    const currentSelect = ui.node("trace-pbi") as HTMLSelectElement;
    currentSelect.focus();
    const historyBeforeSelection = ui.view.navigation.history();
    currentSelect.value = "UC-12";
    currentSelect.dispatchEvent(new Event("change"));
    await ui.matches("trace-source", "RES-01");
    await ui.matches("trace-gap", "Job to Be Done is missing");
    expect(ui.view.navigation.history()).toEqual({
      ...historyBeforeSelection,
      current: traceRoute(project, "UC-12"),
    });
    expect(document.activeElement).toBe(currentSelect);
    expect(ui.node("trace-source").textContent).not.toContain("VIS-01");
    expect(ui.node("trace-delivery").textContent).not.toContain("FR-001");
    ui.node("trace-gap-pbi").click();
    await eventually(() =>
      expect(ui.view.navigation.current()).toEqual(pbiDetailRoute(project, "UC-12")),
    );
    await ui.view.navigation.back();
    await ui.matches("trace-gap", "Job to Be Done is missing");
    const next = ui.node("trace-pbi") as HTMLSelectElement;
    expect(next.value).toBe("UC-12");
    next.value = "UC-14";
    next.dispatchEvent(new Event("change"));
    await ui.matches("trace-gap", "unambiguous identity");
    ui.node("trace-gap-pbi").click();
    await eventually(() =>
      expect(ui.view.navigation.current()).toEqual(backlogRoute(project, "UC-14")),
    );
  } finally {
    await ui.close();
  }
});

it("persists the exact change finding and shows stale, earlier evidence separately from a draft's replacement scenario", async () => {
  const f = await deliveryFixture("en");
  const ui = await mountTrace(f);
  try {
    await ui.matches("trace-delivery", "Revision 1");
    await ui.matches("trace-criteria", criterion.text);
    await f.run(confirmRequestReady(await f.record(), manual, 3, true));
    const draft = await f.record();
    await f.run(
      releaseFeatureRequest(draft, (await f.run(readRequestPackagePreview(draft))).basis),
    );
    await f.run(dispatchFeatureRequest(await f.record()));
    await f.run(simulateFactoryEvent(await f.record(), "pickup"));
    await f.run(simulateFactoryEvent(await f.record(), "verify"));
    const review = await f.run(readReviewWorkspace(project, request, 1));
    if (!review?.target) throw new Error("Missing exact review target");
    await ui.matches("trace-review", review.target.commit);
    await ui.matches("trace-criteria", "local:1:SC-09");
    const finding = "Include the confirmed date in the exported filename.";
    await f.run(requestReviewChange(review.target, finding));
    await ui.matches("trace-reason", finding);

    f.dirty.add(f.prdPath);
    await f.run(
      EventBus.use((bus) =>
        bus.publish({ _tag: "FileModified", path: f.prdPath, extension: "md" }),
      ),
    );
    await ui.matches("trace-stale", "Evidence is stale");
    expect(ui.node("trace-reason").textContent).toBe(finding);
    await f.run(prepareRequestFollowup(await f.record()));
    await patch(f, f.p.folder + "/UC-09.md", {
      pbi_criteria: [
        { ...criterion, scenario_id: "SC-44", text: "A replacement criterion with the same AC ID" },
      ],
    });
    await ui.matches("trace-criteria", "A replacement criterion with the same AC ID");
    await ui.matches("trace-criteria", "SC-44");
    await ui.matches("trace-delivery", "Test commit pending");
    expect(ui.node("trace-criteria").textContent).not.toContain("local:1:SC-09");
    expect(ui.node("trace-delivery").textContent).not.toContain(finding);
    await ui.matches("trace-earlier", "Earlier evidence · FR-001 · Revision 1");
    await ui.matches("trace-earlier", "local:1:SC-09");
    await ui.matches("trace-earlier", finding);
    await ui.matches("trace-earlier", review.target.commit);
    await ui.matches("trace-earlier", "Evidence is stale");
    ui.node("trace-earlier-review").click();
    await eventually(() =>
      expect(ui.view.navigation.current()).toEqual(
        reviewsRoute(project, { requestId: request, revision: 1 }),
      ),
    );
  } finally {
    await ui.close();
  }
});
