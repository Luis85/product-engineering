import { Effect } from "effect";
import { expect } from "vitest";
import { catalogFor } from "../../../src/application/messages";
import { NoteStore } from "../../../src/application/notes";
import type { SettingsSection } from "../../../src/application/routes";
import type { Frontmatter } from "../../../src/domain/notes";
import { testRuntime } from "../runtime";
import { mountApp } from "../surface";
import { eventually } from "../wait";

export const text = catalogFor("en");
export const until = eventually;
export const ITEM_PATH = "Records/Items/First item.md";
export const ITEM_ID = "item-00000000-0000-0000-0000-000000000002";
export const firstItem = {
  schema: "product-engineering.item/v1",
  id: ITEM_ID,
  title: "First item",
  status: "open",
};

type Seed = { readonly path: string; readonly frontmatter: Frontmatter; readonly body?: string };

export function find<E extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): E {
  const element = root.querySelector<E>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

export function namedButton(root: ParentNode, label: string): HTMLButtonElement {
  const control = [...root.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  );
  if (!control) throw new Error(`Missing button ${label}`);
  return control;
}

export async function openItems(...seeds: Seed[]) {
  const fixture = testRuntime({ language: "en", initialSettings: { rootFolder: "Records" } });
  const root = document.createElement("div");
  document.body.append(root);
  let unmount: (() => void) | undefined;
  async function close() {
    unmount?.();
    root.remove();
    await fixture.runtime.dispose();
  }

  try {
    await fixture.runtime.runPromise(
      Effect.forEach(
        seeds,
        ({ path, frontmatter, body }) => fixture.notes.seed(path, frontmatter, body),
        { discard: true },
      ),
    );
    await fixture.vaultReady();
    const { navigation, close: closeApp } = await mountApp(root, fixture.runtime);
    unmount = closeApp;
    const sectionLabels = {
      items: text.items.settings.label,
      "data-issues": text.notes.unindexed.label,
    };
    async function openSettings(section: SettingsSection) {
      navigation.navigate({ name: "settings", section });
      await until(() =>
        expect(
          find(root, '[data-testid="settings-sections"] [aria-current="page"]').textContent,
        ).toContain(sectionLabels[section]),
      );
    }
    await openSettings("items");
    const screen = () => find(root, '[data-testid="items-screen"][data-index-ready="true"]');
    await until(screen);
    function start() {
      find<HTMLButtonElement>(screen(), '[data-focus="add"]').click();
    }
    function editor() {
      return until(() => find<HTMLFormElement>(root, '[data-testid="item-form"]'));
    }
    function read(path: string) {
      return fixture.runtime.runPromise(NoteStore.use((store) => store.read(path)));
    }
    return {
      ...fixture,
      root,
      get screen() {
        return screen();
      },
      openSettings,
      close,
      start,
      editor,
      read,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export function fill(
  form: HTMLFormElement,
  values: Partial<Record<"title" | "status" | "due", string>>,
) {
  for (const [name, value] of Object.entries(values)) {
    const field = find<HTMLInputElement | HTMLSelectElement>(form, `[name="${name}"]`);
    field.value = value;
    field.dispatchEvent(
      new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  }
}

export function save(form: HTMLFormElement) {
  find<HTMLButtonElement>(form, '[type="submit"]').click();
}
