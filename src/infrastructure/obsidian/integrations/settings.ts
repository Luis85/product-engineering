import { Effect } from "effect";
import type { SettingDefinitionControl } from "obsidian";
import type { AppRuntime, AppServices } from "../../../application/app-services";
import type { AppError } from "../../../application/errors";
import { aiCapability, McpSettingsError } from "../../../application/integrations";
import type { IntegrationsCatalog, McpController } from "../../../application/integrations";
import type { Catalog } from "../../../application/messages";
import { Clipboard, Notifier, SettingsService } from "../../../application/shell";
import { describeError } from "../../../application/user-messages";
import { parseMcpPort, validatePatch } from "../../../domain/shell";
import { runSafely } from "../shell";
import type { SettingsMirror, SettingsTabPart } from "../shell";
import type { McpItemChoices } from "./mcp-items";
import { createMcpSharing } from "./mcp-sharing";

type TextSetting = "mcpPort" | "claudeCodePath" | "codexPath";
type AgentSetting = TextSetting | "aiEnabled" | "aiMode";

type AgentSettings = {
  readonly controller: McpController;
  readonly runtime: AppRuntime;
  readonly mirror: SettingsMirror;
  readonly messages: Catalog;
  readonly items: () => McpItemChoices;
};

function isAgentSetting(key: string): key is AgentSetting {
  return (
    key === "mcpPort" ||
    key === "claudeCodePath" ||
    key === "codexPath" ||
    key === "aiEnabled" ||
    key === "aiMode"
  );
}

function patchFor(key: AgentSetting, value: unknown): object {
  if (key === "aiEnabled" || key === "aiMode" || typeof value !== "string") return { [key]: value };
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
  items,
}: AgentSettings): SettingsTabPart {
  let pending = false;
  let selectionWrites: Promise<void> = Promise.resolve();
  let refreshDefinitions: (() => void) | undefined;
  let refreshDestination: (() => void) | undefined;
  const { mcp, ai } = messages.integrations.settings;
  const sharing = createMcpSharing({ mirror, messages: mcp.sharing, choices: items });
  const activeMode = () => aiCapability(mirror.current).mode;

  const start = Effect.gen(function* () {
    yield* Effect.promise(() => selectionWrites);
    const { mcpPort = 0, mcpSharedItemIds = [] } = yield* SettingsService.use(
      (settings) => settings.current,
    );
    yield* Effect.tryPromise({
      try: () => controller.start(mcpPort, mcpSharedItemIds),
      catch: () => new McpSettingsError({ action: "start" }),
    });
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
    key: TextSetting,
    text: { readonly name: string; readonly desc: string },
  ): SettingDefinitionControl {
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
      refreshDefinitions = refresh;
      const status = controller.status();
      const running = status.state === "running";
      return [
        {
          type: "group",
          heading: ai.title,
          items: [
            {
              ...ai.enabled,
              control: {
                key: "aiEnabled",
                type: "toggle",
                disabled: !mirror.status.writable,
              },
            },
          ],
        },
        {
          type: "group",
          heading: ai.connection,
          items: [
            {
              ...ai.mode,
              control: {
                key: "aiMode",
                type: "dropdown",
                options: { ...ai.modes },
                disabled: !mirror.status.writable,
              },
            },
            {
              name: ai.destination,
              desc: ai.disclosure(activeMode()),
              render(setting) {
                const update = () => setting.setDesc(ai.disclosure(activeMode()));
                refreshDestination = update;
                return () => {
                  if (refreshDestination === update) refreshDestination = undefined;
                };
              },
            },
            field("claudeCodePath", ai.claudeCodePath),
            field("codexPath", ai.codexPath),
          ],
        },
        { name: mcp.title, desc: running ? mcp.running(status.endpoint) : mcp.stopped },
        field("mcpPort", mcp.port),
        { name: mcp.start, disabled: running || pending, action: () => action(start, refresh) },
        { name: mcp.stop, disabled: !running || pending, action: () => action(stop, refresh) },
        {
          name: mcp.copy,
          disabled: !running || pending,
          action: () => action(copyConnection(controller, messages.integrations), refresh),
        },
        ...sharing.definitions(),
      ];
    },
    getControlValue(key) {
      if (key === "aiEnabled") return mirror.current.aiEnabled === true;
      if (key === "aiMode") return activeMode();
      return isAgentSetting(key) ? String(mirror.current[key] ?? "") : sharing.controlValue(key);
    },
    async setControlValue(key, value) {
      if (isAgentSetting(key)) {
        await runSafely(
          runtime,
          notifyFailure(
            SettingsService.use((settings) => settings.update(patchFor(key, value))),
            messages,
          ),
        );
        if (key === "aiMode") {
          await mirror.refresh();
          refreshDestination?.();
        }
        return;
      }
      const change = sharing.change(key, value);
      if (!change) return;
      const restoreToggle = Effect.sync(() => refreshDefinitions?.());
      const persist = () =>
        runSafely(
          runtime,
          notifyFailure(change.pipe(Effect.tapError(() => restoreToggle)), messages),
        );
      selectionWrites = selectionWrites.then(persist, persist);
      await selectionWrites;
    },
  };
}
