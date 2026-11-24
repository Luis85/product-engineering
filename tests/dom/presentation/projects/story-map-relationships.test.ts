import { expect, it } from "vitest";
import { backlogRoute, readBacklogItem } from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { addProjectMember } from "../../../../src/application/projects";
import { storyMapsRoute } from "../../../../src/application/story-maps";
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
  named,
  panel,
  press,
  section,
  shown,
  testId,
  text,
} from "./story-map-ui-fixture";

const backlog = [
  ["UC-01", "PBI", "Review the next case", 823, ""],
  ["UC-02", "PBI", "Check the customer context", 824, ""],
  ["FE-01", "Feature", "Service workflow", 825, ""],
  ["TASK-01", "Task", "Review queue together", 826, "UC-01"],
] as const;
const member = "project-member-33333333-3333-4333-8333-000000000827";
const selectItem = "story-backlog-item";
const workManager = testId("story-map-work-add");
const workSave = testId("story-map-work-save");
const cardLink = (cardId: string, recordId: string) => ({
  kind: "item",
  projectId: first,
  cardId,
  recordId,
});

async function seed(host: ReturnType<typeof testRuntime>) {
  const run = host.runtime.runPromise.bind(host.runtime);
  await run(addProjectMember(first, member, { name: "Case steward", role: "requirements" }));
  await Promise.all(
    backlog.map(([id, type, title, sequence, parent]) =>
      run(
        host.notes.seed(
          `${folder}/${id}.md`,
          {
            schema: "product-engineering.backlog/v1",
            project_id: first,
            "pe-id": id,
            title,
            type,
            id: `backlog-33333333-3333-4333-8333-000000000${sequence}`,
            ...(parent && { parent: `[[${parent}]]` }),
          },
          "\n## External owner notes\n",
        ),
      ),
    ),
  );
  await run(
    host.notes.seed(mapPath, {
      ...mapFields(),
      activities: [{ id: "ACT-01", title: "Receive handover" }],
      steps: [{ id: "STEP-01", activityId: "ACT-01", title: "Understand the cases" }],
      cards: [
        { id: "CARD-01", stepId: "STEP-01", title: "See the next case" },
        { id: "CARD-02", stepId: "STEP-01", title: "Repair the broken entry" },
      ],
      card_links: [cardLink("CARD-01", "UC-01"), cardLink("CARD-02", "UC-404")],
    }),
  );
  await run(rebuildNoteIndex);
}

async function linkEditor(root: HTMLElement) {
  named(root, "Details and actions for story “Repair the broken entry”").click();
  await shown(root, testId("story-map-card-link"));
  press(root, testId("story-map-card-link"));
  await shown(root, `${panel} [name="${selectItem}"]`);
}

it("repairs a missing story link, keeps an unsaved selection on refusal, and returns from a canonical Feature", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seed(host);
    const store = await run(NoteStore);
    const existing = await run(store.readContent(folder + "/FE-01.md"));
    await navigation.navigate(storyMapsRoute(first, map));
    const card = testId("story-map-card-CARD-02");
    await text(root, card, "UC-404");
    await linkEditor(root);
    section(root, "Remove link to UC-404").click();
    await text(root, card, "No backlog link");
    field(root, selectItem, "FE-01", "change");
    section(find(root, panel), "Close").click();
    await gone(root, panel);
    expect((await run(store.readFresh(mapPath))).frontmatter.card_links).toEqual([
      cardLink("CARD-01", "UC-01"),
    ]);
    await linkEditor(root);
    field(root, selectItem, "FE-01", "change");
    host.notes.setFailWrites(true);
    press(root, testId("story-map-link-save"));
    await shown(root, `${panel} [role="alert"]`);
    expect(find<HTMLInputElement>(root, `${panel} [name="${selectItem}"]`).value).toBe("FE-01");
    host.notes.setFailWrites(false);
    press(root, testId("story-map-link-save"));
    await gone(root, panel);
    const link = `${card} [data-story-item="FE-01"]`;
    await shown(root, link);
    press(root, link);
    await eventually(() => expect(navigation.current()).toEqual(backlogRoute(first, "FE-01")));
    await shown(root, '[data-map-card-link="CARD-02"]');
    const returnButton = testId("backlog-return-story-map");
    await shown(root, returnButton);
    press(root, returnButton);
    await eventually(() => expect(navigation.current()).toEqual(storyMapsRoute(first, map)));
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, link)));
    expect((await run(store.readContent(folder + "/FE-01.md"))).text).toBe(existing.text);
  });
}, 20_000);

it("edits related work, preselects the sole linked PBI, and retries creation with its selected owner", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seed(host);
    const store = await run(NoteStore);
    await navigation.navigate(storyMapsRoute(first, map));
    const card = testId("story-map-card-CARD-01");
    const workButton = card + " " + testId("story-map-work");
    await shown(root, workButton);
    press(root, workButton);
    const related = testId("story-map-work-related");
    await text(root, related, "Review queue together");
    section(find(root, related), "Review queue together").click();
    await shown(root, workSave);
    field(root, "body", "## Updated context\n\nKeep cases grouped by owner.");
    press(root, workSave);
    await gone(root, workSave);
    expect((await run(readBacklogItem(first, "TASK-01"))).draft.body).toContain(
      "Keep cases grouped by owner.",
    );

    press(root, workManager);
    await shown(root, workSave);
    expect(find<HTMLInputElement>(root, `${panel} [name="destination"]`).value).toBe("UC-01");
    field(root, "kind", "ISS", "change");
    field(root, "title", "Escalate the blocked case");
    await shown(root, `${panel} [name="owner"] option[value="${member}"]`);
    field(root, "owner", member, "change");
    host.notes.setFailWrites(true);
    press(root, workSave);
    await shown(root, `${panel} [role="alert"]`);
    expect(find<HTMLInputElement>(root, `${panel} [name="title"]`).value).toBe(
      "Escalate the blocked case",
    );
    host.notes.setFailWrites(false);
    press(root, workSave);
    await gone(root, workSave);
    await text(root, testId("story-map-work-attached"), "Case steward");
    const item = (await run(store.sources)).find(
      ({ frontmatter }) => frontmatter.title === "Escalate the blocked case",
    );
    const id = item?.frontmatter["pe-id"];
    if (typeof id !== "string") throw new Error("Missing canonical Issue");
    expect((await run(readBacklogItem(first, id))).draft).toMatchObject({
      owner: "Case steward",
      parent: "UC-01",
    });
    const savedMap = await run(store.readFresh(mapPath));
    expect(savedMap.frontmatter.story_work).toEqual([]);
    expect(savedMap.frontmatter.card_links).toContainEqual(cardLink("CARD-01", id));
    section(find(root, panel), "Close").click();
    await gone(root, workManager);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, workButton)));
  });
}, 20_000);
