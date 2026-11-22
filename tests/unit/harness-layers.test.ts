import { Effect, Option, Stream } from "effect";
import { expect, it, vi } from "vitest";
import { harnessLayer, parseScenario, SCENARIOS } from "../../harness/layers";
import {
  NoteStore,
  rebuildNoteIndex,
  unindexedChanges,
  unindexedSnapshot,
} from "../../src/application/notes";
import {
  Clipboard,
  HostInfo,
  Messages,
  setLogLevel,
  SettingsService,
} from "../../src/application/shell";
import type { UserMessage } from "../../src/application/shell";
import { DEFAULT_SETTINGS } from "../../src/domain/shell";
import { makeRuntime } from "../../src/infrastructure/runtime";

it("recognizes each scenario and falls back to loaded for an unknown value", () => {
  expect(SCENARIOS).toEqual(["loaded", "empty", "invalid", "readonly", "failure"]);
  expect(SCENARIOS.map(parseScenario)).toEqual(SCENARIOS);
  expect(parseScenario("unknown")).toBe("loaded");
  expect(parseScenario(null)).toBe("loaded");
});

it.each([
  { scenario: "loaded", logLevel: "info", codes: [], readOnlyReason: undefined },
  { scenario: "empty", logLevel: "warn", codes: [], readOnlyReason: undefined },
  { scenario: "invalid", logLevel: "warn", codes: ["logLevel.unknown"], readOnlyReason: undefined },
  {
    scenario: "readonly",
    logLevel: "warn",
    codes: ["schema.newer"],
    readOnlyReason: "newer-version",
  },
  { scenario: "failure", logLevel: "warn", codes: ["file.invalid"], readOnlyReason: "unreadable" },
] as const)("builds the real app graph over the $scenario scenario", async (scenario) => {
  const notify = vi.fn<(message: UserMessage) => void>();
  const runtime = makeRuntime(harnessLayer(scenario.scenario, { language: "de", notify }));
  try {
    const values = await runtime.runPromise(
      Effect.gen(function* () {
        const settings = yield* SettingsService;
        return {
          current: yield* settings.current,
          status: yield* settings.status,
          host: yield* HostInfo,
          catalog: yield* Messages,
        };
      }),
    );
    expect(values.current.logLevel).toBe(scenario.logLevel);
    expect(values.status.writable).toBe(scenario.readOnlyReason === undefined);
    expect(values.status.readOnlyReason).toBe(scenario.readOnlyReason);
    expect(values.status.issues.map(({ code }) => code)).toEqual(scenario.codes);
    expect(values.host).toEqual({
      pluginVersion: "harness",
      apiVersion: "none",
      platform: "browser",
    });
    expect(values.catalog.shell.language).toBe("de");
    expect(notify).toHaveBeenCalledTimes(scenario.codes.length);
  } finally {
    await runtime.dispose();
  }
});

it("keeps written settings in the owning harness runtime", async () => {
  const notify = vi.fn<(message: UserMessage) => void>();
  const first = makeRuntime(harnessLayer("empty", { language: "en", notify }));
  const second = makeRuntime(harnessLayer("empty", { language: "en", notify }));
  try {
    await first.runPromise(setLogLevel("debug"));
    await first.runPromise(SettingsService.use((service) => service.reload));
    await expect(
      first.runPromise(SettingsService.use((service) => service.current)),
    ).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      logLevel: "debug",
    });
    await expect(
      second.runPromise(SettingsService.use((service) => service.current)),
    ).resolves.toEqual(DEFAULT_SETTINGS);
  } finally {
    await Promise.all([first.dispose(), second.dispose()]);
  }
});

it("uses the browser clipboard and maps rejected writes to typed errors", async () => {
  const notify = vi.fn<(message: UserMessage) => void>();
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("clipboard permission denied"));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const runtime = makeRuntime(harnessLayer("empty", { language: "en", notify }));
  try {
    const write = Clipboard.use((clipboard) => clipboard.write("report"));
    await expect(runtime.runPromise(write)).resolves.toBeUndefined();
    await expect(runtime.runPromise(Effect.flip(write))).resolves.toMatchObject({
      _tag: "ClipboardError",
    });
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenCalledWith("report");
  } finally {
    vi.unstubAllGlobals();
    await runtime.dispose();
  }
});

it.each([
  { scenario: "loaded", count: 2, newer: 0, blocked: 0, repeated: 0 },
  { scenario: "empty", count: 0, newer: 0, blocked: 0, repeated: 0 },
  { scenario: "invalid", count: 4, newer: 0, blocked: 1, repeated: 2 },
  { scenario: "readonly", count: 2, newer: 1, blocked: 0, repeated: 0 },
] as const)(
  "seeds the $scenario vault scenario with $count records",
  async ({ scenario, count, newer, blocked, repeated }) => {
    const runtime = makeRuntime(harnessLayer(scenario, { language: "en", notify: () => {} }));
    try {
      const notes = await runtime.runPromise(NoteStore.use((store) => store.list));
      expect(notes).toHaveLength(count);
      expect(
        notes.filter((note) => note.frontmatter.schema === "product-engineering.item/v2"),
      ).toHaveLength(newer);
      expect(notes.filter((note) => note.frontmatter.title === "Repeated title")).toHaveLength(
        repeated,
      );
      expect(notes.filter((note) => note.frontmatter.status === "blocked")).toHaveLength(blocked);
    } finally {
      await runtime.dispose();
    }
  },
);

it("recovers the failure scenario on the first index retry", async () => {
  const runtime = makeRuntime(harnessLayer("failure", { language: "en", notify: () => {} }));
  try {
    const initial = await runtime.runPromise(
      Stream.runHead(
        unindexedChanges.pipe(Stream.filter((state) => state.ready || state.failure !== undefined)),
      ),
    );
    expect(Option.getOrThrow(initial)).toMatchObject({
      ready: false,
      failure: { _tag: "NoteIndexReadError" },
    });
    await runtime.runPromise(rebuildNoteIndex);
    expect(await runtime.runPromise(unindexedSnapshot)).toMatchObject({
      ready: true,
      notes: [],
      failure: undefined,
    });
  } finally {
    await runtime.dispose();
  }
});
