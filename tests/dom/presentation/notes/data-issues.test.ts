import { expect, it } from "vitest";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { mountApp } from "../../../support/surface";
import { eventually } from "../../../support/wait";

await preloadSurface();

it("shows an issue count beside the real section and opens an affected note", async () => {
  const fixture = testRuntime({ language: "en", initialSettings: { rootFolder: "Records" } });
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    await fixture.runtime.runPromise(fixture.notes.seed("Records/Broken.md", "broken"));
    await fixture.runtime.runPromise(fixture.notes.seed("Outside/Other.md", "broken"));
    await fixture.runtime.runPromise(
      fixture.notes.seed("Outside/Malformed.md", {
        schema: "product-engineering.invalid-marker",
      }),
    );
    await fixture.vaultReady();
    const opened = await mountApp(root, fixture.runtime, {
      initial: { name: "settings", section: "items" },
    });
    close = opened.close;
    const button = await eventually(() => {
      const target = Array.from(
        root.querySelectorAll<HTMLButtonElement>("[data-testid='settings-sections'] button"),
      ).find((element) => element.textContent?.includes("Data issues"));
      if (!target) throw new Error("The data issues section was not contributed");
      return target;
    });
    button.click();
    const list = await eventually(() => {
      const content = root.querySelector("[data-testid='data-issues-list']");
      if (!content) throw new Error("The data issues list is still loading");
      return content;
    });
    expect(opened.navigation.current()).toEqual({ name: "settings", section: "data-issues" });
    expect(list.textContent).toContain("Records/Broken.md");
    expect(list.textContent).toContain("Outside/Malformed.md");
    expect(list.textContent).not.toContain("Outside/Other.md");
    await eventually(() =>
      expect(button.querySelector("[data-testid='data-issues-badge']")?.textContent).toBe("2"),
    );
    const record = Array.from(list.querySelectorAll("li")).find((item) =>
      item.textContent?.includes("Records/Broken.md"),
    );
    const open = record?.querySelector("button");
    expect(open?.textContent?.trim()).toBe("Open in Obsidian");
    open?.click();
    await eventually(() => expect(fixture.notes.opened()).toEqual(["Records/Broken.md"]));
  } finally {
    close?.();
    root.remove();
    await fixture.runtime.dispose();
  }
});
