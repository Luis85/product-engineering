import { Schema } from "effect";
import { makeSettingsCodec, StructuralSettingsIssue } from "./settings-codec";
import type { SettingsFields } from "./settings-codec";

const SETTINGS_VERSION = 1;
const MIGRATIONS = {};
export const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;
const LogLevel = Schema.Literals(LOG_LEVELS);
export type LogLevel = typeof LogLevel.Type;

const UnknownLogLevel = Schema.Struct({
  code: Schema.Literal("logLevel.unknown"),
  allowed: Schema.Array(LogLevel),
});
export const SettingsIssue = Schema.Union([StructuralSettingsIssue, UnknownLogLevel]);
export type SettingsIssue = typeof SettingsIssue.Type;

export type Settings = { readonly logLevel: LogLevel };
const FIELDS = {
  logLevel: {
    schema: LogLevel,
    default: "warn",
    issue: { code: "logLevel.unknown", allowed: LOG_LEVELS },
  },
} satisfies SettingsFields<Settings, SettingsIssue>;

const codec = makeSettingsCodec<Settings, SettingsIssue>({
  version: SETTINGS_VERSION,
  migrations: MIGRATIONS,
  fields: FIELDS,
});

export const DEFAULT_SETTINGS = codec.defaults;
export const decodeSettings = codec.decode;
export const encodeSettings = codec.encode;
export const validatePatch = codec.validatePatch;
