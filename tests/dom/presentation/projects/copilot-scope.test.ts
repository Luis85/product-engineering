import { expect, it } from "vitest";
import { nfrCatalogRoute, pbiDetailRoute } from "../../../../src/application/backlog";
import { domainModelRoute } from "../../../../src/application/domain-model";
import { AGENT_CHAT, loadCopilot } from "../../../../src/application/integrations";
import { knowledgeDetailRoute, knowledgeNoteOptions } from "../../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { projectOverviewRoute, projectById } from "../../../../src/application/projects";
import type { Route } from "../../../../src/application/routes";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { traceRoute } from "../../../../src/application/trace";
import { mountApp } from "../../../support/surface";
import { eventually } from "../../../support/wait";
import { find, first } from "./knowledge-fixture";

import { fillPrompt, primary, send, task, unrelated, withReview } from "./copilot-fixture";

it("opens a scoped PRD-03 review on its native route and sends only by explicit action", () =>
  withReview(async ({ panel, stream, view, route }) => {
    expect(view.navigation.current()).toEqual(route);
    expect(find<HTMLSelectElement>(panel, '[data-testid="copilot-thread"]').options).toHaveLength(
      1,
    );
    expect(find<HTMLSelectElement>(panel, '[data-testid="copilot-mode"]').value).toBe("review");
    await eventually(() => expect(panel.textContent).toContain("PRD-03 · Exact handover"));
    expect(panel.textContent).not.toContain("Foreign duplicate");
    const selected = [
      ...panel.querySelectorAll<HTMLInputElement>('[data-testid="copilot-source"]:checked'),
    ];
    expect(selected.map((input) => input.closest("label")?.textContent?.trim())).toEqual([
      "PRD-03 · Exact handover",
    ]);
    selected[0]?.click();
    await eventually(() =>
      expect(panel.querySelector('[data-testid="copilot-source"]:checked')).toBeNull(),
    );
    selected[0]?.click();
    await eventually(() =>
      expect(panel.querySelector('[data-testid="copilot-source"]:checked')).toBe(selected[0]),
    );
    expect(stream).toHaveBeenCalledTimes(0);
    fillPrompt(panel, "Review the handover");
    send(panel);
    await eventually(() => expect(panel.textContent).toContain("Controlled answer"));
    expect(stream).toHaveBeenCalledTimes(1);
    const request = JSON.stringify(stream.mock.calls[0]?.[0]);
    expect(request).toContain("Review the handover");
    expect(request).toContain("Private body: Exact handover");
    expect(request).not.toContain("Foreign duplicate");
    expect(request).not.toContain("Unselected sibling");
    expect(view.navigation.current()).toEqual(route);
  }));

it("reopens the project conversation, its selected sources and unsent draft without resending", () =>
  withReview(async ({ panel, stream, host, mount, reopen }) => {
    fillPrompt(panel, "Review the record");
    send(panel);
    await eventually(() => expect(panel.textContent).toContain("Controlled answer"));
    fillPrompt(panel, "Unsent continuation");
    await eventually(async () => {
      const saved = await host.runtime.runPromise(loadCopilot(first));
      expect(saved).toMatchObject({
        composer: { prompt: "Unsent continuation" },
        threads: [
          { messages: [{ content: "Review the record" }, { content: "Controlled answer" }] },
        ],
      });
    });
    await mount();
    const reopened = await reopen();
    await eventually(() => expect(reopened.textContent).toContain("Controlled answer"));
    expect(find<HTMLTextAreaElement>(reopened, '[data-testid="copilot-prompt"]').value).toBe(
      "Unsent continuation",
    );
    await eventually(() =>
      expect(reopened.querySelectorAll('[data-testid="copilot-source"]:checked')).toHaveLength(1),
    );
    expect(stream).toHaveBeenCalledTimes(1);
  }));

it("follows identifiable native route sources in a fresh composer and keeps an established thread scoped", () =>
  withReview(async ({ host, panel, stream, view }) => {
    const map = "story-map-33333333-3333-4333-8333-000000000011";
    const entity = "knowledge-33333333-3333-4333-8333-000000000012";
    const nfr = "nfr-33333333-3333-4333-8333-000000000014";
    const project = await host.runtime.runPromise(projectById(first));
    if (!project) throw new Error("Missing customer fixture");
    const seed = (path: string, fm: Record<string, unknown>) =>
      host.runtime.runPromise(
        host.notes.seed(project.folder + "/" + path, { project_id: first, ...fm }),
      );
    await seed("SM-01.md", {
      schema: "product-engineering.story-map/v1",
      id: map,
      display_id: "SM-01",
      title: "Service steps",
      persona: "Operator",
      goal: "Controlled map goal",
      cards: [],
      activities: [],
      steps: [],
      slices: [],
    });
    await seed("ENT-02.md", {
      schema: "product-engineering.knowledge/v1",
      id: entity,
      kind: "entity",
      display_id: "ENT-02",
      title: "Service case",
      approval: "approved",
    });
    await seed("NFR-03.md", {
      schema: "product-engineering.nfr/v1",
      id: nfr,
      title: "Reliability",
      requirement: "Controlled requirement",
      acceptance: "Controlled acceptance",
      categories: [],
    });
    await seed("UC-09.md", {
      schema: "product-engineering.backlog/v1",
      id: "backlog-33333333-3333-4333-8333-000000000013",
      "pe-id": "UC-09",
      type: "PBI",
      title: "Review CSV",
    });
    await host.runtime.runPromise(rebuildNoteIndex);
    const checked = () =>
      [...panel.querySelectorAll<HTMLInputElement>('[data-testid="copilot-source"]:checked')].map(
        (input) => input.closest("label")?.textContent?.trim(),
      );
    async function visit(route: Route, source?: string) {
      await view.navigation.navigate(route);
      await eventually(() => expect(checked()).toEqual(source ? [source] : []));
    }
    await visit(projectOverviewRoute(first));
    await visit(pbiDetailRoute(first, "UC-09"), "UC-09 · Review CSV");
    await visit(storyMapsRoute(first, map), "SM-01 · Service steps");
    await visit(nfrCatalogRoute(first, nfr), nfr + " · Reliability");
    await visit(domainModelRoute(first, entity), "ENT-02 · Service case");
    await visit(traceRoute(first, "UC-09"), "UC-09 · Review CSV");
    fillPrompt(panel, "Explain the selected PBI");
    send(panel);
    await eventually(() =>
      expect(
        panel.querySelector('[data-testid="copilot-thread"] option:nth-child(2)'),
      ).not.toBeNull(),
    );
    await view.navigation.navigate(projectOverviewRoute(first));
    expect(checked()).toEqual(["UC-09 · Review CSV"]);
    expect(stream).toHaveBeenCalledTimes(1);
  }));

it("aborts on a target change and discards a late reply before an explicit retry", () =>
  withReview(async ({ host, panel, stream, view }) => {
    let unblock: (() => void) | undefined;
    const release = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    stream.mockImplementationOnce(async function* () {
      yield "First partial";
      await release;
      yield "Late target response";
    });
    try {
      fillPrompt(panel, "Check the handover");
      send(panel);
      await eventually(() => expect(panel.textContent).toContain("First partial"));
      await view.navigation.navigate(knowledgeDetailRoute(first, unrelated));
      await eventually(() => expect(stream.mock.calls[0]?.[1]?.aborted).toBe(true));
      fillPrompt(panel, "Check the other note");
      send(panel);
      await eventually(() => expect(panel.textContent).toContain("Controlled answer"));
      unblock?.();
      await eventually(async () => {
        const saved = await host.runtime.runPromise(loadCopilot(first));
        expect(saved?.threads).toHaveLength(1);
        expect(saved?.threads[0]?.messages.map(({ content }) => content)).toEqual([
          "Check the other note",
          "Controlled answer",
        ]);
      });
      expect(panel.textContent).not.toContain("Late target response");
    } finally {
      unblock?.();
    }
  }));

it("keeps a generated PRD separate until explicit apply and saves the edited canonical note once", () =>
  withReview(async ({ host, panel, stream, view }) => {
    stream.mockImplementationOnce(async function* () {
      yield JSON.stringify({
        title: "Provider draft",
        body: "## Requirement\nVerify the controlled handover.",
      });
    });
    expect([...task(panel, "draft").options].map(({ value }) => value)).toContain("draft");
    const kind = await eventually(() =>
      find<HTMLSelectElement>(panel, '[data-testid="copilot-draft-kind"]'),
    );
    kind.value = "prd";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    fillPrompt(panel, "Write a PRD");
    send(panel);
    const proposal = await eventually(() => find(panel, '[data-testid="copilot-proposal"]'));
    expect(
      (await host.runtime.runPromise(knowledgeNoteOptions(first))).map(({ title }) => title),
    ).not.toContain("Provider draft");
    const titleInput = find<HTMLInputElement>(proposal, '[data-testid="copilot-proposal-title"]');
    titleInput.value = "Edited handover";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    const apply = find<HTMLButtonElement>(proposal, '[data-testid="copilot-apply"]');
    apply.click();
    apply.click();
    await eventually(async () => {
      await host.runtime.runPromise(rebuildNoteIndex);
      const notes = (await host.runtime.runPromise(knowledgeNoteOptions(first))).filter(
        ({ title }) => title === "Edited handover",
      );
      expect(notes).toHaveLength(1);
      const note = notes[0];
      if (!note) throw new Error("Missing saved canonical note");
      expect(note.values.approval).toBe("draft");
      expect(note.values.references?.join("\n")).toContain(primary);
      expect(view.navigation.current()).toEqual(knowledgeDetailRoute(first, note.id));
    });
    expect(stream).toHaveBeenCalledTimes(1);
  }));

it("keeps a second editor's dirty revision intact and offers a new note even after the original disappears", () =>
  withReview(async ({ host, panel, stream, route }) => {
    stream.mockImplementationOnce(async function* () {
      yield JSON.stringify({ title: "Proposed revision", body: "## Revised handover" });
    });
    await eventually(() => expect(panel.textContent).toContain("Exact handover"));
    task(panel, "revise");
    fillPrompt(panel, "Revise the current note");
    send(panel);
    const proposal = await eventually(() => find(panel, '[data-testid="copilot-proposal"]'));
    const secondRoot = document.body.appendChild(document.createElement("div"));
    const other = await mountApp(secondRoot, host.runtime, { initial: route });
    try {
      (
        await eventually(() =>
          find<HTMLButtonElement>(secondRoot, '[data-testid="knowledge-edit"]'),
        )
      ).click();
      const editor = await eventually(() =>
        find<HTMLTextAreaElement>(secondRoot, 'textarea[name="markdown"]'),
      );
      editor.value = "Unsaved work in a second leaf";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      const apply = find<HTMLButtonElement>(proposal, '[data-testid="copilot-apply"]');
      apply.click();
      const saveNew = await eventually(() =>
        find<HTMLButtonElement>(proposal, '[data-testid="copilot-save-as-new"]'),
      );
      expect(apply.disabled).toBe(true);
      expect(editor.value).toBe("Unsaved work in a second leaf");
      const store = await host.runtime.runPromise(NoteStore);
      const original = (await host.runtime.runPromise(knowledgeNoteOptions(first))).find(
        ({ id }) => id === primary,
      );
      if (!original) throw new Error("Missing original fixture note");
      const saved = await host.runtime.runPromise(store.readContent(original.path));
      expect(saved.body).toContain("Private body: Exact handover");
      expect(saved.frontmatter.approval).toBe("approved");
      await host.runtime.runPromise(store.trash(original.path));
      saveNew.click();
      await eventually(async () => {
        await host.runtime.runPromise(rebuildNoteIndex);
        expect(
          (await host.runtime.runPromise(knowledgeNoteOptions(first))).map(({ title }) => title),
        ).toContain("Proposed revision");
      });
    } finally {
      other.close();
      secondRoot.remove();
    }
  }));

it("renders readable provider Markdown without remote images and opens a selected citation natively", () =>
  withReview(async ({ root, panel, stream, view }) => {
    stream.mockImplementationOnce(async function* () {
      yield "### Findings\n\n**Check** the requirement.\n\n![Remote image](https://invalid.example/demo.png)\n\n<script>unsafe()</script>";
    });
    const sibling = await eventually(() =>
      find<HTMLInputElement>(panel, '[data-testid="copilot-source"][value$="000000000010"]'),
    );
    sibling.click();
    fillPrompt(panel, "Review the related document");
    send(panel);
    await eventually(() =>
      expect(panel.querySelector("[role=log] h4")?.textContent).toBe("Findings"),
    );
    expect(panel.querySelector("[role=log] strong[data-markdown]")?.textContent).toBe("Check");
    expect(panel.querySelector("[role=log] img, [role=log] script")).toBeNull();
    const citation = await eventually(() =>
      find<HTMLButtonElement>(
        panel,
        '[data-testid="copilot-source-link"][data-source-key$="000000000010"]',
      ),
    );
    citation.click();
    await eventually(() =>
      expect(view.navigation.current()).toEqual(knowledgeDetailRoute(first, unrelated)),
    );
    await eventually(() => expect(document.activeElement).toBe(root.querySelector("h1")));
  }));

it("opens the same guarded workspace on the legacy route when this leaf has an active project", () =>
  withReview(async ({ root, stream, view }) => {
    find<HTMLButtonElement>(root, '[role="dialog"] button[data-slot="close"]').click();
    await eventually(() =>
      expect(root.querySelector('[data-testid="copilot-workspace"]')).toBeNull(),
    );
    await view.navigation.navigate({ name: AGENT_CHAT });
    const workspace = await eventually(() => find(root, '[data-testid="copilot-workspace"]'));
    expect(workspace.textContent).toContain("Kundenportal");
    expect(workspace.querySelectorAll('[data-testid="copilot-source"]:checked')).toHaveLength(0);
    expect(stream).not.toHaveBeenCalled();
  }));

it("starts a fresh contextual review for a different artifact and keeps the prior thread available", () =>
  withReview(async ({ root, panel, stream, view, reopen }) => {
    fillPrompt(panel, "Prior scoped request");
    send(panel);
    await eventually(() => expect(panel.textContent).toContain("Controlled answer"));
    await eventually(() =>
      expect(find<HTMLSelectElement>(panel, '[data-testid="copilot-thread"]').options).toHaveLength(
        2,
      ),
    );
    find<HTMLButtonElement>(root, '[role="dialog"] button[data-slot="close"]').click();
    await view.navigation.navigate(knowledgeDetailRoute(first, unrelated));
    await eventually(() =>
      expect(root.querySelector("h1")?.textContent?.trim()).toBe("Unselected sibling"),
    );
    const next = await reopen();
    const threads = find<HTMLSelectElement>(next, '[data-testid="copilot-thread"]');
    await eventually(() => expect(threads.options).toHaveLength(2));
    expect(threads.value).toBe("");
    const selected = () =>
      find<HTMLInputElement>(next, '[data-testid="copilot-source"]:checked').value;
    await eventually(() => expect(selected()).toBe("knowledge:" + unrelated));
    expect(next.querySelector("[role=log]")?.textContent).not.toContain("Prior scoped request");
    threads.selectedIndex = 1;
    threads.dispatchEvent(new Event("change", { bubbles: true }));
    await eventually(() => expect(selected()).toBe("knowledge:" + primary));
    expect(next.querySelector("[role=log]")?.textContent).toContain("Prior scoped request");
    expect(stream).toHaveBeenCalledTimes(1);
  }));
