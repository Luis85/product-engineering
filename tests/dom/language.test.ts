import { afterEach, expect, it, vi } from "vitest";
import { clearNotices, createTestPlugin, setLanguage, settingsIn } from "@test/obsidian";
import ShellPlugin from "../../src/main";

vi.mock("obsidian", () => import("@test/obsidian"));

afterEach(() => {
  clearNotices();
  setLanguage("de");
});

it.each([
  [
    "de",
    "Product Engineering öffnen",
    "Diagnose kopieren",
    "Protokollstufe",
    "Einstellungen sind schreibgeschützt",
  ],
  ["en", "Open Product Engineering", "Copy diagnostics", "Log level", "Settings are read-only"],
])(
  "uses %s for commands, settings and notices while keeping the ribbon title",
  async (language, open, copy, logLevel, notice) => {
    setLanguage(language);
    const { plugin, registry } = createTestPlugin(ShellPlugin);
    registry.setFailLoadData();
    try {
      await registry.load();
      expect([...registry.commands.values()].map(({ name }) => name)).toEqual([
        `Product Engineering: ${open}`,
        `Product Engineering: ${copy}`,
      ]);
      const tab = registry.settingTabs[0];
      if (!tab) throw new Error("Settings tab was not registered");
      tab.update();
      expect(settingsIn(tab).get("logLevel")?.setting.nameEl.textContent).toBe(logLevel);
      expect(registry.notices[0]).toContain(notice);
      expect([...registry.ribbonIcons.values()].map(({ title }) => title)).toEqual([
        "Product Engineering",
      ]);
    } finally {
      plugin.unload();
    }
  },
);
