import { expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { SettingsScreen } from "../../../../src/presentation/shell";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { mountApp, mountTest } from "../../../support/surface";
import { eventually } from "../../../support/wait";

await preloadSurface();

function find(root: HTMLElement, id: string) {
  return root.querySelector(`[data-testid='${id}']`);
}

it("keeps the chosen section button focused while its section changes", async () => {
  const { runtime } = testRuntime({ language: "en" });
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    ({ close } = await mountTest(root, runtime, { initial: { name: "settings", section: "one" } }));
    await eventually(() => expect(find(root, "section-one")).not.toBeNull());
    const settings = find(root, "settings-screen");
    const sections = find(root, "settings-sections");
    expect(sections?.getAttribute("aria-label")).toBe("Settings sections");
    await eventually(() =>
      expect(find(root, "section-one-badge")?.textContent).toBe("Two records"),
    );
    const buttons = Array.from(sections?.querySelectorAll("button") ?? []);
    const [first, second] = buttons;
    if (!first || !second) throw new Error("Expected two settings sections");
    expect(first.getAttribute("aria-current")).toBe("page");
    second.focus();
    second.click();
    await eventually(() => expect(find(root, "section-two")).not.toBeNull());
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-current")).toBe("page");
    expect(first.getAttribute("aria-current")).toBeNull();
    expect(find(root, "settings-screen")).toBe(settings);
    expect(
      find(root, "frame-navigation")?.querySelector("[aria-current=page]")?.textContent?.trim(),
    ).toBe("Settings");
  } finally {
    close?.();
    root.remove();
    await runtime.dispose();
  }
});

it("shows the items section first after opening app settings", async () => {
  const { runtime } = testRuntime();
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    ({ close } = await mountApp(root, runtime));
    await eventually(() => {
      const settings = root.querySelector<HTMLButtonElement>(
        '[data-testid="frame-navigation"] [data-pe-focus-key="settings"]',
      );
      expect(settings).not.toBeNull();
      settings?.click();
    });
    await eventually(() => expect(find(root, "items-screen")).not.toBeNull());
    expect(find(root, "settings-screen")).not.toBeNull();
    const sections = find(root, "settings-sections");
    expect(sections?.querySelectorAll("button")).toHaveLength(2);
    expect(sections?.querySelector("[aria-current='page']")?.textContent?.trim()).toBe("Einträge");
  } finally {
    close?.();
    root.remove();
    await runtime.dispose();
  }
});

it("shows not-found for a settings route with no contributed section", async () => {
  const { runtime } = testRuntime();
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    ({ close } = await mountTest(root, runtime, {
      initial: { name: "settings", section: "unavailable" },
      content: defineComponent({ render: () => h(SettingsScreen) }),
    }));
    await eventually(() => expect(find(root, "not-found")).not.toBeNull());
    expect(find(root, "settings-screen")).not.toBeNull();
  } finally {
    close?.();
    root.remove();
    await runtime.dispose();
  }
});
