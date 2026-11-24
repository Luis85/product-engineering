import { expect, it } from "vitest";
import { backlogSnapshot, pbiDetailRoute } from "../../../../src/application/backlog";
import type { BacklogItem } from "../../../../src/application/backlog";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { rebuildNoteIndex } from "../../../../src/application/notes";
import { projectById, projectOverviewRoute } from "../../../../src/application/projects";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { readOverviewPreparation } from "../../../../src/application/trace";
import { deliveryFixture, pbiId, project } from "../../../support/request-delivery-fixture";
import { eventually } from "../../../support/wait";
import {
  find,
  first,
  jobOne,
  jobTwo,
  second,
  seedFoundations,
  vision,
  withProject,
} from "./knowledge-fixture";

const prd = "knowledge-33333333-3333-4333-8333-000000000150";
const legacyPrd = "knowledge-33333333-3333-4333-8333-000000000151";
const mainMap = "story-map-33333333-3333-4333-8333-000000000152";
const alternateMap = "story-map-33333333-3333-4333-8333-000000000153";
const slice = "SL-01";
const step = (id: string) => `[data-overview-step="${id}"]`;
const nextAction = '[data-pe-focus-key="overview-next-step"]';
const selector = '[data-testid="overview-context"]';
const pbiLink = '[data-testid="overview-slice-pbi"]';

type Fixture = Parameters<Parameters<typeof withProject>[0]>[0];

function seedPrd({ host }: Fixture, folder: string, valid: boolean) {
  const displayId = valid ? "PRD-03" : "PRD-04";
  return host.runtime.runPromise(
    host.notes.seed(folder + "/" + displayId + ".md", {
      schema: "product-engineering.knowledge/v1",
      project_id: first,
      id: valid ? prd : legacyPrd,
      display_id: displayId,
      kind: "prd",
      title: valid ? "Work handoff" : "Unfinished requirement",
      ...(valid && { requirement_id: "REQ-18", vision_id: vision, job_ids: [jobOne] }),
    }),
  );
}

function seedMap({ host }: Fixture, folder: string, alternate: boolean, deferred = false) {
  const displayId = alternate ? "SM-02" : "SM-01";
  return host.runtime.runPromise(
    host.notes.seed(folder + "/" + displayId + ".md", {
      schema: "product-engineering.story-map/v1",
      id: alternate ? alternateMap : mainMap,
      project_id: first,
      display_id: displayId,
      title: alternate ? "Manual check" : "Joined handoff",
      persona: "Service coordinator",
      goal: "Confirm open case status",
      prd_id: prd,
      job_ids: [jobOne],
      activities: [{ id: "ACT-01", title: "Handoff" }],
      steps: [{ id: "STEP-01", title: "Check cases", activityId: "ACT-01" }],
      ...(alternate
        ? { slices: [], cards: [] }
        : {
            slices: [{ id: slice, title: "First usable slice", outcome: "Confirmed cases" }],
            cards: ["CARD-01", "CARD-02", "CARD-03"].map((id) => ({
              id,
              title: `Story ${id}`,
              stepId: "STEP-01",
              sliceId: slice,
            })),
            card_links: [
              { cardId: "CARD-01", kind: "item", projectId: first, recordId: pbiId },
              { cardId: "CARD-02", kind: "item", projectId: first, recordId: pbiId },
              { cardId: "CARD-03", kind: "item", projectId: second, recordId: pbiId },
            ],
            slice_deferrals: deferred
              ? [{ cardId: "CARD-03", sliceId: slice, decision: "deferred" }]
              : [],
          }),
    }),
  );
}

const text = (root: HTMLElement, locator: string, value: string) =>
  eventually(() => expect(find(root, locator).textContent).toContain(value));

async function choose(root: HTMLElement, key: string) {
  const select = await eventually(() => find<HTMLSelectElement>(root, selector));
  select.focus();
  select.value = key;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await eventually(() => expect(find<HTMLSelectElement>(root, selector).value).toBe(key));
  expect(document.activeElement).toBe(select);
}

it("keeps a shared PBI once, requires all slice dispositions, and opens the selected branch's exact next step", async () => {
  await withProject(async (fixture) => {
    const { root, host, navigation } = fixture;
    const scope = await host.runtime.runPromise(projectById(first));
    if (!scope) throw new Error("Missing project folder");
    await seedFoundations(host);
    await Promise.all([
      seedPrd(fixture, scope.folder, true),
      seedPrd(fixture, scope.folder, false),
      seedMap(fixture, scope.folder, false),
      seedMap(fixture, scope.folder, true),
      host.runtime.runPromise(
        host.notes.seed(scope.folder + "/UC-09.md", {
          schema: "product-engineering.backlog/v1",
          id: "backlog-33333333-3333-4333-8333-000000000154",
          project_id: first,
          "pe-id": pbiId,
          title: "One reusable PBI",
          type: "PBI",
        }),
      ),
    ]);
    await host.runtime.runPromise(rebuildNoteIndex);
    await text(root, step("handoff"), "2 of 3 Stories linked or deferred");
    expect(root.querySelectorAll(pbiLink)).toHaveLength(1);
    expect(find(root, step("handoff")).getAttribute("aria-current")).toBe("step");
    await text(root, step("slice"), "Confirmed cases");
    await text(root, step("prd"), "REQ-18");
    await text(root, step("vision"), "A clear customer journey");

    await seedMap(fixture, scope.folder, false, true);
    await host.runtime.runPromise(rebuildNoteIndex);
    await text(root, step("handoff"), "3 of 3 Stories linked or deferred");
    expect(root.querySelectorAll(pbiLink)).toHaveLength(1);
    expect(root.querySelector(nextAction)).toBeNull();
    find(root, pbiLink).click();
    await eventually(() => expect(navigation.current()).toEqual(pbiDetailRoute(first, pbiId)));
    await navigation.back();

    await choose(root, alternateMap);
    await text(root, nextAction, "Plan a delivery slice");
    expect(find(root, step("map")).textContent).toContain("Manual check");
    expect(root.querySelector(pbiLink)).toBeNull();
    expect(navigation.current()).toEqual(projectOverviewRoute(first, alternateMap));
    find(root, nextAction).click();
    await eventually(() =>
      expect(navigation.current()).toEqual(storyMapsRoute(first, alternateMap)),
    );
    await navigation.back();
    await eventually(() => expect(document.activeElement).toBe(find(root, nextAction)));

    await choose(root, legacyPrd);
    await text(root, step("prd"), "A requirement is missing from this PRD");
    await text(root, step("job"), "No Job is linked");
    await text(root, nextAction, "Review the requirement");
    find(root, nextAction).click();
    await eventually(() =>
      expect(navigation.current()).toEqual(
        knowledgeDetailRoute(first, legacyPrd, { section: "overview" }),
      ),
    );
    await navigation.back();
    await choose(root, jobTwo);
    await text(root, step("job"), "Trace an approval");
    await text(root, nextAction, "Develop the PRD");
    expect(find(root, step("vision")).textContent).toContain("A clear customer journey");
  });
});

function alternative(item: BacklogItem, key: string, fields: BacklogItem["fields"]): BacklogItem {
  return { ...item, key, fields: { ...item.fields, ...fields } };
}

it("checks bounded indexed preparation for scoped sources, scenarios and approval", async () => {
  const fixture = await deliveryFixture("en");
  const { host, run } = fixture;
  try {
    const item = (await run(backlogSnapshot(project))).items.find(({ id }) => id === pbiId);
    if (!item) throw new Error("Missing indexed PBI fixture");
    const rows = [
      item,
      alternative(item, "wrong-source", { pbi_requirement_id: "REQ-99" }),
      alternative(item, "other-project", { project_id: second }),
      alternative(item, "research-missing", { pbi_research_id: "" }),
      alternative(item, "criterion-missing", { pbi_criteria: [] }),
      alternative(item, "not-approved", { pbi_approved_revision: undefined }),
    ];
    const read = (items: readonly BacklogItem[]) => run(readOverviewPreparation(project, items));
    const prepared = await read(rows);
    expect(prepared.get(item.key)).toEqual({ destination: pbiDetailRoute(project, pbiId) });
    expect(prepared.get("wrong-source")?.reason).toBe("prd");
    expect(prepared.get("other-project")?.reason).toBe("identity");
    expect(prepared.get("research-missing")?.reason).toBe("research");
    expect(prepared.get("criterion-missing")?.reason).toBe("criteria");
    expect(prepared.get("not-approved")?.reason).toBe("approval");

    host.notes.setFailReads(true);
    expect((await read([item])).get(item.key)?.reason).toBe("unavailable");
  } finally {
    host.notes.setFailReads(false);
    await host.runtime.dispose();
  }
});
