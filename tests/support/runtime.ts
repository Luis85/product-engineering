import { Effect } from "effect";
import { appServicesLayer } from "../../src/application/app-services-layer";
import type { AppServiceOptions } from "../../src/application/app-services-layer";
import { EventBus } from "../../src/application/shell";
import type { Language } from "../../src/application/shell";
import { makeRuntime } from "../../src/infrastructure/runtime";
import { testAdapters } from "./adapters";
import type { TestAdapterOptions } from "./adapters";
import { controllableRead } from "./layers";

type TestRuntimeOptions = TestAdapterOptions & {
  readonly language?: Language;
  readonly developmentMode?: boolean;
  readonly source?: number | "fail";
  readonly noteTypes?: AppServiceOptions["noteTypes"];
};

export function testRuntime(options: TestRuntimeOptions = {}) {
  const host = testAdapters(options);
  const layer = appServicesLayer(host.adapters, {
    language: options.language ?? "de",
    developmentMode: options.developmentMode ?? true,
    ...(options.noteTypes === undefined ? {} : { noteTypes: options.noteTypes }),
  });
  const runtime = makeRuntime(layer);
  return {
    ...host,
    runtime,
    source: controllableRead(options.source ?? 3),
    vaultReady: () =>
      runtime.runPromise(
        EventBus.use((events) =>
          Effect.andThen(
            events.publish({ _tag: "LayoutReady" }),
            events.publish({ _tag: "VaultReady" }),
          ),
        ),
      ),
  };
}
