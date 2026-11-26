import { Context, Effect, Layer, Option, Result, Semaphore } from "effect";
import {
  copilotType,
  decodeCopilotComposer,
  decodeCopilotThreads,
} from "../../../domain/integrations";
import type { CopilotComposer, CopilotThread } from "../../../domain/integrations";
import {
  IdGenerator,
  NoteStore,
  NoteWriteRefusedError,
  noteSnapshot,
  recordFolder,
  recordFrontmatter,
} from "../../notes";
import type { Note } from "../../notes";
import type { ProjectId } from "../../projects";
import { SettingsService } from "../../shell";

class CopilotWrites extends Context.Service<
  CopilotWrites,
  {
    readonly lock: Semaphore.Semaphore;
    readonly created: Map<ProjectId, string>;
    readonly pending: Map<ProjectId, CopilotBatch>;
  }
>()("product-engineering/application/CopilotWrites") {}

export const copilotWritesLayer = Layer.effect(
  CopilotWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, created: new Map(), pending: new Map() })),
);

export type CopilotChanges = {
  readonly composer?: CopilotComposer;
  readonly instructions?: string;
  readonly thread?: CopilotThread;
};
type CopilotBatch = Omit<CopilotChanges, "thread"> & { readonly threads: readonly CopilotThread[] };

function recordId(projectId: ProjectId) {
  return "copilot-" + projectId.slice("project-".length);
}

function readCopilotNote(projectId: ProjectId) {
  return Effect.gen(function* () {
    const { created } = yield* CopilotWrites;
    const { notes } = yield* noteSnapshot(copilotType);
    const indexed = notes.find(
      (note) => note.id === recordId(projectId) && note.kind === "editable",
    );
    const path = indexed?.path ?? created.get(projectId);
    if (!path) return;
    const store = yield* NoteStore;
    return yield* store.readFresh(path).pipe(
      Effect.catchTag("NoteNotFoundError", () =>
        Effect.sync(() => {
          created.delete(projectId);
          return undefined;
        }),
      ),
    );
  });
}

function savedThreads(input: unknown) {
  return Option.getOrElse(decodeCopilotThreads(input), () => []);
}

function readCopilot(projectId: ProjectId, note: Note) {
  const decoded = copilotType.decode(note);
  if (
    decoded.kind !== "editable" ||
    decoded.id !== recordId(projectId) ||
    decoded.values.project_id !== projectId
  )
    return;
  const { composer, instructions, threads } = decoded.values;
  return {
    composer: Option.getOrUndefined(decodeCopilotComposer(composer)),
    instructions: instructions ?? "",
    threads: savedThreads(threads),
  };
}

export function loadCopilot(projectId: ProjectId) {
  return CopilotWrites.use(({ lock }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const note = yield* readCopilotNote(projectId);
        if (note) return readCopilot(projectId, note);
      }),
    ),
  );
}

function patchValues(changes: CopilotBatch, previous: readonly CopilotThread[]) {
  const { composer, instructions, threads } = changes;
  const updated = new Set(threads.map(({ id }) => id));
  const ordered = [...threads, ...previous.filter(({ id }) => !updated.has(id))];
  return {
    ...(composer && { composer: JSON.stringify(composer) }),
    ...(instructions !== undefined && { instructions }),
    ...(threads.length && { threads: JSON.stringify(ordered.slice(0, 40)) }),
  };
}

function writeCopilot(projectId: ProjectId, changes: CopilotBatch) {
  return Effect.gen(function* () {
    const { created } = yield* CopilotWrites;
    const store = yield* NoteStore;
    const current = yield* readCopilotNote(projectId);
    if (current) {
      yield* store.update(current.path, (frontmatter) => {
        const state = readCopilot(projectId, { path: current.path, frontmatter });
        if (!state) return Result.fail(new NoteWriteRefusedError({ reason: "identity" }));
        return Result.succeed({ set: patchValues(changes, state.threads) });
      });
      return;
    }
    const { current: preferences } = yield* SettingsService;
    const { rootFolder } = yield* preferences;
    const written = yield* store.create({
      folder: recordFolder(rootFolder, copilotType),
      name: recordId(projectId),
      frontmatter: recordFrontmatter(copilotType, recordId(projectId), {
        project_id: projectId,
        ...patchValues(changes, []),
      }),
    });
    created.set(projectId, written.path);
  });
}

function queueChanges(previous: CopilotBatch | undefined, changes: CopilotChanges): CopilotBatch {
  const { thread, ...fields } = changes;
  const prior = previous?.threads ?? [];
  const threads = thread ? [thread, ...prior.filter(({ id }) => id !== thread.id)] : prior;
  return { ...previous, ...fields, threads };
}

export function saveCopilot(projectId: ProjectId, changes: CopilotChanges) {
  return Effect.uninterruptible(
    CopilotWrites.use(({ lock, pending }) =>
      Effect.gen(function* () {
        pending.set(projectId, queueChanges(pending.get(projectId), changes));
        yield* lock.withPermit(
          Effect.gen(function* () {
            const batch = pending.get(projectId);
            if (!batch) return;
            pending.delete(projectId);
            yield* writeCopilot(projectId, batch);
          }),
        );
      }),
    ),
  );
}

export const newCopilotThreadId = IdGenerator.use(({ nextId }) => nextId);
