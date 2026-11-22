import type { Data } from "effect";
import type { ShellEvents } from "./shell";

export type AppEvent = Data.TaggedEnum<ShellEvents>;
