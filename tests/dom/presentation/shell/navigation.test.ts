import { expect, it } from "vitest";
import { HISTORY_LIMIT } from "../../../../src/application/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { mountTest, testSurface } from "../../../support/surface";
import { eventually } from "../../../support/wait";

await preloadSurface();

async function fixture() {
  const { runtime } = testRuntime({ language: "en" });
  const root = document.body.appendChild(document.createElement("div"));
  try {
    const { close, navigation } = await mountTest(root, runtime);
    return {
      root,
      navigation,
      async dispose() {
        close();
        root.remove();
        await runtime.dispose();
      },
    };
  } catch (error) {
    root.remove();
    await runtime.dispose();
    throw error;
  }
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const item = Array.from(root.querySelectorAll("button")).find(
    (target) => target.getAttribute("aria-label") === label || target.textContent?.trim() === label,
  );
  if (!item) throw new Error(`Missing button ${label}`);
  return item;
}

function screen(root: HTMLElement, id: string) {
  return root.querySelector(`[data-testid='${id}']`);
}

it("navigates screens and keeps keyboard history local to the frame", async () => {
  const view = await fixture();
  try {
    await eventually(() => expect(screen(view.root, "home")).not.toBeNull());
    expect(screen(view.root, "app-frame")?.getAttribute("lang")).toBe("en");
    expect(screen(view.root, "frame-navigation")).not.toBeNull();
    await eventually(() =>
      expect(screen(view.root, "frame-context")?.textContent).toContain("Workspace context"),
    );
    expect(screen(view.root, "frame-history")).toBeNull();
    button(view.root, "Other").click();
    await eventually(() => expect(screen(view.root, "other")).not.toBeNull());
    expect(button(view.root, "Other").getAttribute("aria-current")).toBe("page");

    const back = button(view.root, "Go back");
    const forward = button(view.root, "Go forward");
    expect(forward.getAttribute("aria-disabled")).toBe("true");
    expect(forward.disabled).toBe(false);
    forward.focus();
    forward.click();
    expect(document.activeElement).toBe(forward);
    expect(view.navigation.current()).toEqual({ name: "other" });

    back.click();
    await eventually(() => expect(screen(view.root, "home")).not.toBeNull());
    expect(back.getAttribute("aria-disabled")).toBe("true");
    forward.click();
    await eventually(() => expect(screen(view.root, "other")).not.toBeNull());
  } finally {
    await view.dispose();
  }
});

it("keeps an item screen mounted when only its route parameter changes", async () => {
  const view = await fixture();
  try {
    button(view.root, "Item").click();
    await eventually(() => expect(screen(view.root, "item")?.textContent).toBe("alpha"));
    const element = screen(view.root, "item");
    button(view.root, "Next record").click();
    await eventually(() => expect(screen(view.root, "item")?.textContent).toBe("beta"));
    expect(screen(view.root, "item")).toBe(element);
    button(view.root, "Previous record").click();
    await eventually(() => expect(screen(view.root, "item")?.textContent).toBe("alpha"));
  } finally {
    await view.dispose();
  }
});

it("shows a not-found state with a route back to the start for a missing screen", async () => {
  const view = await fixture();
  try {
    button(view.root, "Unavailable").click();
    await eventually(() =>
      expect(screen(view.root, "not-found")?.textContent).toContain("This page is unavailable"),
    );
    button(view.root, "Back to start").click();
    await eventually(() => expect(screen(view.root, "home")).not.toBeNull());
    view.navigation.navigate({ name: "item", id: "unavailable" });
    await eventually(() => expect(screen(view.root, "not-found")).not.toBeNull());
  } finally {
    await view.dispose();
  }
});

it("caps history, ignores equal visits and clears forward history after a new visit", () => {
  const navigation = memoryNavigation(testSurface());
  for (let index = 0; index <= HISTORY_LIMIT; index += 1) {
    navigation.navigate({ name: "item", id: String(index) });
  }
  expect(navigation.history().back).toHaveLength(HISTORY_LIMIT);
  const history = navigation.history();
  navigation.navigate({ name: "item", id: String(HISTORY_LIMIT) });
  expect(navigation.history()).toBe(history);
  navigation.back();
  expect(navigation.history().forward).toHaveLength(1);
  navigation.navigate({ name: "other" });
  expect(navigation.history().forward).toHaveLength(0);
});
