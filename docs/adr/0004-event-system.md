# ADR 0004 · Event system

## Context

Vault writes and metadata indexing finish at different times. Features need one event vocabulary across Obsidian, the in-memory store, and the test double. They also need reliable listener teardown when the plugin unloads or a startup is interrupted.

## Decision

Provide one scoped `EventBus` per application runtime. It uses an unbounded Effect `PubSub` so synchronous host callbacks can publish each event without waiting for subscribers to catch up. Subscribers consume their own scoped streams. Runtime disposal shuts down the channel. [Application event bus](../../src/application/shell/event-bus.ts)

The Obsidian adapter publishes `LayoutReady` before registering its file listeners. It maps vault changes to `FileCreated`, `FileModified`, `FileRenamed`, and `FileDeleted`, and metadata changes to `MetadataChanged`. The mapper accepts `TFile` events and preserves the reported path, extension, and previous path on renames. Plugin unload removes the callbacks synchronously. Runtime finalization runs the same idempotent cleanup. [Obsidian event adapter](../../src/infrastructure/obsidian/shell/events.ts)

## Obsidian 1.15.1 measurements

The live Task 13 run passed the note-store and event specs on Windows on 22 November 2026. The probe plugin and the double run the same compact sequences against shared expectations. They wait for observable cache states between writes. [Live note-store spec](../../tests/e2e/specs/note-store.e2e.ts), [Shared fidelity expectations](../../tests/support/notes/fidelity.ts)

- A new file initially has a null cache entry. A processed edit can return while the cached frontmatter still holds the previous value. Metadata readiness follows `changed`, `resolve`, then `resolved` for the measured create and edit. Trashing the test note produces `deleted` followed by `resolved`. [Readiness scenario](../../tests/support/readiness-scenario.ts)
- The live probe observed `true` for a completed trash move. Obsidian 1.15.1's native system-trash refusal path resolves `false`, and the installed API declarations specify a `void` result. The adapter maps `false` to `NoteTrashError` and accepts `true` or `void` as success. Focused adapter tests exercise the refusal and the declared `void` success. [Probe expectations](../../tests/support/notes/fidelity.ts), [Adapter regression tests](../../tests/unit/infrastructure/notes/obsidian-note-store.test.ts)
- The host normalizes slashes, nonbreaking spaces, and Unicode composition. It keeps dot segments and surrounding spaces. An empty path normalizes to `/`. The real adapter passes normalized vault paths to the host. Filename comparisons use NFC and default Unicode lowercase mapping. The native rename preserves `TFile` identity, and the adapter accepts a case-only rename of the same Windows note. A name already held by another note produces `NotePathTakenError`. [Vault and store scenarios](../../tests/support/notes/scenarios.ts)
- `Vault.read` drops a leading BOM. Broken YAML leaves `frontmatter` and `frontmatterPosition` unset and retains a `yaml` section spanning the fences. The probe verified that Obsidian parses `!!str 2026-11-22` as text. The store's serializer writes that form so YAML 1.1 and 1.2 readers preserve the same value. [Live note-store spec](../../tests/e2e/specs/note-store.e2e.ts)
- The native frontmatter snapshot preserves the parsed user fields. The double's initial version injected an extra `position` key into that snapshot. The double now records the span separately in `frontmatterPosition` and preserves the user field. Root-level path handling and the injected read-failure setting in the double also changed to match the adapter's actual entry points. [Obsidian double metadata cache](../../tests/support/obsidian/metadata-cache.ts), [Obsidian double vault](../../tests/support/obsidian/vault.ts)
- The Task 14 live probe matched the metadata cache across 22 fence and line-ending cases. A line starting with three dashes can close the indexed block. Updates accept the standard fence, three dashes with trailing horizontal whitespace, and four dashes. The native `Vault.process` callback preserves the raw BOM and line endings, so edits to the two alternate closing fences retained those bytes and the edited property's trailing comment. The same host round-tripped 900 generated and special YAML values. [Live write fidelity spec](../../tests/e2e/specs/note-write-fidelity.e2e.ts)
- The Windows host reused the existing capitalization of nested folders during creation. Case-sensitive and case-insensitive doubles also run the folder contract. A live macOS check of the spelling of a matching decomposed Unicode folder remains open. [Live note-store spec](../../tests/e2e/specs/note-store.e2e.ts), [Folder contract](../../tests/support/notes/contract-folders.ts)

### Vault readiness

The Task 16 raw measurement used Obsidian 1.15.1 on Windows and a deterministic reference vault with 2,200 Markdown files, including 2,000 records with frontmatter. [Reference vault generator](../../scripts/reference-vault.mjs), [Startup measurement](../../tests/e2e/specs/vault-ready.e2e.ts)

| Startup | Markdown files cached at layout | Metadata activity |
| --- | ---: | --- |
| Cold | 1 of 2,200 after about 205 ms | The first `resolved` fired at about 199 ms. The cache filled in about 24.9 s. The recorder saw 2,200 `changed`, 2,200 `resolve`, and 2,163 `resolved` events. |
| Warm | 2,200 of 2,200 after about 166 ms | The recorder saw 2,200 `resolve` events and one `resolved` event. |
| Plugin enabled in a running vault | 2,200 of 2,200 | The recorder saw zero metadata events. |

The adapter publishes `VaultReady` after `LayoutReady` when every current Markdown file has a cache entry. It checks at layout and on subsequent `resolved` callbacks. The index subscribes before the adapter starts, builds at that edge, and re-reads changed paths in batches after it. [Cache completeness](../../src/infrastructure/obsidian/shell/cache-completeness.ts), [Index worker](../../src/application/notes/index-live.ts)

In one live Windows run the index built in 32.1 ms from the cold readiness edge and 33 ms from the warm edge. Three outside edits appeared in the index 141 to 153 ms after their writes. The counted-work test separately checks one decode per record on the first build, zero extra decodes on an unchanged rebuild, and one read and one decode for a single outside edit. [Native index spec](../../tests/e2e/specs/note-index.e2e.ts), [Counted-work test](../../tests/unit/application/notes/note-index-budget.test.ts)

## Consequences

Each file event describes a write or path change. Consumers that require indexed data use metadata readiness and reread from the store. An unbounded bus preserves observations for a slow subscriber while its scope is active, so subscribers release their scopes promptly. [Application event bus](../../src/application/shell/event-bus.ts)

The end-to-end event spec reads Obsidian's internal `Events._` to compare listener counts with the plugin disabled and enabled. It checks one additional listener for each subscribed event and a return to baseline across three cycles. The production adapter registers and releases listeners through the public API. If a host upgrade changes the internal map or listener-list representation, the test reports that change explicitly. [Live event spec](../../tests/e2e/specs/events.e2e.ts)

The full port contract runs against the in-memory store and the Obsidian double, including simulated case-sensitive and case-insensitive storage. The live probe covers the selected vault operations and readiness sequences on Windows. Its rename assertion covers path and file identity. Obsidian handles link updates through its file manager. [Note-store contract](../../tests/support/notes/contract.ts), [Live note-store spec](../../tests/e2e/specs/note-store.e2e.ts)
