import { expect, it } from "vitest";
import { fill, find, openItems, save, text, until } from "../../../support/items/screen";

it("shows validation and creates the item only after the fields are valid", async () => {
  const view = await openItems();
  try {
    view.start();
    const form = await view.editor();
    expect(find<HTMLSelectElement>(form, '[name="status"]').value).toBe("open");
    save(form);
    const summary = await until(() =>
      find(form, '[data-testid="item-form-summary"][role="alert"]'),
    );
    expect(summary.textContent).toContain(text.items.form.summary.title);
    const title = find<HTMLInputElement>(form, '[name="title"]');
    expect(title.getAttribute("aria-invalid")).toBe("true");
    await until(() => expect(document.activeElement).toBe(title));
    expect(view.screen.querySelector("[data-card-key]")).toBeNull();

    fill(form, { title: " A new lamp ", due: "2026-12-01" });
    save(form);
    await until(() => expect(view.screen.textContent).toContain("A new lamp"));
    const note = await view.read("Records/Items/A new lamp.md");
    expect(note.frontmatter).toMatchObject({
      title: "A new lamp",
      status: "open",
      due: "2026-12-01",
    });
    expect(view.notifier).toContainEqual(
      expect.objectContaining({ title: text.notes.notices.created("A new lamp") }),
    );
  } finally {
    await view.close();
  }
});
