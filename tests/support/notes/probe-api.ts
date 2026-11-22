import { Effect } from "effect";
import type { ManagedRuntime } from "effect";
import { NoteStore } from "../../../src/application/notes";
import type { CreateNoteInput, Note } from "../../../src/application/notes";

export type ProbeResult<A> =
  | { readonly success: true; readonly value: A }
  | { readonly success: false; readonly error: string };

export interface NoteStoreProbeApi {
  list(): Promise<ProbeResult<readonly Note[]>>;
  read(path: string): Promise<ProbeResult<Note>>;
  unreadable(folder: string): Promise<ProbeResult<readonly string[]>>;
  create(input: CreateNoteInput): Promise<ProbeResult<Note>>;
  rename(path: string, name: string): Promise<ProbeResult<Note>>;
  trash(path: string): Promise<ProbeResult<void>>;
}

type NoteRuntime = Pick<ManagedRuntime.ManagedRuntime<NoteStore, never>, "runPromise">;

export function createNoteStoreProbeApi(runtime: NoteRuntime): NoteStoreProbeApi {
  const run = <A, E extends { readonly _tag: string }>(
    operation: Effect.Effect<A, E, NoteStore>,
  ): Promise<ProbeResult<A>> =>
    runtime.runPromise(
      Effect.match(operation, {
        onSuccess: (value) => ({ success: true, value }) as const,
        onFailure: (error) => ({ success: false, error: error._tag }) as const,
      }),
    );

  return {
    list: () => run(NoteStore.use((store) => store.list)),
    read: (path) => run(NoteStore.use((store) => store.read(path))),
    unreadable: (folder) => run(NoteStore.use((store) => store.unreadable(folder))),
    create: (input) => run(NoteStore.use((store) => store.create(input))),
    rename: (path, name) => run(NoteStore.use((store) => store.rename(path, name))),
    trash: (path) => run(NoteStore.use((store) => store.trash(path))),
  };
}
