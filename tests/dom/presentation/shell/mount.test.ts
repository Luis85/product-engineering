import UModal from "@nuxt/ui/components/Modal.vue";
import { expect, it } from "vitest";
import { defineComponent, h, useId } from "vue";
import { SCOPE_CLASS as STYLE_SCOPE } from "../../../../scripts/scope-css.mjs";
import { setLogLevel } from "../../../../src/application/shell";
import { mountSurface, useSettings } from "../../../../src/presentation/shell";
import { PORTAL_CLASS, SCOPE_CLASS } from "../../../../src/presentation/shell/scope";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

await preloadSurface();

function attachRoot(owner: Document = document) {
  const root = owner.createElement("div");
  owner.body.append(root);
  return root;
}

const ModalContent = defineComponent({
  render() {
    return h(
      UModal,
      { title: "Modal probe", description: "Surface ownership", close: false, transition: false },
      {
        default: () => h("button", { type: "button", "data-open": "" }, "Open modal"),
        body: () => h("div", { "data-modal-body": "" }, "Modal content"),
      },
    );
  },
});

it.each(["main", "pop-out"])(
  "keeps modal mounts inside the %s document without writing to head",
  async (target) => {
    const owner =
      target === "main" ? document : document.implementation.createHTMLDocument("Pop-out");
    const fixture = testRuntime();
    const root = attachRoot(owner);
    const headCount = document.head.childElementCount;
    const ownerHeadCount = owner.head.childElementCount;
    const mainChildren = document.body.childElementCount;
    let close: (() => void) | undefined;
    try {
      close = await mountSurface(root, fixture.runtime, { content: ModalContent });
      expect(SCOPE_CLASS).toBe(STYLE_SCOPE);
      expect(root.classList.contains(SCOPE_CLASS)).toBe(true);
      const portal = root.querySelector(`.${PORTAL_CLASS}`);
      expect(portal?.ownerDocument).toBe(owner);
      expect(document.head.childElementCount).toBe(headCount);
      expect(owner.head.childElementCount).toBe(ownerHeadCount);

      root.querySelector<HTMLButtonElement>("[data-open]")?.click();
      await eventually(() => expect(portal?.querySelector("[data-modal-body]")).toBeTruthy());
      const dialog = portal?.querySelector("[role=dialog]");
      const titleId = dialog?.getAttribute("aria-labelledby") ?? "";
      const descriptionId = dialog?.getAttribute("aria-describedby") ?? "";
      expect(owner.getElementById(titleId)?.textContent?.trim()).toBe("Modal probe");
      expect(owner.getElementById(descriptionId)?.textContent?.trim()).toBe("Surface ownership");
      expect(document.head.childElementCount).toBe(headCount);
      expect(owner.head.childElementCount).toBe(ownerHeadCount);
      expect(document.body.childElementCount).toBe(mainChildren);

      close();
      close();
      expect(root.childElementCount).toBe(0);
      expect(root.classList.contains(SCOPE_CLASS)).toBe(false);
    } finally {
      close?.();
      root.remove();
      await fixture.runtime.dispose();
    }
  },
);

it("gives each view its own IDs and closes without affecting another view on the same runtime", async () => {
  const fixture = testRuntime({ initialSettings: { logLevel: "info" } });
  const first = attachRoot();
  const second = attachRoot();
  const content = defineComponent({
    setup() {
      const settings = useSettings();
      const id = useId();
      return () => h("p", { id, "data-level": "" }, settings.value.logLevel);
    },
  });
  let closeFirst: (() => void) | undefined;
  let closeSecond: (() => void) | undefined;
  try {
    closeFirst = await mountSurface(first, fixture.runtime, { content });
    closeSecond = await mountSurface(second, fixture.runtime, { content });
    expect(first.querySelector("[data-level]")?.textContent).toBe("info");
    expect(second.querySelector("[data-level]")?.textContent).toBe("info");
    expect(first.querySelector("[data-level]")?.id).not.toBe(
      second.querySelector("[data-level]")?.id,
    );

    closeFirst();
    await fixture.runtime.runPromise(setLogLevel("debug"));
    await eventually(() => expect(second.querySelector("[data-level]")?.textContent).toBe("debug"));
    expect(first.childElementCount).toBe(0);
  } finally {
    closeFirst?.();
    closeSecond?.();
    first.remove();
    second.remove();
    await fixture.runtime.dispose();
  }
});

it("reports a child render defect once and keeps its sibling mounted", async () => {
  const fixture = testRuntime();
  const root = attachRoot();
  const broken = defineComponent({
    render() {
      throw new Error("Raw render cause for testing");
    },
  });
  const content = defineComponent({
    render: () => h("main", [h(broken), h("p", "Healthy sibling")]),
  });
  let close: (() => void) | undefined;
  try {
    close = await mountSurface(root, fixture.runtime, { content });
    expect(root.textContent).toContain("Healthy sibling");
    await eventually(() => expect(fixture.notifier).toHaveLength(1));
    expect(fixture.notifier[0]?.detail).toContain("T-1");
    expect(fixture.notifier[0]?.detail).not.toContain("Raw render cause for testing");
    expect(fixture.logger.filter((entry) => entry.event === "defect.reported")).toHaveLength(1);
  } finally {
    close?.();
    root.remove();
    await fixture.runtime.dispose();
  }
});
