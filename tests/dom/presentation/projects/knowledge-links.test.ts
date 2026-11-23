import { expect, it } from "vitest";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { NoteStore } from "../../../../src/application/notes";
import type { MarkdownHost } from "../../../../src/presentation/shell/host";
import { eventually } from "../../../support/wait";
import { find, first, jobOne, withProject } from "./knowledge-fixture";

const path = "Projects/Kundenportal/JOB-12.md";
const fields = {
  schema: "product-engineering.knowledge/v1",
  id: jobOne,
  project_id: first,
  title: "Offene Fälle verlässlich übergeben",
  kind: "jtbd",
  display_id: "JOB-12",
  approval: "approved",
};
const markdownHost: MarkdownHost = {
  render: async (body, _path, target) => {
    target.textContent = body;
  },
  files: () => [
    { path: "Sources/A/Guide.md", name: "Guide", kind: "note", headings: [] },
    { path: "Sources/B/Guide.md", name: "Guide", kind: "note", headings: ["Handoff"] },
  ],
  makeLink: ({ path: target, heading, alias }, source) => {
    expect(source).toBe("Projects/Kundenportal/JOB-12.md");
    return `[[${target.slice(0, -3)}${heading}|${alias}]]`;
  },
  resolve: (link) =>
    link.includes("Sources/B/Guide") ? { path: "Sources/B/Guide.md", supported: true } : undefined,
  open: async () => undefined,
  noteLinks: () => ({
    inline: [
      {
        link: "Sources/B/Guide#Handoff",
        label: "Hand-off guide",
        original: "[[Sources/B/Guide#Handoff|Hand-off guide]]",
      },
    ],
    inbound: [],
  }),
};

it("inserts a vault link to the selected file using the preserved text selection as its alias", async () => {
  await withProject(async ({ host, navigation, root }) => {
    await host.runtime.runPromise(host.notes.seed(path, fields, "Read selected text next.\n"));
    await navigation.navigate(knowledgeDetailRoute(first, jobOne));
    const edit = await eventually(() =>
      find<HTMLButtonElement>(root, "[data-testid=knowledge-edit]"),
    );
    edit.click();
    const editor = await eventually(() => find<HTMLTextAreaElement>(root, "[name=markdown]"));
    editor.focus();
    editor.setSelectionRange(5, 18);
    const insert = () =>
      root.querySelector<HTMLButtonElement>("[data-testid=knowledge-insert-link]");
    expect(insert()).not.toBeNull();
    insert()?.click();
    const result = await eventually(() =>
      find<HTMLButtonElement>(root, '[data-vault-file="Sources/B/Guide.md"]'),
    );
    result.click();
    const heading = await eventually(() => find<HTMLSelectElement>(root, "[name=vault-heading]"));
    heading.value = "#Handoff";
    heading.dispatchEvent(new Event("change", { bubbles: true }));
    find<HTMLButtonElement>(root, "[data-testid=knowledge-vault-confirm]").click();
    await eventually(() =>
      expect(editor.value).toBe("Read [[Sources/B/Guide#Handoff|selected text]] next.\n"),
    );
    expect(root.ownerDocument.activeElement).toBe(editor);
    expect(editor.selectionStart).toBe(editor.value.indexOf(" next."));
  }, markdownHost);
});

it("keeps structured references separate from inline Markdown and deduplicates resolved files", async () => {
  await withProject(async ({ host, navigation, root }) => {
    const body = "Inline [[Sources/B/Guide#Handoff|Hand-off guide]].\n";
    await host.runtime.runPromise(
      host.notes.seed(
        path,
        {
          ...fields,
          references: ["[[Missing target]]", "[[Sources/B/Guide.md|Previous label]]"],
        },
        body,
      ),
    );
    await navigation.navigate(knowledgeDetailRoute(first, jobOne));
    const references = () =>
      root.querySelector<HTMLButtonElement>("[data-testid=knowledge-references-tab]");
    await eventually(() => expect(references()).not.toBeNull());
    references()?.click();
    const explicit = () => find(root, "[data-testid=knowledge-explicit-references]");
    const inline = () => find(root, "[data-testid=knowledge-inline-links]");
    await eventually(() => expect(explicit().textContent).toContain("Missing target"));
    expect(inline().textContent).toContain("Hand-off guide");
    expect(explicit().textContent).not.toContain("Hand-off guide");
    const add = find<HTMLButtonElement>(root, "[data-testid=knowledge-add-reference]");
    add.click();
    const result = await eventually(() =>
      find<HTMLButtonElement>(root, '[data-vault-file="Sources/B/Guide.md"]'),
    );
    result.click();
    const confirm = find<HTMLButtonElement>(root, "[data-testid=knowledge-vault-confirm]");
    await eventually(() => expect(confirm.disabled).toBe(false));
    confirm.click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-vault-picker]")).toBeNull(),
    );
    expect(explicit().querySelectorAll("li")).toHaveLength(2);
    const saved = await host.runtime.runPromise(NoteStore.use((store) => store.readContent(path)));
    expect(saved.frontmatter.references).toEqual([
      "[[Missing target]]",
      "[[Sources/B/Guide.md|Previous label]]",
    ]);
    expect(saved.body).toBe(body);

    find<HTMLButtonElement>(explicit(), "li:first-child button").click();
    const save = await eventually(() =>
      find<HTMLButtonElement>(root, "[data-testid=knowledge-save]"),
    );
    save.click();
    await eventually(async () => {
      const latest = await host.runtime.runPromise(
        NoteStore.use((store) => store.readContent(path)),
      );
      expect(latest.frontmatter.references).toEqual(["[[Sources/B/Guide.md|Previous label]]"]);
      expect(latest.body).toBe(body);
    });
  }, markdownHost);
});
