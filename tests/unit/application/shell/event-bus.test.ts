import { it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";
import { expect } from "vitest";
import { EventBus, EventBusLive } from "../../../../src/application/shell";
import { recordingEventBus, controllableRead } from "../../../support/layers";

it.effect("buffers all events published after a scoped subscription is created", () =>
  Effect.gen(function* () {
    const bus = yield* EventBus;
    yield* bus.publish({ _tag: "LayoutReady" });
    const events = yield* bus.subscribe;

    yield* Effect.forEach(Array.from({ length: 257 }), () => bus.publish({ _tag: "LayoutReady" }), {
      discard: true,
    });

    const recorded = yield* events.pipe(Stream.take(257), Stream.runCollect);
    expect(recorded).toHaveLength(257);
    expect(recorded[0]).toEqual({ _tag: "LayoutReady" });
  }).pipe(Effect.provide(EventBusLive)),
);

it.effect("records accepted publications and can inject one failure", () => {
  const recorder = recordingEventBus();
  return Effect.gen(function* () {
    const bus = yield* EventBus;
    recorder.failNextPublish();
    const failure = yield* Effect.exit(bus.publish({ _tag: "LayoutReady" }));
    expect(failure._tag).toBe("Failure");
    yield* bus.publish({ _tag: "LayoutReady" });
    expect(recorder.events).toEqual([{ _tag: "LayoutReady" }]);
  }).pipe(Effect.provide(recorder.layer));
});

it.effect("controls in-flight reads without a timer", () =>
  Effect.gen(function* () {
    const source = controllableRead(3);
    expect(yield* source.read).toBe(3);
    source.hold();
    const fiber = yield* Effect.forkChild(source.read, { startImmediately: true });
    expect(source.held()).toBe(1);
    source.set(7);
    source.release();
    expect(yield* Fiber.join(fiber)).toBe(7);
    source.set("fail");
    expect((yield* Effect.exit(source.read))._tag).toBe("Failure");
  }),
);
