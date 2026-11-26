# ADR 0003 · Error handling and Twelve-Factor

## Context

Vault and settings operations can fail in ways the user can fix. Unexpected exceptions need a support reference. Product Engineering runs inside Obsidian. Its optional agent integrations add a desktop loopback listener and short-lived provider processes.

## Decision

Expected failures use Effect's `Schema.TaggedError`. The application module registers its tags and describes them through its catalog. `describeError` turns the failure into a `UserMessage`. The Vue runtime bridge exposes that message to the caller for inline recovery. Native controls can handle the same failure with a notice. [Error union](../../src/application/errors.ts) · [Message dispatch](../../src/application/user-messages.ts) · [Runtime bridge](../../src/presentation/shell/runtime/use-runtime.ts)

Report a defect once where a failing operation leaves its scope. `reportDefect` allocates an incident ID, records an error event, and shows the localized incident notice. `reportUnexpected` treats interruption-only causes as cancellation. [Defect reporting](../../src/application/shell/defects.ts)

Build diagnostics from typed fields. The clipboard report uses host facts, settings status and issue codes, and selected fields from the last 50 accepted log entries. It omits error messages and uses parsed code frames with basenames. The console sink receives the retained local error message. [Diagnostics builder](../../src/application/shell/diagnostics.ts) · [Logged error projection](../../src/application/shell/logged-error.ts) · [Console sink](../../src/infrastructure/logging/console-sink.ts)

### Twelve-Factor mapping

Use the Twelve-Factor principles where they fit an Obsidian plugin. The host-only blueprint left networking and process lifetimes to Obsidian. The port and process rows record the desktop integrations at closeout on 23 November 2026. [The Twelve-Factor App](https://12factor.net/)

| Factor | Application in Product Engineering |
| --- | --- |
| I. Codebase | Keep one versioned repository for the plugin, harness, and tests. |
| II. Dependencies | Pin direct dependencies and commit the npm lockfile. Build the production bundle from that tree. [Dependency baseline](0001-dependency-baseline.md) |
| III. Config | Persist plugin settings in Obsidian's data.json through `SettingsStore`. The settings include the MCP port, shared item IDs, and optional CLI paths. The MCP credential lives in memory. The provider CLI owns its authentication. [Settings schema](../../src/domain/shell/settings.ts) · [Settings adapter](../../src/infrastructure/obsidian/shell/layers.ts) |
| IV. Backing services | Access Obsidian storage, the vault, host services, and provider chat through application ports. Compose their adapters at runtime. [Adapter composition](../../src/application/app-services-layer.ts) |
| V. Build, release, run | Build and check the production assets, stage them with the notices, and load the released assets in Obsidian. [Releasing](../engineering/releasing.md) |
| VI. Processes | Keep live state in the runtime, its services, and mounted surfaces. Recreate it on load. Persist settings and records through their own ports. [Bootstrap](../../src/bootstrap.ts) |
| VII. Port binding | A user starts the desktop MCP listener on `127.0.0.1` using the configured port or an ephemeral port. Each new listener gets a fresh bearer credential. The read-only tools expose the selected eligible items. [Local listener](../../src/infrastructure/mcp/local-server.ts) · [MCP tool definitions](../../src/application/integrations/mcp/shared-item-tools.ts) |
| VIII. Concurrency | Use scoped Effect fibers inside the host. Agent chat starts a CLI process for each turn in a temporary directory and terminates it on cancellation. [Index worker](../../src/application/notes/index-live.ts) · [Provider subprocess](../../src/infrastructure/provider-cli/process.ts) |
| IX. Disposability | Close mounted surfaces and the MCP listener, release subscriptions, and dispose the runtime on unload. Closing a chat cancels its active turn. [Plugin lifecycle](../../src/main.ts) · [Chat session](../../src/presentation/integrations/chat-session.ts) |
| X. Development and production parity | Compose the same application services over the desktop adapters, browser harness, and test doubles. Use the native suite for host behavior. [Host composition](../../src/infrastructure/obsidian/app-layer.ts) · [Harness composition](../../harness/layers.ts) |
| XI. Logs | Emit structured events through `Logger`. The console adapter writes local output and the current runtime retains a bounded history for copying diagnostics. [Logger](../../src/application/shell/logger.ts) |
| XII. Admin processes | Expose one-off user operations as commands, including copying diagnostics. Run release preparation as separate repository commands. [Shell commands](../../src/application/shell/commands.ts) · [Releasing](../engineering/releasing.md) |

## Consequences

A feature owns the expected failures it can explain in English and German. Keep the raw values needed for a repair, such as a note conflict's three values, within the recovery UI. Users can choose to copy a diagnostics report and include its incident ID in a support request. [Error-handling guide](../engineering/error-handling.md)

A listener beyond loopback or a persistent worker requires a separate architecture decision.
