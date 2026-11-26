import { Effect } from "effect";
import { memoryNoteStore } from "../../../../src/infrastructure/memory/notes";
import { noteStoreContract } from "../../../support/notes/contract";
import { contractOpener } from "../../../support/notes/contract-opener";
import type { NoteStoreFixture } from "../../../support/notes/fixture";

function makeFixture(): NoteStoreFixture {
  const fixture = memoryNoteStore();
  return { ...fixture, body: (path) => Effect.sync(() => fixture.body(path)) };
}

noteStoreContract("in-memory NoteStore", makeFixture);
contractOpener(memoryNoteStore);
