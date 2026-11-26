# Error handling

## Expected failures

Use the Effect failure channel for a problem the application can explain or recover from, such as invalid item input, an unavailable vault, or a write conflict. Describe it with `describeError`. The resulting `UserMessage` carries severity, title, detail, and an optional action or link. Form validation keeps the user's draft, renders the summary and field messages, and moves focus to the first invalid field. [Message dispatch](../../src/application/user-messages.ts) · [User message type](../../src/application/shell/user-messages.ts) · [Record form](../../src/presentation/notes/use-record-form.ts)

An issue code can also be ordinary data. For example, a decoded note with `field.date` can stay editable. On submit, `InvalidItemError` carries the validation issues that block the write. [Note decoder](../../src/domain/notes/decode.ts) · [Item validation](../../src/domain/items/rules.ts) · [Item writes](../../src/application/items/use-cases.ts)

### Add an expected failure

1. Write a test for the exact message in every language and the use case outcome that exposes it. Confirm the intended failure before implementing the behavior. [Item message tests](../../tests/unit/application/items/i18n.test.ts) · [Item write tests](../../tests/unit/application/items/update.test.ts)
2. Declare a `Schema.TaggedError` in the owning application module. Choose a stable tag and include the data needed for recovery. Add the class to the module's error union where it has one. [Notes errors](../../src/application/notes/errors.ts)
3. Add the tag to the module manifest's `errors.tags`. The assembled `AppError` union follows the registered module describers. [Notes manifest](../../src/application/notes/module.ts) · [Application error type](../../src/application/errors.ts)
4. Handle the tag in the owning module's describer. Add the title, detail, and any field or action labels to both catalogs. [Notes describer](../../src/application/notes/i18n/describe.ts) · [English catalog](../../src/application/notes/i18n/en.ts) · [German catalog](../../src/application/notes/i18n/de.ts)

### Write a message

Name the problem and give a concrete next action. Keep the detail short enough to scan in a notice or above a form. Put a conflicting value where the user can compare it and make a choice. [Notes message examples](../../src/application/notes/i18n/en.ts) · [Conflict choice](../../src/presentation/notes/components/ConflictChoice.vue)

| Useful message | Opaque message |
| --- | --- |
| **Check the item details.** Correct the highlighted fields and save again. | `InvalidItemError` |
| **Settings are read-only.** This file uses a newer settings version. Update Product Engineering to edit it. | Settings failed. |

## Defects

A thrown exception or a broken invariant goes to `reportDefect` once at the operation boundary. The reporter creates an incident ID, emits `defect.reported`, and surfaces a localized notice with the same ID and the support link. `reportUnexpected` quietly handles interruption-only causes. [Reporter](../../src/application/shell/defects.ts) · [Defect tests](../../tests/unit/application/shell/defects.test.ts)

- Vue queries and commands use the runtime bridge, which turns expected failures into messages and sends defects to the reporter. The surface also registers a Vue error handler for rendering errors. [Runtime bridge](../../src/presentation/shell/runtime/use-runtime.ts) · [Surface mount](../../src/presentation/shell/mount.ts)
- Native callbacks use `runSafely`. Handle expected failures before handing an operation to that boundary. For example, agent settings translate a failed MCP start into `McpSettingsError` and show the corresponding notice. [Native callback boundary](../../src/infrastructure/obsidian/shell/run.ts) · [Agent settings](../../src/infrastructure/obsidian/integrations/settings.ts)
- Streams can put recoverable failure in their snapshot. The note index publishes `NoteIndexReadError`, retains its last usable rows, and offers retry. A defect in its worker goes through the defect reporter. [Index worker](../../src/application/notes/index-live.ts) · [Index status UI](../../src/presentation/notes/use-record-screen.ts)
- Bootstrap and unload handle lifetime failures at the host edge. The unload fallback emits `plugin.unload.failed` through `LogSink` and tries to show an incident notice with the host still available. [Bootstrap and unload reporting](../../src/bootstrap.ts)

## Logging and diagnostics

Use `Logger` for structured events. Each event has a level and a stable name. Optional event data contains numbers and booleans, such as counts. Reserve raw conflict values for the conflict UI. Keep user content, vault paths, provider transcripts and stderr, and MCP credentials out of event data. The production console sink writes local output. The logger retains the last 50 entries it accepted at the configured level and accepts every level in development mode. [Log types](../../src/application/shell/ports.ts) · [Logger](../../src/application/shell/logger.ts) · [Console sink](../../src/infrastructure/logging/console-sink.ts)

**Copy diagnostics** writes an English report to the clipboard. It includes plugin and Obsidian versions, platform, active UI language, settings status and issue codes, log level, and the bounded log history. For errors, it copies the error name and up to ten parsed code frames with file basenames. Raw error messages are available in the local console. The separate **Copy MCP connection** action copies the listener credential for a client the user chooses. [Diagnostics builder](../../src/application/shell/diagnostics.ts) · [Code frames](../../src/application/shell/logged-error.ts) · [MCP connection copy](../../src/infrastructure/obsidian/integrations/settings.ts) · [Diagnostics privacy test](../../tests/unit/application/shell/diagnostics-leaks.test.ts)
