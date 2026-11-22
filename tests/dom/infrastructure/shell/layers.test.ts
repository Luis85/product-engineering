import { Effect } from "effect";
import { Plugin, Platform } from "obsidian";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestPlugin, setLanguage } from "@test/obsidian";
import { Clipboard, HostInfo, Notifier, SettingsStore } from "../../../../src/application/shell";
import { hostLanguage, shellAdapters } from "../../../../src/infrastructure/obsidian/shell";

const observeNotice = vi.hoisted(() =>
  vi.fn<(message: string | DocumentFragment, timeout?: number) => void>(),
);

vi.mock("obsidian", async () => {
  const double = await import("@test/obsidian");
  return {
    ...double,
    Notice: class extends double.Notice {
      constructor(message: string | DocumentFragment, timeout?: number) {
        super(message);
        observeNotice(message, timeout);
      }
    },
  };
});

const originalPlatform = { ...Platform };
class TestPlugin extends Plugin {}

beforeEach(() => {
  vi.stubGlobal("activeDocument", document);
  observeNotice.mockClear();
});

afterEach(() => {
  Object.assign(Platform, originalPlatform);
  setLanguage("de");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("loads and saves host data and maps storage rejections", async () => {
  const { plugin, registry } = createTestPlugin(TestPlugin, { data: { logLevel: "info" } });
  const adapters = shellAdapters(plugin);
  const saveData = vi.spyOn(plugin, "saveData").mockRejectedValueOnce(new Error("write rejected"));
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* SettingsStore;
      const data = yield* store.load;
      const writeFailure = yield* Effect.exit(store.save({ replacement: true }));
      registry.setFailLoadData();
      const loadFailure = yield* Effect.exit(store.load);
      return { data, writeFailure, loadFailure };
    }).pipe(Effect.provide(adapters.settingsStore)),
  );
  expect(result.data).toEqual({ logLevel: "info" });
  expect(result.writeFailure._tag).toBe("Failure");
  expect(result.loadFailure._tag).toBe("Failure");
  expect(saveData).toHaveBeenCalledWith({ replacement: true });
});

it("renders notice text, duration and a safe issue link", async () => {
  const { plugin } = createTestPlugin(TestPlugin);
  const { notifier } = shellAdapters(plugin);
  await Effect.runPromise(
    Effect.gen(function* () {
      const port = yield* Notifier;
      yield* port.notify({
        severity: "error",
        title: "<Error>",
        detail: "Try again.",
        link: "https://github.com/Luis85/product-engineering/issues",
      });
      yield* port.notify({ severity: "info", title: "Copied", detail: "Done." });
    }).pipe(Effect.provide(notifier)),
  );
  const [content, errorDuration] = observeNotice.mock.calls[0] ?? [];
  expect(content).toBeInstanceOf(DocumentFragment);
  if (!(content instanceof DocumentFragment)) throw new Error("Expected a notice fragment");
  expect(content.querySelector("strong")?.textContent).toBe("<Error>");
  const link = content.querySelector("a");
  expect(link?.getAttribute("target")).toBe("_blank");
  expect(link?.getAttribute("rel")).toBe("noopener");
  expect(link?.getAttribute("href")).toBe("https://github.com/Luis85/product-engineering/issues");
  expect(errorDuration).toBeGreaterThan(observeNotice.mock.calls[1]?.[1] ?? Infinity);
});

it("writes clipboard text and maps clipboard errors", async () => {
  const { plugin } = createTestPlugin(TestPlugin);
  const writeText = vi
    .fn<(value: string) => Promise<void>>()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("clipboard denied"));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const clipboard = yield* Clipboard;
      yield* clipboard.write("exported");
      return yield* Effect.exit(clipboard.write("rejected"));
    }).pipe(Effect.provide(shellAdapters(plugin).clipboard)),
  );
  expect(writeText).toHaveBeenNthCalledWith(1, "exported");
  expect(result._tag).toBe("Failure");
});

it.each([
  [{ isIosApp: true, isMacOS: true }, "iOS"],
  [{ isAndroidApp: true, isLinux: true }, "Android"],
  [{ isMacOS: true }, "macOS"],
  [{ isWin: true }, "Windows"],
  [{ isLinux: true }, "Linux"],
  [{}, "Unknown"],
])("reports Obsidian host flags in priority order for %j", async (flags, platform) => {
  Object.assign(
    Platform,
    { isIosApp: false, isAndroidApp: false, isMacOS: false, isWin: false, isLinux: false },
    flags,
  );
  const { plugin } = createTestPlugin(TestPlugin);
  await expect(
    Effect.runPromise(HostInfo.pipe(Effect.provide(shellAdapters(plugin).hostInfo))),
  ).resolves.toMatchObject({ platform, pluginVersion: "0.1.0", apiVersion: "1.15.1" });
});

it("maps language codes on demand at the host boundary", () => {
  setLanguage("de-DE");
  expect(hostLanguage()).toBe("de");
  setLanguage("es");
  expect(hostLanguage()).toBe("en");
});
