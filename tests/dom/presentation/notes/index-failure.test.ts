import { expect, it } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { noteChanges, noteSnapshot } from "../../../../src/application/notes";
import { useRecordScreen } from "../../../../src/presentation/notes";
import { ErrorNotice, mountSurface, useStream } from "../../../../src/presentation/shell";
import { testNoteType } from "../../../support/notes/test-note-type";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

await preloadSurface();

const recordScreen = defineComponent({
  setup() {
    const root = ref<HTMLElement | null>(null);
    const snapshot = useStream(noteSnapshot(testNoteType), noteChanges(testNoteType));
    const list = computed(() => ({ ...snapshot.value, rows: [] }));
    const screen = useRecordScreen({ type: testNoteType, list, root: () => root.value });
    return () =>
      h("div", { ref: root }, [
        screen.failure.value
          ? h(ErrorNotice, { message: screen.failure.value, handlers: { retry: screen.retry } })
          : null,
        screen.empty.value ? h("p", "No records") : null,
      ]);
  },
});

it("offers a retry after an index failure and shows the resulting empty state", async () => {
  const fixture = testRuntime({ language: "en", noteTypes: [testNoteType] });
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    fixture.notes.setFailReads(true);
    await fixture.vaultReady();
    close = await mountSurface(root, fixture.runtime, { content: recordScreen });
    const alert = await eventually(() => {
      const result = root.querySelector("[role='alert']");
      if (!result) throw new Error("The index failure alert is still loading");
      return result;
    });
    expect(alert.textContent).toContain("Could not read records");
    const retry = alert.querySelector("button");
    expect(retry?.textContent?.trim()).toBe("Retry");
    fixture.notes.setFailReads(false);
    retry?.click();
    await eventually(() => expect(root.textContent).toContain("No records"));
    expect(root.querySelector("[role='alert']")).toBeNull();
  } finally {
    close?.();
    root.remove();
    await fixture.runtime.dispose();
  }
});
