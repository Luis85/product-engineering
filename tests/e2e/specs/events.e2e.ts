import { browser, expect } from "@wdio/globals";
import { disablePlugin, enablePlugin, installConsoleSpy, pluginProblems } from "../support";

function listenerCounts(): Promise<number[]> {
  return browser.executeObsidian(({ app }) => {
    function count(events: object, name: string): number {
      const map = Reflect.get(events, "_") as
        Readonly<Record<string, unknown>> | ReadonlyMap<string, unknown> | undefined;
      if (!map) throw new Error("Expected Obsidian's internal event map");
      const list: unknown =
        map instanceof Map ? map.get(name) : (map as Readonly<Record<string, unknown>>)[name];
      if (list === undefined) return 0;
      if (Array.isArray(list)) return list.length;
      if (list instanceof Set) return list.size;
      throw new Error("Expected Obsidian's event listener list");
    }
    return [
      count(app.vault, "create"),
      count(app.vault, "modify"),
      count(app.vault, "delete"),
      count(app.vault, "rename"),
      count(app.metadataCache, "changed"),
    ];
  });
}

it("installs and removes one listener per file event, with clean vault changes", async () => {
  await installConsoleSpy();
  await disablePlugin();
  const baseline = await listenerCounts();

  const cycle = async () => {
    await enablePlugin();
    await browser.waitUntil(async () => {
      const counts = await listenerCounts();
      return counts.every((count, index) => count === (baseline[index] ?? 0) + 1);
    });
    await disablePlugin();
    expect(await listenerCounts()).toEqual(baseline);
  };
  await cycle();
  await cycle();
  await cycle();

  await enablePlugin();
  await browser.executeObsidian(async ({ app }) => {
    const file = await app.vault.create("Events probe.md", "# Create\n");
    await app.vault.modify(file, "# Modify\n");
    await app.fileManager.renameFile(file, "Renamed events probe.md");
    await app.fileManager.trashFile(file);
  });
  await browser.waitUntil(() =>
    browser.executeObsidian(
      ({ app }) => app.vault.getFileByPath("Renamed events probe.md") === null,
    ),
  );
  expect(await pluginProblems()).toEqual([]);
});
