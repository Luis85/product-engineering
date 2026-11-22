import { Effect } from "effect";
import type { SettingDefinitionItem } from "obsidian";
import type { AppRuntime, AppServices } from "../../../application/app-services";
import type { AppError } from "../../../application/errors";
import { McpSettingsError } from "../../../application/integrations";
import type { IntegrationsCatalog, McpController } from "../../../application/integrations";
import type { Catalog } from "../../../application/messages";
import { Clipboard, Notifier, SettingsService } from "../../../application/shell";
import { describeError } from "../../../application/user-messages";
import { parseMcpPort, validatePatch } from "../../../domain/shell";
import { runSafely } from "../shell";
import type { SettingsMirror, SettingsTabPart } from "../shell";

type AgentSetting = "mcpPort" | "claudeCodePath" | "codexPath";

type AgentSettings = {
  readonly controller: McpController;
  readonly runtime: AppRuntime;
  readonly mirror: SettingsMirror;
  readonly messages: Catalog;
  readonly selectedItemIds: () => readonly string[];
};

function isAgentSetting(key: string): key is AgentSetting {
  return key === "mcpPort" || key === "claudeCodePath" || key === "codexPath";
}

function patchFor(key: AgentSetting, value: unknown): object {
  if (typeof value !== "string") return { [key]: value };
  if (value.trim() === "") return { [key]: undefined };
  return { [key]: key === "mcpPort" ? (parseMcpPort(value) ?? value) : value };
}

function notifyFailure(effect: Effect.Effect<unknown, AppError, AppServices>, messages: Catalog) {
  return Effect.matchEffect(effect, {
    onSuccess: () => Effect.void,
    onFailure: (error) =>
      Notifier.use((notifier) => notifier.notify(describeError(error, messages))),
  });
}

function copyConnection(controller: McpController, messages: IntegrationsCatalog) {
  return Effect.gen(function* () {
    const connection = controller.connection();
    if (!connection) return yield* new McpSettingsError({ action: "copy" });

    const clipboard = yield* Clipboard;
    const notifier = yield* Notifier;
    const text = JSON.stringify(
      {
        url: connection.endpoint,
        headers: { Authorization: `Bearer ${connection.token}` },
      },
      null,
      2,
    );
    yield* Effect.mapError(clipboard.write(text), () => new McpSettingsError({ action: "copy" }));
    yield* notifier.notify({ severity: "info", ...messages.settings.mcp.copied });
  });
}

export function createAgentSettingsPart({
  controller,
  runtime,
  mirror,
  messages,
  selectedItemIds,
}: AgentSettings): SettingsTabPart {
  let pending = false;
  const { mcp, ai } = messages.integrations.settings;

  const start = Effect.tryPromise({
    try: () => controller.start(mirror.current.mcpPort ?? 0, selectedItemIds()),
    catch: () => new McpSettingsError({ action: "start" }),
  });
  const stop = Effect.tryPromise({
    try: () => controller.stop(),
    catch: () => new McpSettingsError({ action: "stop" }),
  });

  function action(
    effect: Effect.Effect<unknown, AppError, AppServices>,
    refresh: () => void,
  ): void {
    if (pending) return;
    pending = true;
    void runSafely(
      runtime,
      notifyFailure(effect, messages).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            pending = false;
            refresh();
          }),
        ),
      ),
    );
  }

  function field(
    key: AgentSetting,
    text: { readonly name: string; readonly desc: string },
  ): SettingDefinitionItem {
    return {
      ...text,
      control: {
        key,
        type: "text",
        disabled: !mirror.status.writable,
        validate: (value) => {
          const { issues } = validatePatch(patchFor(key, value));
          return issues.length === 0 ? undefined : messages.shell.settingsReset.detail(issues);
        },
      },
    };
  }

  return {
    definitions(refresh) {
      const status = controller.status();
      const running = status.state === "running";
      return [
        { name: mcp.title, desc: running ? mcp.running(status.endpoint) : mcp.stopped },
        field("mcpPort", mcp.port),
        { name: mcp.start, disabled: running || pending, action: () => action(start, refresh) },
        { name: mcp.stop, disabled: !running || pending, action: () => action(stop, refresh) },
        {
          name: mcp.copy,
          disabled: !running || pending,
          action: () => action(copyConnection(controller, messages.integrations), refresh),
        },
        { name: ai.title },
        field("claudeCodePath", ai.claudeCodePath),
        field("codexPath", ai.codexPath),
      ];
    },
    getControlValue(key) {
      return isAgentSetting(key) ? String(mirror.current[key] ?? "") : undefined;
    },
    async setControlValue(key, value) {
      if (!isAgentSetting(key)) return;
      await runSafely(
        runtime,
        notifyFailure(
          SettingsService.use((settings) => settings.update(patchFor(key, value))),
          messages,
        ),
      );
    },
  };
}
