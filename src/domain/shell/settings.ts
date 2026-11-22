import { Schema, SchemaGetter } from "effect";
import { CliExecutablePath, McpPort } from "./agent-settings";
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
const InvalidMcpPort = Schema.Struct({ code: Schema.Literal("mcpPort.invalid") });
const InvalidClaudeCodePath = Schema.Struct({ code: Schema.Literal("claudeCodePath.invalid") });
const InvalidCodexPath = Schema.Struct({ code: Schema.Literal("codexPath.invalid") });
export const SettingsIssue = Schema.Union([
  StructuralSettingsIssue,
  UnknownLogLevel,
  InvalidMcpPort,
  InvalidClaudeCodePath,
  InvalidCodexPath,
]);
export type SettingsIssue = typeof SettingsIssue.Type;

export type Settings = {
  readonly logLevel: LogLevel;
  readonly mcpPort?: number | undefined;
  readonly claudeCodePath?: string | undefined;
  readonly codexPath?: string | undefined;
};

const OptionalCliExecutablePath = Schema.UndefinedOr(CliExecutablePath).pipe(
  Schema.decodeTo(Schema.UndefinedOr(Schema.String), {
    decode: SchemaGetter.transform((value) => (value === "" ? undefined : value)),
    encode: SchemaGetter.passthrough(),
  }),
);

const FIELDS = {
  logLevel: {
    schema: LogLevel,
    default: "warn",
    issue: { code: "logLevel.unknown", allowed: LOG_LEVELS },
  },
  mcpPort: {
    schema: Schema.UndefinedOr(McpPort),
    default: undefined,
    omitWhenDefault: true,
    issue: { code: "mcpPort.invalid" },
  },
  claudeCodePath: {
    schema: OptionalCliExecutablePath,
    default: undefined,
    omitWhenDefault: true,
    issue: { code: "claudeCodePath.invalid" },
  },
  codexPath: {
    schema: OptionalCliExecutablePath,
    default: undefined,
    omitWhenDefault: true,
    issue: { code: "codexPath.invalid" },
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
