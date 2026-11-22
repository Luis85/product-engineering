import { Effect } from "effect";
import { defineComponent, h, nextTick, ref } from "vue";
import type { Component } from "vue";
import { expect, it, vi } from "vitest";
import { catalogFor } from "../../../../src/application/messages";
import {
  ConflictChoice,
  DeleteRecordDialog,
  OpenNoteButton,
} from "../../../../src/presentation/notes";
import { mountSurface, useModal } from "../../../../src/presentation/shell";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

const text = catalogFor("en").notes;

async function mountContent(fixture: ReturnType<typeof testRuntime>, content: Component) {
  const root = document.createElement("div");
  document.body.append(root);
  const unmount = await mountSurface(root, fixture.runtime, { content });
  return {
    root,
    async close() {
      unmount();
      root.remove();
      await fixture.runtime.dispose();
    },
  };
}

function button(root: ParentNode, label: string): HTMLButtonElement {
  const match = [...root.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!match) throw new Error(`Missing button ${label}`);
  return match;
}

it("focuses the conflict heading and applies only complete field choices", async () => {
  const fixture = testRuntime({ language: "en" });
  const apply = vi.fn<(choices: object) => void>();
  const view = defineComponent({
    render: () =>
      h(ConflictChoice, {
        conflicts: [
          { key: "title", base: "Loaded", edited: "My edit", current: "Outside edit" },
          { key: "done", base: false, edited: true, current: undefined },
        ],
        labels: { title: "Title", done: "Done" },
        onApply: apply,
      }),
  });
  const mounted = await mountContent(fixture, view);
  try {
    const heading = mounted.root.querySelector('[tabindex="-1"]');
    expect(heading?.textContent?.trim()).toBe(text.conflict.title);
    expect(document.activeElement).toBe(heading);
    expect(mounted.root.textContent).toContain("Loaded");
    expect(mounted.root.textContent).toContain("My edit");
    expect(mounted.root.textContent).toContain("Outside edit");

    const applyButton = button(mounted.root, text.conflict.apply);
    expect(applyButton.getAttribute("aria-disabled")).toBe("true");
    expect(applyButton.disabled).toBe(false);
    const [title, done] = mounted.root.querySelectorAll("fieldset");
    title?.querySelector<HTMLInputElement>('input[value="mine"]')?.click();
    await nextTick();
    applyButton.click();
    expect(apply).not.toHaveBeenCalled();
    done?.querySelector<HTMLInputElement>('input[value="current"]')?.click();
    await nextTick();
    applyButton.click();
    expect(apply).toHaveBeenCalledExactlyOnceWith({ title: "mine", done: "current" });
  } finally {
    await mounted.close();
  }
});

it("focuses cancel and protects active deletion from repeated activation", async () => {
  const fixture = testRuntime({ language: "en" });
  fixture.source.hold();
  const runDelete = () => Effect.asVoid(fixture.source.read);
  const remove = vi.fn<typeof runDelete>(runDelete);
  const deleted = vi.fn<() => void>();
  const open = ref(true);
  const view = defineComponent({
    setup() {
      const modalProps = useModal(open, () => undefined);
      return () =>
        h(DeleteRecordDialog, {
          open: open.value,
          title: "Example",
          modalProps,
          remove,
          onDeleted: deleted,
          "onUpdate:open": (next: boolean) => {
            open.value = next;
          },
        });
    },
  });
  const mounted = await mountContent(fixture, view);
  try {
    const cancel = await eventually(() => button(mounted.root, text.deleteDialog.cancel));
    await eventually(() => expect(document.activeElement).toBe(cancel));
    const confirm = button(mounted.root, text.deleteDialog.confirm);
    confirm.focus();
    confirm.click();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.disabled).toBe(false);
    expect(document.activeElement).toBe(confirm);
    confirm.click();
    cancel.click();
    expect(remove).toHaveBeenCalledOnce();
    expect(open.value).toBe(true);
    fixture.source.release();
    await eventually(() => expect(deleted).toHaveBeenCalledOnce());
    expect(open.value).toBe(false);
  } finally {
    fixture.source.release();
    await mounted.close();
  }
});

it("opens a note for manual repair through the host opener", async () => {
  const fixture = testRuntime({ language: "en" });
  const path = "Unreadable record.md";
  await fixture.runtime.runPromise(fixture.notes.seed(path, "broken"));
  const content = defineComponent({ render: () => h(OpenNoteButton, { path }) });
  const mounted = await mountContent(fixture, content);
  try {
    button(mounted.root, text.openNote).click();
    await eventually(() => expect(fixture.notes.opened()).toEqual([path]));
  } finally {
    await mounted.close();
  }
});
