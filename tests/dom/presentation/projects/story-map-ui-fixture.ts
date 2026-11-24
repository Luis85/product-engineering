import { expect } from "vitest";
import { eventually } from "../../../support/wait";
import { find, first } from "./knowledge-fixture";

export const map = "story-map-33333333-3333-4333-8333-000000000821";
export const folder = "Product Engineering/Projects/Kundenportal";
export const mapPath = folder + "/Story Maps/SM-01.md";
export const panel = '[role="dialog"][data-state="open"]';
export const testId = (id: string) => `[data-testid="${id}"]`;
export const press = (root: HTMLElement, selector: string) =>
  find<HTMLButtonElement>(root, selector).click();
export const shown = (root: HTMLElement, selector: string) =>
  eventually(() => expect(root.querySelector(selector)).toBeTruthy());
export const gone = (root: HTMLElement, selector: string) =>
  eventually(() => expect(root.querySelector(selector)).toBeNull());
export const text = (root: HTMLElement, selector: string, expected: string) =>
  eventually(() => expect(find(root, selector).textContent).toContain(expected));

export function mapFields() {
  return {
    schema: "product-engineering.story-map/v1",
    id: map,
    project_id: first,
    display_id: "SM-01",
    title: "Review the journey",
    goal: "Hand off open cases",
    persona: "Coordinator",
    activities: [],
    steps: [],
    slices: [],
    cards: [],
    card_links: [],
  };
}

export function field(root: HTMLElement, name: string, value: string, event = "input") {
  const control = find<HTMLInputElement>(root, `${panel} [name="${name}"]`);
  control.value = value;
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

export function named(root: HTMLElement, label: string) {
  return find<HTMLButtonElement>(root, `button[aria-label=${JSON.stringify(label)}]`);
}

export function section(root: HTMLElement, label: string) {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    ({ textContent }) => textContent?.trim() === label,
  );
  if (!button) throw new Error("Missing button named " + label);
  return button;
}
