import { expect, it, vi } from "vitest";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { NoteStore } from "../../../../src/application/notes";
import {
  addProjectMember,
  createProject,
  projectOverviewRoute,
} from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import { find, first, jobOne, second, withProject } from "./knowledge-fixture";

const path = "Projects/Kundenportal/JOB-12.md";
const title = "Offene Fälle verlässlich übergeben";
const markdown = "## Übergabe\n\n**Offene Fälle** brauchen eine klare Zuständigkeit.\n";
const fields = {
  schema: "product-engineering.knowledge/v1",
  id: jobOne,
  project_id: first,
  title,
  kind: "jtbd",
  display_id: "JOB-12",
  approval: "approved",
};

async function openJob(
  host: Parameters<Parameters<typeof withProject>[0]>[0]["host"],
  navigation: Parameters<Parameters<typeof withProject>[0]>[0]["navigation"],
) {
  await host.runtime.runPromise(host.notes.seed(path, fields, markdown));
  await navigation.navigate(knowledgeDetailRoute(first, jobOne));
}

it("mounts the real Knowledge body in the project record surface", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    await eventually(() => expect(root.querySelector("h1")?.textContent?.trim()).toBe(title));
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-note]")?.textContent ?? "").toContain(
        "Offene Fälle",
      ),
    );
    expect(find(root, "[data-testid=knowledge-body]").textContent).toContain("Übergabe");
    expect(host.notes.opened()).toEqual([]);
  });
});

it("keeps Knowledge current in the breadcrumb and rail on a typed note route", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-body]")).not.toBeNull(),
    );
    const section = find(root, "[data-testid=project-breadcrumb]").textContent?.trim();
    const current = find(
      root,
      "[data-testid=project-rail] [data-pe-focus-key=project-knowledge]",
    ).getAttribute("aria-current");
    expect({ section, current }).toEqual({ section: "Kundenportal / Knowledge", current: "page" });
  });
});

async function enterEditor(root: HTMLElement) {
  const edit = await eventually(() =>
    find<HTMLButtonElement>(root, "[data-testid=knowledge-edit]"),
  );
  edit.click();
  return eventually(() => find<HTMLTextAreaElement>(root, "[name=markdown]"));
}

function changeEditor(editor: HTMLTextAreaElement, value: string) {
  editor.value = value;
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

it("retains the edited Markdown after a failed atomic write and saves it on retry", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    const edit = () => root.querySelector<HTMLButtonElement>("[data-testid=knowledge-edit]");
    await eventually(() => expect(edit()).toBeInstanceOf(HTMLButtonElement));
    edit()?.click();
    const editor = await eventually(() => find<HTMLTextAreaElement>(root, "[name=markdown]"));
    const changed = `${markdown}\n- Übergabe dokumentieren\n`;
    editor.value = changed;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    host.notes.setFailWrites(true);
    const save = find<HTMLButtonElement>(root, "[data-testid=knowledge-save]");
    await eventually(() => expect(save.disabled).toBe(false));
    save.click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-save-error]")?.textContent ?? "").toContain(
        "saved",
      ),
    );
    expect(editor.value).toBe(changed);
    expect(host.notes.body(path)).toBe(markdown);
    host.notes.setFailWrites(false);
    save.click();
    await eventually(() => expect(host.notes.body(path)).toBe(changed));
    expect(root.querySelector("[data-testid=knowledge-save-error]")).toBeNull();
  });
});

it("shows the conflict after an outside write during save and reloads only on request", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    const editor = await enterEditor(root);
    changeEditor(editor, "My draft\n");
    const save = find<HTMLButtonElement>(root, "[data-testid=knowledge-save]");
    await eventually(() => expect(save.disabled).toBe(false));
    host.notes.holdWrites();
    try {
      save.click();
      await eventually(() => expect(host.notes.heldWrites()).toBe(1));
      await host.runtime.runPromise(
        host.notes.seed(path, { ...fields, external: "retained" }, "External body\n"),
      );
    } finally {
      host.notes.releaseWrites();
    }
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-conflict]")?.textContent ?? "").toContain(
        "changed outside",
      ),
    );
    expect(editor.value).toBe("My draft\n");
    expect(host.notes.body(path)).toBe("External body\n");
    find<HTMLButtonElement>(root, "[data-testid=knowledge-reload]").click();
    await eventually(() => expect(editor.value).toBe("External body\n"));
  });
});

it("guards dirty Back, restores the caret on cancel and awaits a deliberate save", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    const editor = await enterEditor(root);
    changeEditor(editor, "My draft\n");
    editor.focus();
    editor.setSelectionRange(3, 7);
    const back = find<HTMLButtonElement>(root, "[data-testid=frame-history] button");
    back.click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-keep-editing]")).not.toBeNull(),
    );
    find<HTMLButtonElement>(root, "[data-testid=knowledge-keep-editing]").click();
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(editor));
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([3, 7]);
    changeEditor(editor, "Continue writing\n");

    back.click();
    const leave = await eventually(() =>
      find<HTMLButtonElement>(root, "[data-testid=knowledge-save-leave]"),
    );
    host.notes.holdWrites();
    try {
      leave.click();
      await eventually(() => expect(host.notes.heldWrites()).toBe(1));
      expect(navigation.current()).toEqual(knowledgeDetailRoute(first, jobOne));
    } finally {
      host.notes.releaseWrites();
    }
    await eventually(() => expect(navigation.current()).toEqual(projectOverviewRoute(first)));
    expect(host.notes.body(path)).toBe("Continue writing\n");
  });
});

it("saves title, project assignment and approval without overwriting an outside frontmatter key", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    const member = "project-member-33333333-3333-4333-8333-000000000032";
    await host.runtime.runPromise(
      addProjectMember(first, member, { name: "Mara König", role: "product-owner" }),
    );
    await enterEditor(root);
    const titleInput = root.querySelector<HTMLInputElement>("input[name=title]");
    expect(titleInput?.value).toBe(title);
    if (!titleInput) throw new Error("Missing title control");
    titleInput.value = "Servicefälle eindeutig übergeben";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    const owner = await eventually(() => {
      const select = find<HTMLSelectElement>(root, "[name=owner_id]");
      expect(Array.from(select.options).some(({ value }) => value === member)).toBe(true);
      return select;
    });
    owner.value = member;
    owner.dispatchEvent(new Event("change", { bubbles: true }));
    const approval = find<HTMLSelectElement>(root, "[name=approval]");
    approval.value = "in-review";
    approval.dispatchEvent(new Event("change", { bubbles: true }));
    await host.runtime.runPromise(
      host.notes.seed(path, { ...fields, external: "preserve me" }, markdown),
    );
    const save = find<HTMLButtonElement>(root, "[data-testid=knowledge-save]");
    await eventually(() => expect(save.disabled).toBe(false));
    save.click();
    await eventually(async () => {
      const persisted = await host.runtime.runPromise(
        NoteStore.use((store) => store.readContent(path)),
      );
      expect(persisted.frontmatter).toMatchObject({
        title: "Servicefälle eindeutig übergeben",
        owner_id: member,
        approval: "in-review",
        external: "preserve me",
      });
      expect(persisted.body).toBe(markdown);
    });
  });
});

it("exports the exact persisted Markdown while the editor has an unsaved draft", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    const editor = await enterEditor(root);
    changeEditor(editor, "Draft only\n");
    const actions = root.querySelector<HTMLButtonElement>("[data-testid=knowledge-note-actions]");
    expect(actions).not.toBeNull();
    actions?.click();
    const owner = root.ownerDocument.defaultView;
    if (!owner) throw new Error("Missing owner window");
    const createObjectURL = vi
      .spyOn(owner.URL, "createObjectURL")
      .mockReturnValue("blob:vault-note");
    const download = vi
      .spyOn(owner.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    try {
      const exported = await eventually(() =>
        find<HTMLButtonElement>(root, "[data-testid=knowledge-export]"),
      );
      exported.click();
      const blob = await eventually(() => {
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        return createObjectURL.mock.calls[0]?.[0];
      });
      const persisted = await host.runtime.runPromise(
        NoteStore.use((store) => store.readContent(path)),
      );
      if (!(blob instanceof owner.Blob)) throw new Error("Export did not create a Markdown Blob");
      expect(await blob.text()).toBe(persisted.text);
      const anchor = download.mock.instances[0] as HTMLAnchorElement | undefined;
      expect(anchor?.download).toBe("JOB-12.md");
      expect(editor.value).toBe("Draft only\n");
    } finally {
      createObjectURL.mockRestore();
      download.mockRestore();
    }
  });
});

it("adds Markdown formatting at the selection and previews the live draft without writing", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await openJob(host, navigation);
    const editor = await enterEditor(root);
    changeEditor(editor, "Offene Fälle");
    editor.setSelectionRange(0, 6);
    const bold = root.querySelector<HTMLButtonElement>("[data-testid=knowledge-format-bold]");
    expect(bold).not.toBeNull();
    bold?.click();
    await eventually(() => expect(editor.value).toBe("**Offene** Fälle"));
    find<HTMLButtonElement>(root, "[data-testid=knowledge-preview]").click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-body]")?.textContent).toContain(
        "**Offene** Fälle",
      ),
    );
    expect(host.notes.body(path)).toBe(markdown);
    find<HTMLButtonElement>(root, "[data-testid=knowledge-preview]").click();
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(editor));
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 8]);
  });
});

it("uses one dirty confirmation when switching projects and returns to the draft after cancel", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await host.runtime.runPromise(
      createProject(second, {
        name: "Admin Console",
        description: "Manage access",
        repository: "produktteam/admin-console",
      }),
    );
    await openJob(host, navigation);
    const editor = await enterEditor(root);
    changeEditor(editor, "Mein Entwurf");
    find<HTMLButtonElement>(root, "[data-pe-focus-key=project-picker]").click();
    const target = await eventually(() =>
      find<HTMLButtonElement>(
        root,
        '[role=dialog][data-state=open] button[aria-label="Admin Console"]',
      ),
    );
    target.click();
    const keep = await eventually(() =>
      find<HTMLButtonElement>(root, "[data-testid=knowledge-keep-editing]"),
    );
    await eventually(() =>
      expect(root.querySelectorAll("[role=dialog][data-state=open]")).toHaveLength(1),
    );
    keep.click();
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(editor));
    expect(navigation.current()).toEqual(knowledgeDetailRoute(first, jobOne));
    expect(editor.value).toBe("Mein Entwurf");
  });
}, 15_000);

it("keeps invalid metadata and Markdown editable until the title is corrected, then shows the saved Git state", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await openJob(host, navigation);
    const editor = await enterEditor(root);
    changeEditor(editor, "Revised Markdown");
    const titleInput = find<HTMLInputElement>(root, "input[name=title]");
    titleInput.value = "  ";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    const save = find<HTMLButtonElement>(root, "[data-testid=knowledge-save]");
    await eventually(() => expect(save.disabled).toBe(false));
    save.click();
    await eventually(() => expect(root.textContent).toContain("Enter a note title on one line."));
    expect(editor.value).toBe("Revised Markdown");
    expect(host.notes.body(path)).toBe(markdown);
    titleInput.value = "Updated title";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    save.click();
    await eventually(() => expect(host.notes.body(path)).toBe("Revised Markdown"));
    const history = find<HTMLButtonElement>(root, "[data-testid=knowledge-history-tab]");
    history.click();
    await eventually(() => expect(history.getAttribute("aria-pressed")).toBe("true"));
    expect(root.textContent).toContain("Saved to Vault · Git status unverified");
  });
}, 15_000);

it("shows an absent approval separately from unverified Git history", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await host.runtime.runPromise(
      host.notes.seed(
        path,
        {
          ...fields,
          approval: undefined,
        },
        markdown,
      ),
    );
    await navigation.navigate(knowledgeDetailRoute(first, jobOne));
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe(title));
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-body]")?.textContent).toContain("Übergabe"),
    );
    expect(root.textContent).toContain("No approval recorded");
    find<HTMLButtonElement>(root, 'header button[aria-label="Git history"]').click();
    await eventually(() =>
      expect(
        root.querySelector("[data-testid=knowledge-history-tab]")?.getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(root.textContent).toContain("Git status unverified");
  });
}, 15_000);

it("retains a conflicting title draft and reloads the outside title on request", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await openJob(host, navigation);
    await enterEditor(root);
    const titleInput = find<HTMLInputElement>(root, "input[name=title]");
    titleInput.value = "My title";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    await host.runtime.runPromise(
      host.notes.seed(path, { ...fields, title: "Outside title" }, markdown),
    );
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-conflict]")).not.toBeNull(),
    );
    expect(titleInput.value).toBe("My title");
    const reload = find<HTMLButtonElement>(root, "[data-testid=knowledge-reload]");
    host.notes.holdWrites();
    try {
      find<HTMLButtonElement>(root, "[data-testid=knowledge-save]").click();
      await eventually(() => expect(host.notes.heldWrites()).toBe(1));
      expect(reload.disabled).toBe(true);
    } finally {
      host.notes.releaseWrites();
    }
    await eventually(() => expect(reload.disabled).toBe(false));
    reload.click();
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe("Outside title"));
    expect(find<HTMLInputElement>(root, "input[name=title]").value).toBe("Outside title");
    expect(host.notes.body(path)).toBe(markdown);
  });
}, 15_000);
