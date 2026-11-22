import { expect, it } from "vitest";
import { NoteStore } from "../../../../src/application/notes";
import { expectedStoreEvents, observeStoreEvents } from "../../../support/notes/store-events";
import { testRuntime } from "../../../support/runtime";

it("publishes the store's common file events from memory", async () => {
  const { runtime, notes } = testRuntime();
  try {
    const events = await runtime.runPromise(
      NoteStore.use((store) => observeStoreEvents(store, notes)),
    );
    expect(events).toEqual(expectedStoreEvents);
  } finally {
    await runtime.dispose();
  }
});
