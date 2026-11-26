import { Effect, Layer } from "effect";
import { IdGenerator } from "../../../application/notes";

export const uuidGeneratorLayer = Layer.succeed(IdGenerator, {
  nextId: Effect.sync(() => crypto.randomUUID()),
});
