import { expect, it } from "vitest";
import { backlogRoute, backlogSnapshot } from "../../../../src/application/backlog";
import { NoteStore } from "../../../../src/application/notes";
import {
  createProject,
  projectById,
  projectOverviewRoute,
} from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import { find, first, second, withProject } from "./knowledge-fixture";

const stages = ["Backlog", "Open", "In Progress", "Review", "In Development", "Done"];
const lane = (stage: string) => `[data-board-stage="${stage}"]`;
const card = '[data-board-card="UC-09"]';
const move = card + " select";
const add = "[data-testid=board-new]";
const filter = "[name=backlog-search]";
const board = "[data-testid=backlog-board]";

function button(root: HTMLElement, text: string) {
  const control = [...root.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!control) throw new Error("Missing " + text + " action");
  return control;
}

function change(root: HTMLElement, selector: string, value: string, event = "input") {
  const control = find<HTMLInputElement | HTMLSelectElement>(root, selector);
  control.value = value;
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

function drag(target: HTMLElement, type: string, transfer: DataTransfer) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
}

it("opens the six ordered Board lanes from the project rail and keeps explicit List links", async () => {
  await withProject(async ({ root, navigation }) => {
    button(root, "Backlog").click();
    await eventually(() =>
      expect(
        [...root.querySelectorAll("[data-board-stage]")].map((item) =>
          item.getAttribute("data-board-stage"),
        ),
      ).toEqual(stages),
    );
    expect(navigation.current()).toEqual({ name: "project-backlog", projectId: first });
    button(root, "List").click();
    await eventually(() => expect(root.querySelector("[data-testid=backlog-list]")).toBeTruthy());
    expect(navigation.current()).toEqual(backlogRoute(first));
    button(root, "Board").click();
    await eventually(() => expect(root.querySelector(board)).toBeTruthy());
    expect(navigation.current()).toMatchObject({ tab: "board" });
  });
});

async function withCard(
  test: (context: Parameters<Parameters<typeof withProject>[0]>[0], path: string) => Promise<void>,
) {
  await withProject(async (context) => {
    const { host, root } = context;
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing fixture project");
    const path = project.folder + "/Export service cases.md";
    await run(
      host.notes.seed(project.folder + "/Service.md", {
        type: "Feature",
        "pe-id": "FE-01",
        project_id: first,
      }),
    );
    await run(
      host.notes.seed(
        path,
        {
          schema: "product-engineering.backlog/v1",
          id: "backlog-33333333-3333-4333-8333-000000000009",
          project_id: first,
          "pe-id": "UC-09",
          "pbl-id": "009",
          type: "PBI",
          status: "In Arbeit",
          parent: "[[Service]]",
          order: 100,
          priority: "P1",
          assignee: "Mara",
          pbi_revision: 3,
          pbi_approved_revision: 3,
          pbi_approval_fingerprint: 456,
          outside: "keep",
        },
        "## Recorded procedure",
      ),
    );
    button(root, "Backlog").click();
    await test(context, path);
  });
}

it("writes the mapped status and manual choice via the labelled control and drag into a folded lane", async () => {
  await withCard(async ({ root, host }, path) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const store = await run(NoteStore);
    const before = await run(store.readContent(path));
    await eventually(() =>
      expect(root.querySelector(lane("In Progress") + " " + card)).toBeTruthy(),
    );
    const controls = find(root, card);
    expect(controls.textContent).toContain("Service");
    expect(controls.textContent).toContain("Mara");
    expect(controls.textContent).toContain("P1");
    expect(find(root, move).getAttribute("aria-label")).toContain("UC-09");
    change(root, move, "Review", "change");
    await eventually(() => {
      expect(root.querySelector(lane("Review") + " " + card)).toBeTruthy();
      expect(document.activeElement).toBe(find(root, move));
    });
    const reviewed = await run(store.readContent(path));
    expect(reviewed.frontmatter).toEqual({
      ...before.frontmatter,
      status: "Review",
      pbi_stage_choice: "Review",
    });
    expect(reviewed.body).toBe(before.body);
    const done = lane("Done");
    const fold = find(root, done + " button[aria-expanded]");
    fold.click();
    const source = find(root, card);
    const transfer = new DataTransfer();
    drag(source, "dragstart", transfer);
    drag(find(root, done), "dragover", transfer);
    drag(find(root, done), "drop", transfer);
    await eventually(async () => {
      expect((await run(store.readContent(path))).frontmatter).toEqual({
        ...before.frontmatter,
        status: "Done",
        pbi_stage_choice: "Done",
      });
      expect(document.activeElement).toBe(fold);
    });
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    fold.click();
    await eventually(() => expect(root.querySelector(done + " " + card)).toBeTruthy());
  });
});

function clearSavedFolds() {
  window.localStorage.removeItem("product-engineering:board:" + first);
}

it("preserves independent edge folds across route switches and a fresh mounted view", async () => {
  clearSavedFolds();
  try {
    const backlog = lane("Backlog") + " [aria-expanded]";
    const done = lane("Done") + " [aria-expanded]";
    await withProject(async ({ root, navigation, host }) => {
      button(root, "Backlog").click();
      await eventually(() => expect(root.querySelector(backlog)).toBeTruthy());
      find(root, backlog).click();
      await eventually(() =>
        expect(find(root, backlog).getAttribute("aria-expanded")).toBe("false"),
      );
      expect(find(root, done).getAttribute("aria-expanded")).toBe("true");
      find(root, done).click();
      await eventually(() => expect(find(root, done).getAttribute("aria-expanded")).toBe("false"));
      await host.runtime.runPromise(
        createProject(second, {
          name: "Admin",
          description: "Support workspace",
          repository: "team/admin",
        }),
      );
      await navigation.navigate(projectOverviewRoute(second));
      await eventually(() => expect(root.querySelector("h1")?.textContent).toBe("Admin"));
      button(root, "Backlog").click();
      await eventually(() => {
        expect(find(root, backlog).getAttribute("aria-expanded")).toBe("true");
        expect(find(root, done).getAttribute("aria-expanded")).toBe("true");
      });
    });
    await withProject(async ({ root }) => {
      button(root, "Backlog").click();
      await eventually(() => {
        expect(find(root, backlog).getAttribute("aria-expanded")).toBe("false");
        expect(find(root, done).getAttribute("aria-expanded")).toBe("false");
      });
    });
  } finally {
    clearSavedFolds();
  }
});

it("cancels a filtered Board quick add and creates the first unassigned PBI and parents once", async () => {
  await withProject(async ({ root, host }) => {
    button(root, "Backlog").click();
    await eventually(() => expect(root.querySelector(add)).toBeTruthy());
    change(root, filter, "Does not match");
    const trigger = find(root, add);
    trigger.click();
    await eventually(() => expect(root.querySelector("[data-testid=backlog-form]")).toBeTruthy());
    expect(find<HTMLSelectElement>(root, "[name=state]").value).toBe("Backlog");
    expect(find<HTMLSelectElement>(root, "[name=owner]").value).toBe("");
    find(root, "[data-testid=backlog-cancel]").click();
    await eventually(() => expect(document.activeElement).toBe(trigger));
    expect(find<HTMLInputElement>(root, filter).value).toBe("Does not match");
    const run = host.runtime.runPromise.bind(host.runtime);
    expect((await run(backlogSnapshot(first))).items).toHaveLength(0);

    trigger.click();
    await eventually(() => expect(root.querySelector("[name=featureTitle]")).toBeTruthy());
    change(root, "[name=title]", "New customer flow");
    change(root, "[name=epicTitle]", "Customer service");
    change(root, "[name=featureTitle]", "Service flow");
    find(root, "[data-testid=backlog-save]").click();
    await eventually(() => {
      const title = root.querySelector(lane("Backlog") + " [data-testid=board-card-open]");
      expect(title?.textContent).toBe("New customer flow");
      expect(document.activeElement).toBe(title);
    });
    const items = (await run(backlogSnapshot(first))).items;
    expect(items).toHaveLength(3);
    const pbi = items.find(({ kind }) => kind === "UC");
    expect(pbi).toMatchObject({
      state: "Backlog",
      owner: "",
      parent: items.find(({ kind }) => kind === "FE")?.id,
    });
  });
});

it("opens the canonical detail from the first readiness gap and restores Board focus and filters", async () => {
  await withCard(async ({ root, navigation }) => {
    await eventually(() =>
      expect(root.querySelector(card + " [data-testid=board-prepare]")).toBeTruthy(),
    );
    expect(find(root, card).textContent).toContain("Link a PRD requirement");
    change(root, filter, "UC-09");
    const prepare = card + " [data-testid=board-prepare]";
    find(root, prepare).click();
    await eventually(() =>
      expect(root.querySelector("h1")?.textContent).toBe("Export service cases"),
    );
    find(root, "[data-testid=pbi-return]").click();
    await eventually(() => {
      expect(find<HTMLInputElement>(root, filter).value).toBe("UC-09");
      expect(document.activeElement).toBe(find(root, prepare));
      expect(navigation.current()).toEqual({ name: "project-backlog", projectId: first });
    });
  });
});
