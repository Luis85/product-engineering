import { expect, it } from "vitest";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { eventually } from "../../../support/wait";
import { find, first, withProject } from "./knowledge-fixture";
import {
  field,
  gone,
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

const editor = testId("story-map-journey-save");
const activities = '[aria-label="Activities and user steps"]';

async function fillNode(root: HTMLElement, title: string, outcome?: string) {
  await shown(root, editor);
  field(root, "title", title);
  if (outcome) field(root, "detail", outcome);
  press(root, editor);
  await gone(root, editor);
}

async function action(root: HTMLElement, node: string, label: string) {
  await eventually(() => expect(named(root, node)).toBeTruthy());
  named(root, node).click();
  await eventually(() => expect(section(root, label)).toBeTruthy());
  section(root, label).click();
}

function release(root: HTMLElement, title: string) {
  const band = [...root.querySelectorAll<HTMLElement>(".pe-story-band")].find(
    (element) => element.querySelector("h3")?.textContent === title,
  );
  if (!band) throw new Error("Missing delivery slice " + title);
  return band;
}

it("creates each journey node, edits fresh activity and step data, and reorders each applicable lane", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await run(host.notes.seed(mapPath, mapFields()));
    await run(rebuildNoteIndex);
    await navigation.navigate(storyMapsRoute(first));
    await shown(root, testId("story-map-row"));
    press(root, testId("story-map-row"));
    await text(root, testId("story-map-detail"), "Add the first activity");
    press(root, testId("story-map-add-activity"));
    await fillNode(root, "Review cases");
    await text(root, activities, "User step missing");
    named(root, "Add a user step to “Review cases”").click();
    await fillNode(root, "Read the queue");
    named(root, "Add a user step to “Review cases”").click();
    await fillNode(root, "Prepare the handover");
    press(root, testId("story-map-add-activity"));
    await fillNode(root, "Notify team");
    await text(root, activities, "Notify team");
    await action(root, "Actions for “Notify team”", "Move earlier");
    await eventually(() => expect(find(root, `${activities} h3`).textContent).toBe("Notify team"));
    await action(root, "Actions for “Review cases”", "Edit activity");
    await fillNode(root, "Review open cases");
    await action(root, "Actions for “Prepare the handover”", "Edit user step");
    await fillNode(root, "Prepare the current handover");
    await action(root, "Actions for “Prepare the current handover”", "Move earlier");
    await eventually(() =>
      expect(find(root, `${activities} h4`).textContent).toBe("Prepare the current handover"),
    );

    press(root, testId("story-map-add-slice"));
    await fillNode(root, "First release", "Avoid handover delays.");
    press(root, testId("story-map-add-slice"));
    await fillNode(root, "Review release");
    await eventually(() => expect(release(root, "Review release")).toBeTruthy());
    const review = release(root, "Review release");
    named(review, "Move up").click();
    await eventually(() =>
      expect(find(root, ".pe-story-band h3").textContent).toBe("Review release"),
    );
    named(review, "Edit delivery slice").click();
    await fillNode(root, "Review and verify");

    const add = "Add story for “Prepare the current handover” in “First release”";
    named(root, add).click();
    await fillNode(root, "Write the note", "The next team sees the remaining work.");
    named(root, add).click();
    await fillNode(root, "Verify the note");
    await eventually(() =>
      expect(release(root, "First release").textContent).toContain("Verify the note"),
    );
    await action(root, "Details and actions for story “Verify the note”", "Move up");
    const firstRelease = release(root, "First release");
    await eventually(() =>
      expect(find(firstRelease, ".pe-story-card h4").textContent).toContain("Verify the note"),
    );
    const store = await run(NoteStore);
    expect((await run(store.readFresh(mapPath))).frontmatter).toMatchObject({
      activities: [{ title: "Notify team" }, { title: "Review open cases" }],
      steps: [{ title: "Prepare the current handover" }, { title: "Read the queue" }],
      slices: [
        { title: "Review and verify" },
        { title: "First release", outcome: "Avoid handover delays." },
      ],
      cards: [{ title: "Verify the note" }, { title: "Write the note" }],
    });
    expect(root.querySelector(panel)).toBeNull();
    section(root, "Back to Story Maps").click();
    await eventually(() => expect(navigation.current()).toEqual(storyMapsRoute(first)));
  });
}, 25_000);
