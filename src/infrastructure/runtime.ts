import { ManagedRuntime } from "effect";
import type { Layer } from "effect";
import type { AppRuntime, AppServices } from "../application/app-services";

export function makeRuntime(layer: Layer.Layer<AppServices>): AppRuntime {
  return ManagedRuntime.make(layer);
}
