import { expect, it } from "vitest";
import { backlogRoute, pbiDetailRoute } from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { storyMapsRoute, storyMapSliceRoute } from "../../../../src/application/story-maps";
import { eventually } from "../../../support/wait";
import type { testRuntime } from "../../../support/runtime";
import { find, first, withProject } from "./knowledge-fixture";
import {
  field,
  folder,
  gone,
  map,
  mapFields,
  mapPath,
  panel,
  press,
  section,
  shown,
  testId,
  text,
} from "./story-map-ui-fixture";

const prd = "knowledge-33333333-3333-4333-8333-000000000891";
const job = "knowledge-33333333-3333-4333-8333-000000000892";
const review = testId("slice-review");
const entry = testId("story-map-slice-review-first");
const opener = testId("story-map-slice-review-empty");
const row = (id: string) => testId("slice-review-story-" + id);
const action = (root: HTMLElement, id: string, label: string) =>
  section(find(root, row(id)), label);
const feature = '[data-story-item="FE-01"]';

async function seed(host: ReturnType<typeof testRuntime>) {
  const run = host.runtime.runPromise.bind(host.runtime);
  const knowledge = [
    [prd, "Support continuity", "prd", "PRD-01"],
    [job, "Continue a shift", "jtbd", "JOB-01"],
  ];
  await Promise.all(
    knowledge.map(([id, name, kind, no]) =>
      run(
        host.notes.seed(folder + "/" + no + ".md", {
          schema: "product-engineering.knowledge/v1",
          id,
          title: name,
          kind,
          approval: "draft",
          display_id: no,
          project_id: first,
          ...(kind === "prd" && { requirement_id: "REQ-01" }),
        }),
      ),
    ),
  );
  await run(
    host.notes.seed(
      folder + "/FE-01.md",
      {
        schema: "product-engineering.backlog/v1",
        project_id: first,
        type: "Feature",
        "pe-id": "FE-01",
        id: "backlog-33333333-3333-4333-8333-000000000893",
        title: "Next shift",
        order: 2,
      },
      "Preserved",
    ),
  );
  await run(
    host.notes.seed(
      folder + "/UC-01.md",
      {
        schema: "product-engineering.backlog/v1",
        project_id: first,
        type: "PBI",
        "pe-id": "UC-01",
        id: "backlog-33333333-3333-4333-8333-000000000894",
        title: "Earlier work",
        order: 3,
      },
      "Outside item",
    ),
  );
  await run(
    host.notes.seed(mapPath, {
      ...mapFields(),
      prd_id: prd,
      job_ids: [job],
      activities: [{ id: "a", title: "Prepare" }],
      steps: [{ id: "s", activityId: "a", title: "Collect" }],
      slices: [
        { id: "first", title: "Delivery", outcome: "Ready for shift" },
        { id: "empty", title: "Empty" },
      ],
      cards: [
        {
          id: "1",
          stepId: "s",
          sliceId: "first",
          title: "Collect questions",
          description: "Capture gaps",
        },
        { id: "2", stepId: "s", sliceId: "first", title: "Answer questions" },
        { id: "3", stepId: "s", sliceId: "first", title: "Notify user" },
      ],
      card_links: [
        { projectId: first, kind: "item", cardId: "1", recordId: "FE-01" },
        { projectId: first, kind: "item", cardId: "2", recordId: "UC-404" },
      ],
    }),
  );
  await run(rebuildNoteIndex);
}

it("restores review and map focus around native detail routes, cancel, reuse and deferral", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await seed(host);
    await navigation.navigate(storyMapsRoute(first, map));
    await shown(root, entry);
    press(root, entry);
    await shown(root, review);
    expect(navigation.current()).toEqual(storyMapSliceRoute(first, map, "first"));
    await text(root, review, "Ready for shift");
    await text(root, testId("slice-review-count"), "0 of 3 stories with a PBI");
    press(root, row("1") + " " + feature);
    await eventually(() => expect(navigation.current()).toEqual(backlogRoute(first, "FE-01")));
    await shown(root, testId("backlog-return-story-map"));
    press(root, testId("backlog-return-story-map"));
    await shown(root, review);
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, row("1") + " " + feature)),
    );

    action(root, "1", "Create PBI from story").click();
    await shown(root, panel + " [name=title]");
    expect(find<HTMLInputElement>(root, panel + " [name=parent]").value).toBe("FE-01");
    expect(find<HTMLInputElement>(root, panel + " [name=job]").value).toBe(job);
    expect(find<HTMLInputElement>(root, panel + " [name=prd]").value).toContain("REQ-01");
    field(root, "title", "Cancelled");
    press(root, testId("backlog-cancel"));
    await gone(root, panel);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, row("1"))));

    action(root, "1", "Create PBI from story").click();
    await shown(root, panel + " [name=title]");
    field(root, "job", "", "change");
    field(root, "title", "");
    press(root, testId("backlog-save"));
    await shown(root, panel + " [role=alert]");
    field(root, "title", "Collect questions");
    host.notes.setFailWrites(true);
    press(root, testId("backlog-save"));
    await shown(root, panel + " [role=alert]");
    expect(find<HTMLInputElement>(root, panel + " [name=title]").value).toBe("Collect questions");
    host.notes.setFailWrites(false);
    press(root, testId("backlog-save"));
    await gone(root, panel);
    await text(root, row("1"), "Newly created");
    const pbi = find<HTMLElement>(root, row("1") + ' [data-story-item^="UC-"]').dataset.storyItem;
    if (!pbi) throw new Error("The new story PBI was not rendered");

    await text(root, row("2"), "UC-404");
    action(root, "2", "Link existing item").click();
    await shown(root, panel + " [name=story-backlog-item]");
    field(root, "story-backlog-item", pbi, "change");
    press(root, testId("story-map-link-save"));
    await gone(root, panel);
    await text(root, row("2"), "Existing PBI");
    await text(root, testId("slice-review-count"), "2 of 3 stories with a PBI");
    action(root, "3", "Defer").click();
    await text(root, row("3"), "Deferred");
    await text(root, testId("slice-review-count"), "1 deferred");
    action(root, "3", "Reopen").click();
    await text(root, row("3"), "PBI open");
    expect(root.ownerDocument.activeElement).toBe(find(root, row("3")));

    const link = row("2") + ` [data-story-item="${pbi}"]`;
    press(root, link);
    await eventually(() => expect(navigation.current()).toEqual(pbiDetailRoute(first, pbi)));
    await shown(root, testId("pbi-return"));
    press(root, testId("pbi-return"));
    await shown(root, link);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, link)));

    await navigation.back();
    await shown(root, entry);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, entry)));
    press(root, opener);
    await text(root, review, "This delivery slice has no stories yet.");
    section(root, "Go to story map").click();
    await shown(root, opener);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, opener)));
    await navigation.navigate(storyMapSliceRoute(first, map, "absent"));
    await text(root, review, "This slice is unavailable in the story map.");
    section(root, "Go to story map").click();
    await shown(root, opener);
    const run = host.runtime.runPromise.bind(host.runtime);
    const store = await run(NoteStore);
    expect((await run(store.readFresh(folder + "/UC-01.md"))).frontmatter.order).toBe(3);
  });
}, 30_000);
