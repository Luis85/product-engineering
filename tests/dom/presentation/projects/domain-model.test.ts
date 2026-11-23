import { expect, it } from "vitest";
import { domainModelRoute } from "../../../../src/application/domain-model";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { eventually } from "../../../support/wait";
import { first, find, withProject } from "./knowledge-fixture";

const org = "knowledge-33333333-3333-4333-8333-000000000091";
const request = "knowledge-33333333-3333-4333-8333-000000000092";
const orgPath = "Projects/Kundenportal/Organisation.md";
const prdPath = "Projects/Kundenportal/PRD-03.md";

function fill(root: HTMLElement, name: string, value: string) {
  const control = find<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    root,
    `[name="${name}"]`,
  );
  control.value = value;
  control.dispatchEvent(
    new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
  );
}

function click(root: HTMLElement, selector: string) {
  find<HTMLButtonElement>(root, selector).click();
}

function byTestId(id: string) {
  return `[data-testid="${id}"]`;
}

function shown(root: HTMLElement, selector: string) {
  return eventually(() => expect(root.querySelector(selector)).not.toBeNull());
}

function dialog(root: HTMLElement) {
  return shown(root, "[role=dialog][data-state=open]");
}

function pointer(target: Element, type: string, x: number, y: number, pointerId = 1) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId,
      clientX: x,
      clientY: y,
      isPrimary: true,
      button: 0,
      bubbles: true,
    }),
  );
}

it("shows draft approval after a PRD scope edit while retaining the active entity editor's unsaved title and Markdown", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const note = {
      schema: "product-engineering.knowledge/v1",
      project_id: first,
      approval: "approved",
    };
    await host.runtime.runPromise(
      host.notes.seed(
        orgPath,
        {
          ...note,
          id: org,
          kind: "entity",
          title: "Organisation",
          display_id: "ENT-01",
        },
        "Saved definition.",
      ),
    );
    await host.runtime.runPromise(
      host.notes.seed(
        prdPath,
        {
          ...note,
          id: request,
          kind: "prd",
          title: "Service request",
          display_id: "PRD-03",
        },
        "A demand.",
      ),
    );
    await host.runtime.runPromise(rebuildNoteIndex);
    await navigation.navigate(knowledgeDetailRoute(first, org));
    const header = byTestId("knowledge-note-header") + " .pe-note-meta";
    await eventually(() =>
      expect(root.querySelector(header)?.textContent).toContain("Product approval · Approved"),
    );
    click(root, byTestId("knowledge-edit"));
    await shown(root, "textarea[name=markdown]");
    fill(root, "title", "Unsaved partner organisation");
    fill(root, "markdown", "Unsaved definition.");
    fill(root, "domain-assignment", request);
    click(root, byTestId("domain-scope") + " button[type=submit]");
    await shown(root, `[data-domain-scope-link="${request}"]`);
    await eventually(() =>
      expect(root.querySelector(header)?.textContent).toContain("Product approval · Draft"),
    );
    expect(find<HTMLSelectElement>(root, "select[name=approval]").value).toBe("draft");
    expect(find<HTMLInputElement>(root, "input[name=title]").value).toBe(
      "Unsaved partner organisation",
    );
    expect(find<HTMLTextAreaElement>(root, "textarea[name=markdown]").value).toBe(
      "Unsaved definition.",
    );
    const persisted = await host.runtime.runPromise(
      NoteStore.use((store) => store.readContent(orgPath)),
    );
    expect(persisted).toMatchObject({
      body: "Saved definition.",
      frontmatter: {
        approval: "draft",
        title: "Organisation",
        domain_scope: [{ kind: "prd", id: request }],
      },
    });
  });
});

it("lets the project surface edit the canonical entity, assign PRD scope in both directions and restore archive state", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const note = {
      schema: "product-engineering.knowledge/v1",
      project_id: first,
      approval: "draft",
    };
    await host.runtime.runPromise(
      host.notes.seed(
        orgPath,
        { ...note, id: org, kind: "entity", title: "Organisation", display_id: "ENT-01" },
        "An organisation.",
      ),
    );
    await host.runtime.runPromise(
      host.notes.seed(
        prdPath,
        { ...note, id: request, kind: "prd", title: "Service request", display_id: "PRD-03" },
        "A demand.",
      ),
    );
    await host.runtime.runPromise(rebuildNoteIndex);
    await navigation.navigate(domainModelRoute(first, org));
    await shown(root, byTestId("domain-edit-entity"));

    click(root, byTestId("domain-edit-entity"));
    await dialog(root);
    fill(root, "title", "Partner organisation");
    fill(root, "definition", "Uses a customer number.");
    click(root, byTestId("domain-add-attribute"));
    await shown(root, "[name=attribute-name]");
    fill(root, "attribute-name", "Customer number");
    fill(root, "attribute-description", "Internal reference");
    click(root, "[role=dialog] button[type=submit]");
    await eventually(() =>
      expect(root.querySelector(byTestId("domain-inspector") + " h2")?.textContent).toBe(
        "Partner organisation",
      ),
    );
    const persisted = await host.runtime.runPromise(
      NoteStore.use((store) => store.readContent(orgPath)),
    );
    expect(persisted.frontmatter).toMatchObject({
      id: org,
      domain_attributes: [{ name: "Customer number", description: "Internal reference" }],
    });
    expect(persisted.body).toBe("Uses a customer number.");

    fill(root, "domain-assignment", request);
    click(root, byTestId("domain-scope") + " button[type=submit]");
    await shown(root, `[data-domain-scope-link="${request}"]`);
    click(root, `[data-domain-scope-link="${request}"]`);
    await shown(root, `[data-domain-scope-link="${org}"]`);
    expect(navigation.current()).toEqual(
      knowledgeDetailRoute(first, request, {
        section: "domainmodel",
        reference: { kind: "entity", recordId: org },
      }),
    );
    click(root, "button[data-domain-remove-assignment]");
    await eventually(() =>
      expect(root.querySelector(`[data-domain-scope-link="${org}"]`)).toBeNull(),
    );
    click(root, byTestId("project-record-return"));

    await shown(root, byTestId("domain-archive-entity"));
    click(root, byTestId("domain-archive-entity"));
    await dialog(root);
    click(root, byTestId("domain-confirm"));
    await shown(root, byTestId("domain-empty"));
    await navigation.navigate(knowledgeDetailRoute(first, org));
    await shown(root, byTestId("domain-restore-entity"));
    click(root, byTestId("domain-restore-entity"));
    await eventually(() =>
      expect(root.querySelector(byTestId("domain-restore-entity"))).toBeNull(),
    );
    click(root, byTestId("domain-model-link"));
    await shown(root, `[data-domain-node="${org}"]`);
  });
});

it("creates and updates a self relationship from the feature screen and keeps the canvas state on selection", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await host.runtime.runPromise(
      host.notes.seed(
        orgPath,
        {
          schema: "product-engineering.knowledge/v1",
          project_id: first,
          approval: "draft",
          id: org,
          kind: "entity",
          title: "Organisation",
          display_id: "ENT-01",
        },
        "Original.",
      ),
    );
    await host.runtime.runPromise(rebuildNoteIndex);
    await navigation.navigate(domainModelRoute(first));
    await shown(root, byTestId("domain-create-edge"));
    click(root, byTestId("domain-create-edge"));
    await dialog(root);
    fill(root, "verb", "Cancelled");
    const cancel = [...root.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find(
      (button) => button.textContent?.trim() === "Cancel",
    );
    if (!cancel) throw new Error("Missing relationship cancel action");
    cancel.click();
    await eventually(() => expect(root.querySelector("[role=dialog][data-state=open]")).toBeNull());
    expect(root.querySelector("[data-domain-edge-row]")).toBeNull();
    const viewport = find<HTMLElement>(root, byTestId("domain-viewport"));
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
    const world = () => find<HTMLElement>(root, "[data-domain-world]");
    await eventually(() => expect(Number(world().dataset.zoom)).toBeGreaterThan(1));
    const zoom = world().dataset.zoom;
    click(root, byTestId("domain-create-edge"));
    await dialog(root);
    fill(root, "target", org);
    fill(root, "verb", "Delegates");
    fill(root, "sourceCardinality", "0..1");
    fill(root, "targetCardinality", "1..*");
    click(root, "[role=dialog] button[type=submit]");
    await shown(root, byTestId("domain-edit-edge"));
    const selected = navigation.current();
    expect(world().dataset.zoom).toBe(zoom);
    expect(root.querySelector(byTestId("domain-inspector"))?.textContent).toContain("One or more");
    click(root, byTestId("domain-edit-edge"));
    await dialog(root);
    fill(root, "rule", "With approval");
    click(root, "[role=dialog] button[type=submit]");
    await eventually(() =>
      expect(root.querySelector(byTestId("domain-inspector"))?.textContent).toContain(
        "With approval",
      ),
    );
    expect(navigation.current()).toEqual(selected);
    click(root, byTestId("domain-camera-reset"));
    await eventually(() => expect(world().dataset.zoom).toBe("1"));
    const node = find<HTMLElement>(root, `[data-domain-node="${org}"]`);
    const initial = Number.parseFloat(node.style.left);
    node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await eventually(() => expect(Number.parseFloat(node.style.left)).toBe(initial + 24));
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    click(root, byTestId("domain-camera-fit"));
    click(root, byTestId("domain-camera-reset"));
    await eventually(() => expect(world().style.transform).toBe("translate(0px, 0px) scale(1)"));
    pointer(viewport, "pointerdown", 3, 3);
    pointer(viewport, "pointermove", 5, 3);
    pointer(viewport, "pointermove", 12, 8, 2);
    expect(world().style.transform).toBe("translate(0px, 0px) scale(1)");
    pointer(viewport, "pointermove", 43, 28);
    pointer(viewport, "pointerup", 43, 28);
    await eventually(() => expect(world().style.transform).toBe("translate(40px, 25px) scale(1)"));
    const nodeBefore = Number.parseFloat(node.style.left);
    pointer(node, "pointerdown", 73, 75);
    pointer(viewport, "pointermove", 95, 85);
    pointer(viewport, "pointercancel", 95, 85);
    pointer(viewport, "pointermove", 110, 110);
    await eventually(() => expect(Number.parseFloat(node.style.left)).toBe(nodeBefore + 22));
    expect(world().style.transform).toBe("translate(40px, 25px) scale(1)");
  });
});

it("keeps an invalid entity draft open until its duplicate attribute is corrected", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await navigation.navigate(domainModelRoute(first));
    await shown(root, byTestId("domain-empty"));
    await shown(root, byTestId("domain-create-entity"));
    click(root, byTestId("domain-create-entity"));
    await dialog(root);
    fill(root, "title", "Service owner");
    fill(root, "definition", "A named service owner.");
    click(root, byTestId("domain-add-attribute"));
    await shown(root, "[name=attribute-name]");
    fill(root, "attribute-name", "Customer ID");
    click(root, byTestId("domain-add-attribute"));
    await eventually(() => expect(root.querySelectorAll("[name=attribute-name]")).toHaveLength(2));
    const repeated = root.querySelectorAll<HTMLInputElement>("[name=attribute-name]")[1];
    if (!repeated) throw new Error("Missing the added attribute");
    repeated.value = "customer id";
    repeated.dispatchEvent(new Event("input", { bubbles: true }));
    click(root, "[role=dialog] button[type=submit]");
    await eventually(() =>
      expect(root.querySelector("[role=dialog]")?.textContent).toContain(
        "Give each attribute a unique name.",
      ),
    );
    const list = NoteStore.use((store) => store.list);
    expect(
      (await host.runtime.runPromise(list)).filter(
        ({ frontmatter }) => frontmatter.kind === "entity",
      ),
    ).toEqual([]);
    const remove = [...root.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].findLast(
      (button) => button.textContent?.trim() === "Remove attribute",
    );
    if (!remove) throw new Error("Missing the duplicate attribute's remove action");
    remove.click();
    click(root, "[role=dialog] button[type=submit]");
    await eventually(() =>
      expect(root.querySelector(byTestId("domain-inspector") + " h2")?.textContent).toBe(
        "Service owner",
      ),
    );
    expect(
      (await host.runtime.runPromise(list)).filter(
        ({ frontmatter }) => frontmatter.kind === "entity",
      ),
    ).toHaveLength(1);
  });
});
