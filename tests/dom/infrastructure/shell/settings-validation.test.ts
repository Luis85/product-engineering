import { expect, it } from "vitest";
import { observeSettingValidation } from "../../../../src/infrastructure/obsidian/shell/settings-validation";
import { eventually } from "../../../support/wait";

function validationRow(owner: HTMLElement, type = "text") {
  const row = owner.appendChild(owner.ownerDocument.createElement("div"));
  row.className = "setting-item";
  const control = row.appendChild(owner.ownerDocument.createElement("div"));
  control.className = "setting-item-control";
  const input = control.appendChild(owner.ownerDocument.createElement("input"));
  input.type = type;
  const error = control.appendChild(owner.ownerDocument.createElement("div"));
  error.className = "setting-item-error";
  error.textContent = "Use an absolute program file path.";
  return { row, input, error };
}

it("announces native field validation and preserves previous descriptions when corrected", async () => {
  const root = document.body.appendChild(document.createElement("div"));
  const tab = root.appendChild(document.createElement("div"));
  const { row, input, error } = validationRow(tab);
  const unrelated = validationRow(root);
  input.setAttribute("aria-describedby", "original-description");
  input.value = "relative-codex.exe";
  const stop = observeSettingValidation(tab);
  try {
    row.classList.add("is-invalid");
    unrelated.row.classList.add("is-invalid");
    await eventually(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(error.id).toMatch(/^pe-setting-error-\d+$/);
    expect(error.getAttribute("role")).toBe("alert");
    expect(input.getAttribute("aria-describedby")).toBe(`original-description ${error.id}`);
    expect(input.value).toBe("relative-codex.exe");
    expect(unrelated.input.getAttribute("aria-invalid")).toBeNull();

    row.classList.remove("is-invalid");
    await eventually(() => expect(input.getAttribute("aria-invalid")).toBeNull());
    expect(input.getAttribute("aria-describedby")).toBe("original-description");
  } finally {
    stop();
    root.remove();
  }
});

it("clears its own ARIA only and stops observing native controls after disposal", async () => {
  const tab = document.body.appendChild(document.createElement("div"));
  const { row, input, error } = validationRow(tab);
  const numberField = validationRow(tab, "number");
  const stop = observeSettingValidation(tab);
  try {
    row.classList.add("is-invalid");
    numberField.row.classList.add("is-invalid");
    await eventually(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(numberField.input.getAttribute("aria-describedby")).toBeNull();
    row.classList.remove("is-invalid");
    await eventually(() => expect(input.getAttribute("aria-describedby")).toBeNull());
    expect(input.getAttribute("aria-invalid")).toBeNull();

    stop();
    row.classList.add("is-invalid");
    await Promise.resolve();
    expect(input.getAttribute("aria-invalid")).toBeNull();
  } finally {
    stop();
    tab.remove();
  }
});

it("can dispose validation for an owner document without a native view", () => {
  const detached = document.implementation.createHTMLDocument();
  const stop = observeSettingValidation(detached.body);
  expect(stop).not.toThrow();
});
