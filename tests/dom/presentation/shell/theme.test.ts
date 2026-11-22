import { expect, it, vi } from "vitest";
import { bindHostTheme } from "../../../../src/presentation/shell/theme";
import { eventually } from "../../../support/wait";

it("follows light and dark host changes and restores its initial classes on release", async () => {
  const root = document.createElement("div");
  root.className = "light existing";
  const previous = document.body.className;
  const disconnect = vi.spyOn(window.MutationObserver.prototype, "disconnect");
  document.body.className = "theme-dark";
  const release = bindHostTheme(root);
  try {
    expect(root.className).toBe("existing dark");
    document.body.className = "theme-light";
    await eventually(() => expect(root.className).toBe("existing light"));
    release();
    expect(root.classList.contains("light")).toBe(true);
    expect(root.classList.contains("dark")).toBe(false);
    expect(disconnect).toHaveBeenCalledOnce();
  } finally {
    release();
    document.body.className = previous;
    disconnect.mockRestore();
  }
});

it("starts from the surface document's host classes", () => {
  const owner = document.implementation.createHTMLDocument("Pop-out theme");
  const root = owner.createElement("div");
  owner.body.className = "theme-light";
  const mainTheme = document.body.className;
  document.body.className = "theme-dark";
  const release = bindHostTheme(root);
  try {
    expect(root.className).toBe("light");
  } finally {
    release();
    document.body.className = mainTheme;
  }
  expect(root.className).toBe("");
});
