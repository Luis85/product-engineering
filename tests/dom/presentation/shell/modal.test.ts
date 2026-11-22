import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import type { Ref } from "vue";
import { expect, it, vi } from "vitest";
import { useModal } from "../../../../src/presentation/shell";
import { provideModalRegistry } from "../../../../src/presentation/shell/modal";

function modalFixture() {
  const first = ref(false);
  const second = ref(false);
  const includeFirst = ref(true);
  const afterClose = vi.fn<() => void>();

  const modal = (open: Ref<boolean>, name: string) =>
    defineComponent({
      setup() {
        const content = useModal(open, afterClose);
        return () =>
          h("aside", { ...content, "data-probe": name }, [
            h("button", { type: "button" }, "Cancel"),
            h("button", { type: "button", "data-autofocus": "" }, "Save"),
          ]);
      },
    });

  const firstModal = modal(first, "first");
  const secondModal = modal(second, "second");
  const wrapper = mount(
    defineComponent({
      setup() {
        const inactive = provideModalRegistry();
        return () =>
          h("main", [
            h("section", { inert: inactive.value, "data-frame": "" }),
            includeFirst.value ? h(firstModal) : null,
            h(secondModal),
          ]);
      },
    }),
    { attachTo: document.body },
  );

  return { first, second, includeFirst, afterClose, wrapper };
}

it("keeps the surface frame inert until every open modal has closed or unmounted", async () => {
  const fixture = modalFixture();
  const frame = fixture.wrapper.get("[data-frame]").element;
  try {
    expect(frame.hasAttribute("inert")).toBe(false);
    fixture.first.value = true;
    fixture.second.value = true;
    await nextTick();
    expect(frame.hasAttribute("inert")).toBe(true);
    fixture.includeFirst.value = false;
    await nextTick();
    expect(frame.hasAttribute("inert")).toBe(true);
    fixture.second.value = false;
    await nextTick();
    expect(frame.hasAttribute("inert")).toBe(false);
  } finally {
    fixture.wrapper.unmount();
  }
});

it("gives the marked control initial focus and delegates focus restoration", async () => {
  const fixture = modalFixture();
  try {
    fixture.first.value = true;
    await nextTick();
    const panel = fixture.wrapper.get("[data-probe='first']");
    const target = panel.get("[data-autofocus]").element;
    expect(panel.attributes("aria-modal")).toBe("true");
    const opening = new Event("open-auto-focus", { cancelable: true });
    panel.element.dispatchEvent(opening);
    expect(opening.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(target);

    fixture.first.value = false;
    const closing = new Event("close-auto-focus", { cancelable: true });
    panel.element.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);
    await nextTick();
    expect(fixture.afterClose).toHaveBeenCalledOnce();
  } finally {
    fixture.wrapper.unmount();
  }
});
