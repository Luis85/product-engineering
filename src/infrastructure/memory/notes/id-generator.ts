import { Effect, Layer } from "effect";
import { IdGenerator } from "../../../application/notes";

export function sequentialIdGenerator(): Layer.Layer<IdGenerator> {
  let index = 0;
  return Layer.succeed(IdGenerator, {
    nextId: Effect.sync(
      () => `00000000-0000-0000-0000-${(++index).toString(16).padStart(12, "0")}`,
    ),
  });
}
