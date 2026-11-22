import { Effect } from "effect";
import { h, nextTick } from "vue";
import { expect, it, vi } from "vitest";
import { NoteEditConflictError } from "../../../../src/application/notes";
import type { RecordRow } from "../../../../src/application/notes";
import { schemaMarker } from "../../../../src/domain/notes";
import { useRecordForm } from "../../../../src/presentation/notes";
import { mountComposable } from "../../../support/composable";
import { referenceItemType as type } from "../../../support/notes/reference-types";
import { testRuntime } from "../../../support/runtime";

const path = "Items/Example.md";
const id = "item-00000000-0000-0000-0000-000000000001";
const identity = { schema: schemaMarker(type.type, 1), id };
const summary = { title: "Check the fields", detail: "Correct the highlighted values." };
const labels = { title: "Title", status: "Status", due: "Due date" };

function setup(record?: RecordRow<typeof type.fields>, hasConflict = false) {
  const fixture = testRuntime({ language: "en" });
  const done = vi.fn<(savedId: string) => void>();
  const written = vi.fn<(baseline: unknown, input: unknown) => void>();
  let fail = hasConflict;
  const result = { frontmatter: identity };
  let root: HTMLElement | null = null;
  const mounted = mountComposable(
    fixture.runtime,
    () =>
      useRecordForm({
        type,
        ...(record ? { record } : {}),
        initial: { status: "open" },
        create: (input) => Effect.sync(() => (written(undefined, input), result)),
        update: (row, input) =>
          Effect.suspend(() => {
            written(row.frontmatter, input);
            if (!fail) return Effect.succeed(result);
            fail = false;
            return Effect.fail(
              new NoteEditConflictError({
                conflicts: [
                  {
                    key: "title",
                    base: "Before",
                    edited: "My title",
                    current: "Changed elsewhere",
                  },
                  { key: "status", base: "open", edited: "done", current: 42 },
                ],
              }),
            );
          }),
        invalid: "NoteEditConflictError",
        rules: (input) => type.check(input).issues,
        describe: (issue) => `${issue.key} needs attention`,
        labels,
        summary,
        root: () => root,
        done,
      }),
    (form) =>
      h("form", [
        form.summary.value ? h("p", { role: "alert" }, form.summary.value.title) : null,
        ...(["title", "status"] as const).map((key) =>
          h("input", { name: key, "aria-invalid": Boolean(form.issue(key)) }),
        ),
        h("button", { type: "submit", "aria-disabled": form.blocked.value }, "Save"),
      ]),
  );
  root = mounted.root;
  document.body.append(root);
  return {
    ...mounted,
    fixture,
    written,
    done,
    close: async () => {
      mounted.close();
      root.remove();
      await fixture.runtime.dispose();
    },
  };
}

const loaded = {
  path,
  fileName: "Example",
  id,
  editable: true,
  values: { title: "Before", status: "open" } as const,
  frontmatter: { ...identity, title: "Before", status: "open" },
  issues: [],
};

it("shows an alert and focuses the first invalid field on attempted save", async () => {
  const mounted = setup();
  try {
    expect(mounted.result.issue("title")).toBeUndefined();
    await mounted.result.submit();
    await nextTick();
    expect(mounted.root.querySelector('[role="alert"]')?.textContent).toBe(summary.title);
    const first = mounted.root.querySelector('[name="title"]');
    expect(first?.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(first);
    expect(mounted.written).not.toHaveBeenCalled();

    mounted.result.form.setFieldValue("title", "Valid title");
    await mounted.result.submit();
    expect(mounted.done).toHaveBeenCalledExactlyOnceWith(id);
  } finally {
    await mounted.close();
  }
});

it("uses the live values as the new baseline and keeps an invalid chosen value editable", async () => {
  const mounted = setup(loaded, true);
  const form = mounted.result;
  try {
    form.form.setFieldValue("title", "My title");
    form.form.setFieldValue("status", "done");
    await form.submit();
    expect(form.conflicts.value.map(({ key }) => key)).toEqual(["title", "status"]);
    expect(form.blocked.value).toBe(true);
    await form.submit();
    expect(mounted.written).toHaveBeenCalledOnce();

    await form.applyChoices({ title: "mine", status: "current" });
    expect(form.conflicts.value).toEqual([]);
    expect(form.input.value).toMatchObject({ title: "My title", status: 42 });
    expect(form.issue("status")).toBe("status needs attention");
    await form.submit();
    expect(mounted.written).toHaveBeenCalledOnce();

    form.form.setFieldValue("status", "done");
    await form.submit();
    expect(mounted.written).toHaveBeenLastCalledWith(
      { ...identity, title: "Changed elsewhere", status: 42 },
      expect.objectContaining({ title: "My title", status: "done" }),
    );
    expect(mounted.done).toHaveBeenCalledExactlyOnceWith(id);
  } finally {
    await mounted.close();
  }
});

it("keeps an issue at its field until repaired and retains the exact untouched title", async () => {
  const title = " Title with outer blanks ";
  const mounted = setup({
    ...loaded,
    values: { title },
    frontmatter: { ...identity, title, status: 42 },
    issues: [{ key: "status", code: "field.text" }],
  });
  try {
    expect(mounted.result.issue("status")).toBe("status needs attention");
    mounted.result.form.setFieldValue("status", "open");
    expect(mounted.result.issue("status")).toBeUndefined();
    await mounted.result.submit();
    expect(mounted.written).toHaveBeenCalledExactlyOnceWith(
      { ...identity, title, status: 42 },
      expect.objectContaining({ title, status: "open" }),
    );
  } finally {
    await mounted.close();
  }
});
