import { expect, it } from "vitest";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { eventually } from "../../../support/wait";
import { find, first, jobOne, seedFoundations, withProject } from "./knowledge-fixture";

async function withEditor(
  test: (
    root: HTMLElement,
    editor: HTMLTextAreaElement,
    stored: () => string | undefined,
  ) => Promise<void>,
) {
  await withProject(async ({ root, host, navigation }) => {
    await seedFoundations(host);
    await navigation.navigate(knowledgeDetailRoute(first, jobOne));
    (await eventually(() => find<HTMLButtonElement>(root, "[data-testid=knowledge-edit]"))).click();
    const editor = await eventually(() =>
      find<HTMLTextAreaElement>(root, "textarea[name=markdown]"),
    );
    await test(root, editor, () => host.notes.body("Projects/Kundenportal/JOB-12.md"));
  });
}

function input(control: HTMLTextAreaElement | HTMLInputElement, value: string) {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

it("applies each reference block style only to the selected Markdown lines", async () => {
  await withEditor(async (root, editor, stored) => {
    const before = stored();
    const lead = "# Lead\n\n";
    const tail = "\n\nTail stays";
    input(editor, lead + "Alpha one\nBeta two" + tail);
    editor.setSelectionRange(lead.length + 2, editor.value.indexOf(tail) + 1);
    const picker = root.querySelector<HTMLSelectElement>("[name=block-format]");
    expect(picker).not.toBeNull();
    if (!picker) return;

    const styles = [
      ["heading", "## Alpha one\n## Beta two"],
      ["paragraph", "Alpha one\nBeta two"],
      ["bullets", "- Alpha one\n- Beta two"],
      ["numbered", "1. Alpha one\n2. Beta two"],
      ["quote", "> Alpha one\n> Beta two"],
    ] as const;
    for (const [format, lines] of styles) {
      picker.value = format;
      picker.dispatchEvent(new Event("change", { bubbles: true }));
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each format uses the selection left by the previous command.
      await eventually(() => expect(editor.value).toBe(lead + lines + tail));
      expect(root.ownerDocument.activeElement).toBe(editor);
      expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe(lines);
    }
    expect(stored()).toBe(before);
  });
}, 15_000);

it("retains invalid ordinary URLs for correction and inserts a valid link at the selection", async () => {
  await withEditor(async (root, editor, stored) => {
    const before = stored();
    const body = "Visit the handbook for more.";
    input(editor, body);
    editor.setSelectionRange(6, 18);
    const open = root.querySelector<HTMLButtonElement>("[data-testid=knowledge-insert-web-link]");
    expect(open).not.toBeNull();
    open?.click();
    const dialog = await eventually(() => find(root, "[role=dialog][data-state=open]"));
    const url = find<HTMLInputElement>(dialog, "input[name=url]");
    const submit = find<HTMLButtonElement>(dialog, "button[type=submit]");
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(url));

    for (const invalid of ["not a URL", "https://", "ftp://example.invalid/guide"]) {
      input(url, invalid);
      submit.click();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each rejected submission must settle before the next correction.
      await eventually(() => expect(url.getAttribute("aria-invalid")).toBe("true"));
      expect(url.value).toBe(invalid);
      expect(editor.value).toBe(body);
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([6, 18]);
    }

    input(url, "https://example.invalid/guide");
    submit.click();
    await eventually(() =>
      expect(editor.value).toBe("Visit [the handbook](https://example.invalid/guide) for more."),
    );
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(editor));
    const end = editor.value.indexOf(" for more.");
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([end, end]);
    expect(stored()).toBe(before);
  });
}, 15_000);
