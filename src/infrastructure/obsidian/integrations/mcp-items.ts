import { Effect, Stream } from "effect";
import type { AppRuntime, AppServices } from "../../../application/app-services";
import type { SharedItem } from "../../../application/integrations";
import { SettingsService } from "../../../application/shell";

export interface McpItemSnapshot {
  readonly ready: boolean;
  readonly failure: unknown;
  readonly notes: readonly {
    readonly kind: "editable" | "read-only";
    readonly id?: string;
    readonly values: Partial<Pick<SharedItem, "title" | "status" | "due">>;
  }[];
}

type ItemSource = {
  readonly current: Effect.Effect<McpItemSnapshot, never, AppServices>;
  readonly changes: Stream.Stream<McpItemSnapshot, never, AppServices>;
};

export type McpItemChoices = {
  readonly state: "loading" | "unavailable" | "ready";
  readonly items: readonly Pick<SharedItem, "id" | "title">[];
};

function usableItems(snapshot: McpItemSnapshot): Map<string, SharedItem> {
  const items = new Map<string, SharedItem>();
  if (!snapshot.ready || snapshot.failure !== undefined) return items;

  for (const { kind, id, values } of snapshot.notes) {
    const { title, status, due } = values;
    if (kind !== "editable" || id === undefined || title === undefined || status === undefined)
      continue;
    items.set(id, { id, title, status, ...(due === undefined ? {} : { due }) });
  }
  return items;
}

function sameChoices(before: McpItemChoices, after: McpItemChoices): boolean {
  return (
    before.state === after.state &&
    before.items.length === after.items.length &&
    before.items.every(({ id, title }, index) => {
      const next = after.items[index];
      return next?.id === id && next.title === title;
    })
  );
}

export function createMcpItemAccess(runtime: AppRuntime, source: ItemSource) {
  let previous: McpItemSnapshot | undefined;
  let byId = new Map<string, SharedItem>();
  let choices: McpItemChoices = { state: "loading", items: [] };

  function project(snapshot: McpItemSnapshot) {
    if (snapshot !== previous) {
      byId = usableItems(snapshot);
      previous = snapshot;
    }
    return byId;
  }

  return {
    choices: () => choices,
    watchChoices(refresh: () => void) {
      const observer = new AbortController();
      const observation = runtime.runPromiseExit(
        Stream.runForEach(source.changes, (snapshot) =>
          Effect.sync(() => {
            const next: McpItemChoices = {
              state:
                snapshot.failure !== undefined
                  ? "unavailable"
                  : snapshot.ready
                    ? "ready"
                    : "loading",
              items: [...project(snapshot).values()]
                .map(({ id, title }) => ({ id, title }))
                .toSorted(
                  (left, right) =>
                    left.title.localeCompare(right.title, "de", { numeric: true }) ||
                    left.id.localeCompare(right.id),
                ),
            };
            if (sameChoices(choices, next)) return;
            choices = next;
            refresh();
          }),
        ),
        { signal: observer.signal },
      );
      return async () => {
        observer.abort();
        await observation;
      };
    },
    readItem: (id: string, signal: AbortSignal): Promise<SharedItem | undefined> =>
      runtime.runPromise(
        Effect.gen(function* () {
          const settings = yield* SettingsService;
          const { mcpSharedItemIds } = yield* settings.current;
          if (!mcpSharedItemIds?.includes(id)) return undefined;
          return project(yield* source.current).get(id);
        }),
        { signal },
      ),
  };
}
