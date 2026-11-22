import { expect, it } from "vitest";
import {
  fill,
  find,
  firstItem,
  ITEM_ID,
  ITEM_PATH,
  namedButton,
  openItems,
  save,
  text,
  until,
} from "../../../support/items/screen";

it("retains unknown properties and the body, follows the title, and refocuses the same card", async () => {
  const body = "The original body.\n";
  const view = await openItems({
    path: ITEM_PATH,
    frontmatter: { ...firstItem, unknown: ["kept"] },
    body,
  });
  try {
    const control = find<HTMLButtonElement>(
      view.screen,
      `[data-card-key="${ITEM_ID}"] [data-focus="edit"]`,
    );
    control.click();
    const form = await view.editor();
    fill(form, { title: "Renamed item", status: "done" });
    save(form);
    await until(() => expect(view.screen.textContent).toContain("Renamed item"));
    const newPath = "Records/Items/Renamed item.md";
    expect((await view.read(newPath)).frontmatter).toMatchObject({
      title: "Renamed item",
      status: "done",
      unknown: ["kept"],
      id: ITEM_ID,
    });
    expect(view.notes.body(newPath)).toBe(body);
    await until(() => expect(document.activeElement).toBe(control));
  } finally {
    await view.close();
  }
});

it("shows the three conflicting values and retries against the live note", async () => {
  const view = await openItems({ path: ITEM_PATH, frontmatter: firstItem });
  try {
    find<HTMLButtonElement>(view.screen, '[data-focus="edit"]').click();
    const form = await view.editor();
    fill(form, { title: "My edit" });
    await view.runtime.runPromise(
      view.notes.seed(ITEM_PATH, { ...firstItem, title: "Outside edit", status: "done" }),
    );
    save(form);
    const heading = await until(() => find(form, 'h3[tabindex="-1"]'));
    expect(heading.textContent?.trim()).toBe(text.notes.conflict.title);
    expect(form.textContent).toContain("First item");
    expect(form.textContent).toContain("My edit");
    expect(form.textContent).toContain("Outside edit");
    expect((await view.read(ITEM_PATH)).frontmatter.title).toBe("Outside edit");
    find<HTMLInputElement>(form, 'input[type="radio"][value="mine"]').click();
    const apply = namedButton(form, text.notes.conflict.apply);
    await until(() => expect(apply.getAttribute("aria-disabled")).toBe("false"));
    apply.click();
    await until(() => find(form, '[name="title"]'));
    save(form);
    await until(() => expect(view.screen.textContent).toContain("My edit"));
    const note = await view.read(ITEM_PATH);
    expect(note.frontmatter).toMatchObject({ title: "My edit", status: "done" });
  } finally {
    await view.close();
  }
});
