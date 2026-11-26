import { expect, it } from "vitest";
import { knowledgeDetailRoute, projectKnowledgeRoute } from "../../../../src/application/knowledge";
import { NoteStore } from "../../../../src/application/notes";
import { eventually } from "../../../support/wait";
import {
  find,
  first,
  jobOne,
  jobTwo,
  seedFoundations,
  vision,
  withProject,
} from "./knowledge-fixture";

it("derives a PRD in its editable buffer and follows both project foundations and the job backlink", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await seedFoundations(host);
    const job = knowledgeDetailRoute(first, jobOne);
    await navigation.navigate(job);
    const derive = () =>
      root.querySelector<HTMLButtonElement>("[data-testid=knowledge-create-prd]");
    await eventually(() => expect(derive()).not.toBeNull());
    derive()?.click();
    const dialog = await eventually(() => find(root, "[role=dialog][data-state=open]"));
    expect(dialog.textContent).toContain("Approve a service request");
    const primary = await eventually(() => find<HTMLInputElement>(dialog, `[value="${jobOne}"]`));
    expect(primary.checked).toBe(true);
    find<HTMLInputElement>(dialog, `[value="${jobTwo}"]`).click();
    const select = find<HTMLSelectElement>(dialog, "[name=vision_id]");
    expect(select.value).toBe(vision);
    find<HTMLButtonElement>(dialog, "button[type=submit]").click();
    const editor = await eventually(() => find<HTMLTextAreaElement>(root, "[name=markdown]"));
    expect(editor.value).toContain("REQ-01");
    expect(root.ownerDocument.activeElement).toBe(editor);
    const created = (await host.runtime.runPromise(NoteStore.use((store) => store.list))).find(
      ({ frontmatter }) => frontmatter.kind === "prd",
    );
    expect(created?.frontmatter).toMatchObject({ vision_id: vision, job_ids: [jobOne, jobTwo] });
    expect(host.notes.opened()).toEqual([]);
    const related = (id: string) =>
      find<HTMLButtonElement>(root, `[data-knowledge-relation="${id}"]`);
    await eventually(() => expect(related(jobOne)).not.toBeNull());
    expect(related(jobTwo).textContent).toContain("Trace an approval");
    expect(related(vision).textContent).toContain("A clear customer journey");
    find<HTMLButtonElement>(root, "[data-testid=project-record-return]").click();
    const createdId = String(created?.frontmatter.id);
    await eventually(() => expect(related(createdId).textContent).toContain("PRD-01"));
    related(createdId).click();
    await eventually(() =>
      expect(related(jobOne).textContent).toContain("Approve a service request"),
    );
  });
}, 15_000);

it("opens a new library note in the integrated editor and returns focus to its creation control", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await navigation.navigate(projectKnowledgeRoute(first));
    const findCreate = () => find<HTMLButtonElement>(root, "[data-testid=knowledge-create]");
    const create = await eventually(findCreate);
    create.focus();
    create.click();
    const dialog = await eventually(() => find(root, "[role=dialog][data-state=open]"));
    find<HTMLButtonElement>(dialog, "button[type=submit]").click();
    await eventually(() => expect(root.querySelector("[name=markdown]")).not.toBeNull());
    expect(host.notes.opened()).toEqual([]);
    find<HTMLButtonElement>(root, "[data-testid=project-record-return]").click();
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(findCreate()));
    expect(navigation.current()).toEqual(projectKnowledgeRoute(first));
  });
}, 15_000);

it.each([
  ["visible record return", "[data-testid=project-record-return]"],
  ["shell Back", "[data-testid=frame-history] button[aria-label='Go back']"],
] as const)(
  "returns from a derived PRD to the Vision action using %s",
  async (_method, returnButton) => {
    await withProject(async ({ root, host, navigation }) => {
      await seedFoundations(host);
      await navigation.navigate(knowledgeDetailRoute(first, jobOne));
      const openVision = await eventually(() =>
        find<HTMLButtonElement>(root, `[data-knowledge-relation="${vision}"]`),
      );
      openVision.click();
      await eventually(() =>
        expect(root.querySelector("h1")?.textContent).toBe("A clear customer journey"),
      );
      const derive = () => find<HTMLButtonElement>(root, "[data-testid=knowledge-create-prd]");
      const trigger = await eventually(derive);
      const visionRoute = navigation.current();
      trigger.focus();
      trigger.click();
      const dialog = await eventually(() => find(root, "[role=dialog][data-state=open]"));
      await eventually(() =>
        expect(find<HTMLSelectElement>(dialog, "[name=vision_id]").value).toBe(vision),
      );
      find<HTMLButtonElement>(dialog, "button[type=submit]").click();
      const editor = await eventually(() => find<HTMLTextAreaElement>(root, "[name=markdown]"));
      expect(root.ownerDocument.activeElement).toBe(editor);
      expect(visionRoute).toEqual(
        knowledgeDetailRoute(first, vision, {
          section: "knowledge-note",
          reference: { kind: "knowledge", recordId: jobOne },
        }),
      );
      find<HTMLButtonElement>(root, returnButton).click();
      await eventually(() => expect(navigation.current()).toEqual(visionRoute));
      await eventually(() => expect(root.ownerDocument.activeElement).toBe(derive()));
    });
  },
  15_000,
);
