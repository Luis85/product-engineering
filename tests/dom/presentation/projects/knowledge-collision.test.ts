import { expect, it } from "vitest";
import { projectKnowledgeRoute } from "../../../../src/application/knowledge";
import { NoteStore } from "../../../../src/application/notes";
import { addProjectMember, createProject } from "../../../../src/application/projects";
import { clashName, MAX_NAME_ATTEMPTS } from "../../../../src/domain/notes";
import { appSurface } from "../../../../src/presentation/app-surface";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

const projectId = "project-33333333-3333-4333-8333-000000000001";
const memberId = "project-member-33333333-3333-4333-8333-000000000001";

it("keeps dirty fields and focuses the filename field after bounded allocation is exhausted", async () => {
  const host = testRuntime({ language: "en" });
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    const project = await host.runtime.runPromise(
      createProject(projectId, {
        name: "Kundenportal",
        description: "Serviceprozesse für B2B-Kunden",
        repository: "produktteam/kundenportal",
      }),
    );
    await host.vaultReady();
    await host.runtime.runPromise(
      addProjectMember(projectId, memberId, { name: "Mara König", role: "research" }),
    );
    await Promise.all(
      Array.from({ length: MAX_NAME_ATTEMPTS }, (_, index) =>
        host.runtime.runPromise(
          host.notes.seed(
            `${project.folder}/${clashName("Review", index + 1)}.md`,
            "none",
            "Unrelated file",
          ),
        ),
      ),
    );
    const navigation = memoryNavigation(appSurface, projectKnowledgeRoute(projectId));
    close = await mountSurface(root, host.runtime, { surface: appSurface, navigation });
    function element<E extends HTMLElement>(selector: string) {
      const node = root.querySelector<E>(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      return node;
    }
    function set(selector: string, value: string) {
      const control = element<HTMLInputElement | HTMLSelectElement>(selector);
      control.value = value;
      control.dispatchEvent(
        new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
      );
    }
    (await eventually(() => element<HTMLButtonElement>("[data-testid=knowledge-create]"))).click();
    const title = await eventually(() => element<HTMLInputElement>("input[name=title]"));
    set("input[name=title]", "Review");
    set("select[name=kind]", "actor");
    await eventually(() => element<HTMLSelectElement>("select[name=actor_type]"));
    set("select[name=actor_type]", "system");
    await eventually(() =>
      expect(element<HTMLSelectElement>("select[name=owner_id]").options).toHaveLength(2),
    );
    set("select[name=owner_id]", memberId);
    element<HTMLButtonElement>("button[type=submit]").click();
    await eventually(() => expect(title.getAttribute("aria-invalid")).toBe("true"));
    expect(document.activeElement).toBe(title);
    expect(title.value).toBe("Review");
    expect(element<HTMLSelectElement>("select[name=kind]").value).toBe("actor");
    expect(element<HTMLSelectElement>("select[name=actor_type]").value).toBe("system");
    expect(element<HTMLSelectElement>("select[name=owner_id]").value).toBe(memberId);
    expect(host.notes.opened()).toEqual([]);
    expect(host.notes.body(`${project.folder}/Review.md`)).toBe("Unrelated file");
    set("input[name=title]", "Review service");
    element<HTMLButtonElement>("button[type=submit]").click();
    await eventually(() =>
      expect(host.notes.opened()).toEqual([`${project.folder}/Review service.md`]),
    );
    const records = await host.runtime.runPromise(NoteStore.use((store) => store.list));
    expect(records.filter(({ frontmatter }) => frontmatter.kind === "actor")).toMatchObject([
      { frontmatter: { display_id: "AKT-01", actor_type: "system", owner_id: memberId } },
    ]);
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}, 12_000);
