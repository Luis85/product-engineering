import { Result } from "effect";
import { expect, it } from "vitest";
import {
  deterministicDemoChat,
  loadCopilot,
  saveCopilot,
} from "../../../src/application/integrations";
import { NoteStore, noteSnapshot, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import { copilotType } from "../../../src/domain/integrations";
import type { CopilotComposer, CopilotThread } from "../../../src/domain/integrations";
import { testRuntime } from "../../support/runtime";

const first = "project-33333333-3333-4333-8333-000000000191";
const second = "project-33333333-3333-4333-8333-000000000192";
const source = "knowledge:knowledge-33333333-3333-4333-8333-000000000193";
const ownerRecord = "copilot-33333333-3333-4333-8333-000000000191";
const composer = {
  activeId: "review-one",
  mode: "review",
  prompt: "An unsent continuation",
  selected: [source],
  locked: true,
  target: source,
} as const satisfies CopilotComposer;

function thread(id: string, reply: string, withCitation = false): CopilotThread {
  return {
    id,
    selected: [source],
    messages: [
      { role: "user", content: "Check this requirement" },
      { role: "assistant", content: reply, ...(withCitation && { sources: [source] }) },
    ],
  };
}

type Harness = ReturnType<typeof testRuntime>;

async function withRuntime(check: (host: Harness) => Promise<void>) {
  const host = testRuntime({ language: "en" });
  try {
    const run = host.runtime.runPromise;
    await run(
      createProject(first, {
        name: "Local product",
        description: "Copilot fixture",
        repository: "team/local",
      }),
    );
    await run(
      createProject(second, {
        name: "Other product",
        description: "Separate project fixture",
        repository: "team/other",
      }),
    );
    await host.vaultReady();
    await check(host);
  } finally {
    await host.runtime.dispose();
  }
}

async function notePath({ runtime }: Harness) {
  await runtime.runPromise(rebuildNoteIndex);
  const { notes } = await runtime.runPromise(noteSnapshot(copilotType));
  const path = notes.find(({ id }) => id === ownerRecord)?.path;
  if (!path) throw new Error("Missing project Copilot fixture note");
  return path;
}

it("creates no conversation on load and updates a repeat thread without replacing another project's state", () =>
  withRuntime(async (host) => {
    const run = host.runtime.runPromise;
    expect(await run(loadCopilot(first))).toBeUndefined();
    expect((await run(noteSnapshot(copilotType))).notes).toHaveLength(0);
    const newer = thread("review-two", "Another established reply");
    const old = thread("review-one", "Original reply", true);
    const amended = thread(old.id, "Updated scoped reply", true);
    await Promise.all([
      run(saveCopilot(first, { composer, instructions: "Local phrasing", thread: old })),
      run(
        saveCopilot(second, {
          instructions: "Other phrasing",
          thread: thread(old.id, "Other reply"),
        }),
      ),
    ]);
    await run(saveCopilot(first, { thread: newer }));
    await run(saveCopilot(first, { thread: amended }));
    expect(await run(loadCopilot(first))).toEqual({
      composer,
      instructions: "Local phrasing",
      threads: [amended, newer],
    });
    expect(await run(loadCopilot(second))).toEqual({
      composer: undefined,
      instructions: "Other phrasing",
      threads: [thread(old.id, "Other reply")],
    });
    expect((await run(loadCopilot(first)))?.threads[0]?.messages[1]).toEqual({
      role: "assistant",
      content: "Updated scoped reply",
      sources: [source],
    });
    expect((await run(loadCopilot(first)))?.threads[1]?.messages[1]).toEqual({
      role: "assistant",
      content: "Another established reply",
    });
  }));

it("refuses a foreign owner at a known persisted path and leaves the stored note intact", () =>
  withRuntime(async (host) => {
    const run = host.runtime.runPromise;
    await run(saveCopilot(first, { instructions: "Original instructions" }));
    const path = await notePath(host);
    const store = await run(NoteStore);
    await run(store.update(path, () => Result.succeed({ set: { project_id: second } })));
    const original = await run(store.readContent(path));
    expect(await run(loadCopilot(first))).toBeUndefined();
    expect(await run(loadCopilot(second))).toBeUndefined();
    await expect(
      run(saveCopilot(first, { composer, instructions: "Do not apply" })),
    ).rejects.toMatchObject({
      _tag: "NoteWriteRefusedError",
      reason: "identity",
    });
    expect((await run(store.readContent(path))).text).toBe(original.text);
  }));

it("recovers when the saved Copilot note was removed and a fresh composer is explicitly saved", () =>
  withRuntime(async (host) => {
    const run = host.runtime.runPromise;
    await run(saveCopilot(first, { composer, thread: thread("review-one", "Former reply") }));
    const path = await notePath(host);
    await run(host.notes.removeOutside(path));
    expect(await run(loadCopilot(first))).toBeUndefined();
    await run(saveCopilot(first, { instructions: "New scoped instructions" }));
    expect(await run(loadCopilot(first))).toEqual({
      composer: undefined,
      instructions: "New scoped instructions",
      threads: [],
    });
  }));

async function collect(stream: AsyncIterable<string>) {
  let output = "";
  for await (const chunk of stream) output += chunk;
  return output;
}

it("gives Local Demo conversational, proposal and HTML results with explicit origins", async () => {
  const demo = deterministicDemoChat("Scoped local sample.");
  const request = { provider: "demo", messages: [{ role: "user", content: "Test data" }] } as const;
  expect(await collect(demo.stream(request))).toBe("Scoped local sample.");
  const proposal = JSON.stringify({
    title: "Local Demo",
    body: "## Local Demo\n\nScoped local sample.",
  });
  expect(await collect(demo.stream({ ...request, purpose: "copilot-draft" }))).toBe(proposal);
  expect(await collect(demo.stream({ ...request, purpose: "copilot-revise" }))).toBe(proposal);
  const html = await collect(demo.stream({ ...request, purpose: "prototype-html" }));
  expect(html).toMatch(/^<!doctype html>/iu);
  expect(html).toContain("<h1>Local Demo</h1>");
  expect(html).not.toContain("Test data");
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(collect(demo.stream(request, cancelled.signal))).rejects.toMatchObject({
    _tag: "ProviderChatError",
    provider: "demo",
    reason: "cancelled",
  });
});
