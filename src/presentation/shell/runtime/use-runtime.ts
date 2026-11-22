import { Cause, Context, Effect, Exit, Option } from "effect";
import { computed, inject, onScopeDispose, shallowRef } from "vue";
import type { App, InjectionKey, Ref } from "vue";
import type { AppRuntime, AppServices } from "../../../application/app-services";
import type { AppError } from "../../../application/errors";
import type { Catalog } from "../../../application/messages";
import { Messages, Notifier, reportUnexpected } from "../../../application/shell";
import type { UserMessage } from "../../../application/shell";
import { describeError } from "../../../application/user-messages";

type RuntimeContext = {
  readonly runtime: AppRuntime;
  readonly messages: Catalog;
  readonly report: (cause: Cause.Cause<unknown>) => Promise<void>;
  readonly notify: (message: UserMessage) => Promise<void>;
};

const runtimeKey: InjectionKey<RuntimeContext> = Symbol("Product Engineering runtime");

export async function runRuntimeExit<A, E>(
  runtime: AppRuntime,
  effect: Effect.Effect<A, E, AppServices>,
  signal?: AbortSignal,
): Promise<Exit.Exit<A, E>> {
  try {
    return await runtime.runPromiseExit(effect, signal ? { signal } : undefined);
  } catch (cause) {
    return Exit.die(cause);
  }
}

export function provideRuntime(app: App, runtime: AppRuntime): void {
  const context = runtime.runSync(Effect.context<AppServices>());
  // Reporting may still be needed after the managed runtime refuses a new run.
  const runReporting = Effect.runPromiseExitWith(context);
  const report = async (cause: Cause.Cause<unknown>) => {
    await runReporting(Effect.suspend(() => reportUnexpected(cause)));
  };
  const notify = async (message: UserMessage) => {
    const exit = await runReporting(Notifier.use((port) => port.notify(message)));
    if (Exit.isFailure(exit)) await report(exit.cause);
  };
  app.provide(runtimeKey, {
    runtime,
    messages: Context.get(context, Messages),
    report,
    notify,
  });
}

export function useRuntimeContext(): RuntimeContext {
  const context = inject<RuntimeContext | undefined>(runtimeKey, undefined);
  if (!context) throw new Error("Product Engineering runtime was not provided");
  return context;
}

export function useRuntime(): AppRuntime {
  return useRuntimeContext().runtime;
}

export function useMessages(): Catalog {
  return useRuntimeContext().messages;
}

export function reportVueError(runtime: AppRuntime, cause: unknown): void {
  void runRuntimeExit(
    runtime,
    Effect.suspend(() => reportUnexpected(Cause.die(cause))),
  );
}

export type RunOutcome<A, E extends AppError> =
  | { readonly _tag: "success"; readonly value: A }
  | { readonly _tag: "failure"; readonly error: E; readonly message: UserMessage }
  | { readonly _tag: "defect" }
  | { readonly _tag: "interrupted" };

export type UseCaseFn<Args extends readonly unknown[], A, E extends AppError> = (
  ...args: Args
) => Effect.Effect<A, E, AppServices>;

export type UseCase<Args extends readonly unknown[], A, E extends AppError> = {
  readonly pending: Readonly<Ref<boolean>>;
  readonly value: Readonly<Ref<A | undefined>>;
  readonly error: Readonly<Ref<E | undefined>>;
  readonly message: Readonly<Ref<UserMessage | undefined>>;
  readonly run: (...args: Args) => Promise<RunOutcome<A, E>>;
};

const interrupted = Object.freeze({ _tag: "interrupted" } as const);

type UseCaseState<A, E> = {
  readonly pending: boolean;
  readonly value?: A;
  readonly error?: E;
  readonly message?: UserMessage;
};

function useCaseScope<Args extends readonly unknown[], A, E extends AppError>(
  fn: UseCaseFn<Args, A, E>,
) {
  const context = useRuntimeContext();
  let active = true;
  onScopeDispose(() => {
    active = false;
  });

  const state = shallowRef<UseCaseState<A, E>>({ pending: false });
  const begin = () => {
    state.value = { pending: true };
  };
  const complete = (outcome: RunOutcome<A, E>) => {
    switch (outcome._tag) {
      case "success":
        state.value = { pending: false, value: outcome.value };
        break;
      case "failure":
        state.value = { pending: false, error: outcome.error, message: outcome.message };
        break;
      case "defect":
      case "interrupted":
        state.value = { pending: false };
        break;
    }
  };
  const fields = {
    pending: computed(() => state.value.pending),
    value: computed(() => state.value.value),
    error: computed(() => state.value.error),
    message: computed(() => state.value.message),
  };
  return {
    fields,
    begin,
    complete,
    isActive: () => active,
    execute: (args: Args, signal?: AbortSignal) =>
      outcomeOf(
        context,
        Effect.suspend(() => fn(...args)),
        signal,
      ),
    notify: context.notify,
  };
}

async function outcomeOf<A, E extends AppError>(
  context: RuntimeContext,
  effect: Effect.Effect<A, E, AppServices>,
  signal?: AbortSignal,
): Promise<RunOutcome<A, E>> {
  const exit = await runRuntimeExit(context.runtime, effect, signal);
  if (Exit.isSuccess(exit)) return { _tag: "success", value: exit.value };
  if (Cause.hasInterruptsOnly(exit.cause)) return interrupted;

  const error = Cause.findErrorOption(exit.cause);
  if (Option.isSome(error) && !Cause.hasDies(exit.cause)) {
    try {
      return {
        _tag: "failure",
        error: error.value,
        message: describeError(error.value, context.messages),
      };
    } catch (cause) {
      await context.report(Cause.die(cause));
      return { _tag: "defect" };
    }
  }

  await context.report(exit.cause);
  return { _tag: "defect" };
}

export function useQuery<Args extends readonly unknown[], A, E extends AppError>(
  fn: UseCaseFn<Args, A, E>,
): UseCase<Args, A, E> {
  const { fields, begin, complete, isActive, execute } = useCaseScope(fn);
  let pending: AbortController | undefined;
  onScopeDispose(() => pending?.abort());

  const run = async (...args: Args): Promise<RunOutcome<A, E>> => {
    if (!isActive()) return interrupted;
    const previous = pending;
    const own = new AbortController();
    pending = own;
    previous?.abort();
    begin();

    const outcome = await execute(args, own.signal);
    if (!isActive() || pending !== own) return outcome._tag === "defect" ? outcome : interrupted;
    pending = undefined;
    complete(outcome);
    return outcome;
  };
  return { ...fields, run };
}

export function useCommand<Args extends readonly unknown[], A, E extends AppError>(
  fn: UseCaseFn<Args, A, E>,
): UseCase<Args, A, E> {
  const { fields, begin, complete, isActive, execute, notify } = useCaseScope(fn);
  let pending: Promise<RunOutcome<A, E>> | undefined;

  const run = (...args: Args): Promise<RunOutcome<A, E>> => {
    if (pending) return pending;
    if (!isActive()) return Promise.resolve(interrupted);

    const own = Promise.resolve().then(async () => {
      const outcome = await execute(args);
      if (!isActive() && outcome._tag === "failure") await notify(outcome.message);
      pending = undefined;
      if (isActive()) complete(outcome);
      return outcome;
    });
    pending = own;
    begin();
    return own;
  };
  return { ...fields, run };
}
