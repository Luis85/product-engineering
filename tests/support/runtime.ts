import { appServicesLayer } from "../../src/application/app-services-layer";
import type { Language } from "../../src/application/shell";
import { makeRuntime } from "../../src/infrastructure/runtime";
import { testAdapters } from "./adapters";
import type { TestAdapterOptions } from "./adapters";
import { controllableRead } from "./layers";

type TestRuntimeOptions = TestAdapterOptions & {
  readonly language?: Language;
  readonly developmentMode?: boolean;
  readonly source?: number | "fail";
};

export function testRuntime(options: TestRuntimeOptions = {}) {
  const host = testAdapters(options);
  const layer = appServicesLayer(host.adapters, {
    language: options.language ?? "de",
    developmentMode: options.developmentMode ?? true,
  });
  return { ...host, runtime: makeRuntime(layer), source: controllableRead(options.source ?? 3) };
}
