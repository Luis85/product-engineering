import type { App } from "obsidian";

const timeout = 4_000;

export function waitForVault<A>(read: () => A | undefined, operation: string): Promise<A> {
  const initial = read();
  if (initial !== undefined) return Promise.resolve(initial);

  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const result = read();
      if (result === undefined && Date.now() < deadline) return;

      clearInterval(interval);
      if (result === undefined) reject(new Error("Timed out waiting for " + operation));
      else resolve(result);
    }, 10);
  });
}

type MetadataEvent =
  | { readonly event: "changed"; readonly title: unknown }
  | { readonly event: "resolve" | "resolved" | "deleted" };

function completedTrace(trace: readonly MetadataEvent[], title: string | undefined) {
  const started = trace.findIndex((entry) =>
    title === undefined
      ? entry.event === "deleted"
      : entry.event === "changed" && entry.title === title,
  );
  if (started < 0) return;

  const targetResolved =
    title === undefined
      ? started
      : trace.findIndex((entry, index) => index > started && entry.event === "resolve");
  if (targetResolved < 0) return;

  const completed = trace.findIndex(
    (entry, index) => index > targetResolved && entry.event === "resolved",
  );
  if (completed < 0) return;
  return trace
    .slice(started, completed + 1)
    .flatMap(({ event }, index) =>
      event === "resolved" && index !== completed - started ? [] : [event],
    );
}

export async function readinessScenario({
  vault,
  metadataCache,
  fileManager,
}: Pick<App, "vault" | "metadataCache" | "fileManager">) {
  const path = "Fidelity readiness.md";
  const trace: MetadataEvent[] = [];
  const subscriptions = [
    metadataCache.on("changed", (file, _text, cache) => {
      if (file.path === path) trace.push({ event: "changed", title: cache.frontmatter?.title });
    }),
    metadataCache.on("resolve", (file) => {
      if (file.path === path) trace.push({ event: "resolve" });
    }),
    metadataCache.on("resolved", () => {
      trace.push({ event: "resolved" });
    }),
    metadataCache.on("deleted", (file) => {
      if (file.path === path) trace.push({ event: "deleted" });
    }),
  ];

  async function observe(phase: string, title: string | undefined, action: () => Promise<unknown>) {
    trace.length = 0;
    await action();
    try {
      return await waitForVault(() => completedTrace(trace, title), phase + " metadata events");
    } catch (cause) {
      const file = vault.getFileByPath(path);
      const cachedTitle: unknown = file && metadataCache.getFileCache(file)?.frontmatter?.title;
      throw new Error(
        `${phase} readiness trace: ${JSON.stringify({ cachedTitle, events: trace.slice(-16) })}`,
        { cause },
      );
    }
  }

  try {
    const create = await observe("create", "Before", () =>
      vault.create(path, "---\ntitle: Before\n---\nBody\n"),
    );
    const file = vault.getFileByPath(path);
    if (!file) throw new Error("The readiness note was not created");
    const edit = await observe("edit", "After", () =>
      vault.process(file, (text) => text.replace("Before", "After")),
    );
    const trash = await observe("trash", undefined, () => fileManager.trashFile(file));
    return { create, edit, trash };
  } finally {
    for (const subscription of subscriptions) metadataCache.offref(subscription);
  }
}
