import { Context, Effect, Layer, PubSub, Stream } from "effect";
import type { Scope } from "effect";
import type { AppEvent } from "../events";

export class EventBus extends Context.Service<
  EventBus,
  {
    readonly publish: (event: AppEvent) => Effect.Effect<void>;
    readonly subscribe: Effect.Effect<Stream.Stream<AppEvent>, never, Scope.Scope>;
  }
>()("product-engineering/application/EventBus") {}

export const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const channel = yield* Effect.acquireRelease(PubSub.unbounded<AppEvent>(), PubSub.shutdown);
    return {
      publish: (event) => Effect.asVoid(PubSub.publish(channel, event)),
      subscribe: Effect.map(PubSub.subscribe(channel), Stream.fromSubscription),
    };
  }),
);
