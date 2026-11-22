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

export async function readinessScenario({
  vault,
  metadataCache,
  fileManager,
}: Pick<App, "vault" | "metadataCache" | "fileManager">) {
  const path = "Fidelity readiness.md";
  type Event = "changed" | "resolve" | "resolved" | "deleted";
  const trace: Event[] = [];
  const subscriptions = [
    metadataCache.on("changed", (file) => {
      if (file.path === path) trace.push("changed");
    }),
    metadataCache.on("resolve", (file) => {
      if (file.path === path) trace.push("resolve");
    }),
    metadataCache.on("resolved", () => {
      trace.push("resolved");
    }),
    metadataCache.on("deleted", (file) => {
      if (file.path === path) trace.push("deleted");
    }),
  ];

  async function observe(start: Event, action: () => Promise<unknown>) {
    trace.length = 0;
    await action();
    return waitForVault(() => {
      const first = trace.indexOf(start);
      const last = trace.indexOf("resolved", first + 1);
      return first >= 0 && last > first ? trace.slice(first, last + 1) : undefined;
    }, start + " and resolved");
  }

  try {
    const create = await observe("changed", () =>
      vault.create(path, "---\ntitle: Before\n---\nBody\n"),
    );
    const file = vault.getFileByPath(path);
    if (!file) throw new Error("The readiness note was not created");
    const edit = await observe("changed", () =>
      vault.process(file, (text) => text.replace("Before", "After")),
    );
    const trash = await observe("deleted", () => fileManager.trashFile(file));
    return { create, edit, trash };
  } finally {
    for (const subscription of subscriptions) metadataCache.offref(subscription);
  }
}
