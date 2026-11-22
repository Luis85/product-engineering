import { Effect } from "effect";
import { expect, it } from "vitest";
import { IdGenerator } from "../../../../src/application/notes";
import { uuidGeneratorLayer } from "../../../../src/infrastructure/obsidian/notes/id-generator";

it("generates distinct UUIDs for record identities", async () => {
  const ids = await Effect.runPromise(
    Effect.gen(function* () {
      const { nextId } = yield* IdGenerator;
      return [yield* nextId, yield* nextId];
    }).pipe(Effect.provide(uuidGeneratorLayer)),
  );
  expect(ids).toHaveLength(2);
  expect(ids[0]).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  expect(ids[1]).not.toBe(ids[0]);
});
