import { expect, it } from "vitest";
import {
  knowledgeDetailRoute,
  knowledgeNoteOptions,
  resolveKnowledgeNote,
} from "../../../../src/application/knowledge";
import { createProject } from "../../../../src/application/projects";
import { appSurface } from "../../../../src/presentation/app-surface";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

const first = "project-33333333-3333-4333-8333-000000000001";
const second = "project-33333333-3333-4333-8333-000000000002";
const human = "knowledge-33333333-3333-4333-8333-000000000003";
const system = "knowledge-33333333-3333-4333-8333-000000000004";
const humanPath = "Projects/Kundenportal/Human.md";
const systemPath = "Projects/Kundenportal/System.md";

it("selects either actor by its stable ID and refuses to open another project's replacement file", async () => {
  const host = testRuntime({ language: "en" });
  const root = document.body.appendChild(document.createElement("div"));
  const navigation = memoryNavigation(appSurface, knowledgeDetailRoute(first, human));
  let close: (() => void) | undefined;
  const frontmatter = {
    schema: "product-engineering.knowledge/v1",
    kind: "actor",
    display_id: "AKT-01",
    approval: "draft",
  };
  try {
    await host.runtime.runPromise(
      createProject(first, {
        name: "Kundenportal",
        description: "Serviceprozesse für B2B-Kunden",
        repository: "produktteam/kundenportal",
      }),
    );
    await host.runtime.runPromise(
      host.notes.seed(humanPath, {
        ...frontmatter,
        id: human,
        project_id: first,
        title: "Human",
        actor_type: "human",
      }),
    );
    await host.runtime.runPromise(
      host.notes.seed(systemPath, {
        ...frontmatter,
        id: system,
        project_id: first,
        title: "System",
        actor_type: "system",
        display_id: "AKT-02",
      }),
    );
    await host.vaultReady();
    close = await mountSurface(root, host.runtime, { surface: appSurface, navigation });
    await eventually(async () => {
      const options = await host.runtime.runPromise(knowledgeNoteOptions(first));
      expect(options.map(({ id, path }) => ({ id, path }))).toEqual([
        { id: human, path: humanPath },
        { id: system, path: systemPath },
      ]);
    });
    async function fileButton() {
      return eventually(() => {
        const found = root.querySelector<HTMLButtonElement>("[data-testid=knowledge-file]");
        if (!found) throw new Error("Missing Markdown file action");
        return found;
      });
    }
    (await fileButton()).click();
    await eventually(() => expect(host.notes.opened()).toEqual([humanPath]));
    await navigation.navigate(knowledgeDetailRoute(first, system));
    expect(await host.runtime.runPromise(resolveKnowledgeNote(first, system))).toMatchObject({
      id: system,
      path: systemPath,
      projectId: first,
    });
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe("System"));
    (await fileButton()).click();
    await eventually(() => expect(host.notes.opened()).toEqual([humanPath, systemPath]));

    const stale = await fileButton();
    await host.runtime.runPromise(
      host.notes.seed(systemPath, {
        ...frontmatter,
        id: system,
        project_id: second,
        title: "External replacement",
        actor_type: "system",
      }),
    );
    stale.click();
    await eventually(() => {
      expect(root.querySelector("[role=alert]")?.textContent).toBe("Note unavailable");
    });
    expect(host.notes.opened()).toEqual([humanPath, systemPath]);
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}, 12_000);
