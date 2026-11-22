import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import type { RecordRow } from "../../../../src/application/notes";
import { cardKey, useFocusAfter } from "../../../../src/presentation/notes";
import type { FocusTarget } from "../../../../src/presentation/notes/focus-after";

type Row = Pick<RecordRow, "id" | "path" | "issues" | "editable">;

const example: Row = { id: "stable-id", path: "Record.md", issues: [], editable: true };

function focusFixture(initial: readonly Row[]) {
  const rows = ref(initial);
  let schedule: ((target: FocusTarget) => void) | undefined;
  const wrapper = mount(
    defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        schedule = useFocusAfter(
          () => root.value,
          () => rows.value,
        );
        return () =>
          h("div", { ref: root }, [
            h("button", { "data-focus": "add" }, "Add"),
            ...rows.value.map((row) =>
              h("article", { "data-card-key": cardKey(row) }, [
                h("h2", { tabindex: -1, "data-focus": "name" }, row.path),
                row.editable ? h("button", { "data-focus": "edit" }, "Edit") : null,
              ]),
            ),
          ]);
      },
    }),
    { attachTo: document.body },
  );
  const root = wrapper.element as HTMLElement;
  return { rows, root, wrapper, focus: (target: FocusTarget) => schedule?.(target) };
}

it("waits for a saved card and focuses its edit control using the stable ID", async () => {
  const { rows, root, wrapper, focus } = focusFixture([]);
  try {
    const add = root.querySelector<HTMLButtonElement>("[data-focus='add']");
    if (!add) throw new Error("Add control is missing");
    add.focus();
    focus({ kind: "saved", key: "stable-id" });
    await nextTick();
    expect(document.activeElement).toBe(add);
    rows.value = [{ ...example, path: "Renamed.md" }];
    await nextTick();
    expect(document.activeElement).toBe(wrapper.get("[data-focus='edit']").element);
  } finally {
    wrapper.unmount();
  }
});

it("focuses Add once the deleted row disappears and can restore the opener", async () => {
  const { rows, root, wrapper, focus } = focusFixture([example]);
  try {
    const edit = root.querySelector<HTMLButtonElement>("[data-focus='edit']");
    if (!edit) throw new Error("Edit control is missing");
    focus({ kind: "opener", element: edit });
    await nextTick();
    expect(document.activeElement).toBe(edit);
    focus({ kind: "removed", key: "stable-id" });
    await nextTick();
    expect(document.activeElement).toBe(edit);
    rows.value = [];
    await nextTick();
    expect(document.activeElement).toBe(wrapper.get("[data-focus='add']").element);
  } finally {
    wrapper.unmount();
  }
});

it("gives read-only duplicates distinct keys", () => {
  const first = {
    ...example,
    issues: [{ code: "id.duplicate", other: "Other.md" }] as const,
  };
  const second = { ...first, path: "Other.md" };
  expect(cardKey(first)).toBe("Record.md");
  expect(cardKey(second)).toBe("Other.md");
});
