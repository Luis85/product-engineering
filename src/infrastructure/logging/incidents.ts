import { Effect, Layer, Random } from "effect";
import { Incidents } from "../../application/shell";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const incidentsLayer = Layer.succeed(Incidents, {
  nextId: Effect.forEach(Array.from({ length: 6 }), () =>
    Effect.map(Random.nextIntBetween(0, alphabet.length, { halfOpen: true }), (index) =>
      alphabet.charAt(index),
    ),
  ).pipe(Effect.map((characters) => characters.join(""))),
});
