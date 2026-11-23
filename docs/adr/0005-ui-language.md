# ADR 0005 · UI language

## Context

The plugin follows Obsidian's language setting. Vault records can be shared across installations with different languages, so schema markers, field keys, stored value codes, and contract folder names need stable spellings. [Item data contract](../contracts/item-v1.md)

## Decision

Read Obsidian's `getLanguage()` once to build the runtime for a load. `languageFromCode` lowercases the code and uses the part before a hyphen or underscore. Supported languages are English (`en`) and German (`de`). English is the fallback. An unload-failure notice can resolve the host language directly when runtime services are unavailable. [Host language adapter](../../src/infrastructure/obsidian/shell/language.ts) · [Language selection](../../src/application/messages.ts) · [Bootstrap](../../src/bootstrap.ts)

Each application module supplies a typed catalog in each language in its manifest. The runtime exposes the composed catalog as `Messages`. Components read it through `useMessages`. The domain emits issue codes and their typed details. Describe them in the application module using the active catalog. [Items manifest](../../src/application/items/module.ts) · [Items catalog](../../src/application/items/i18n/catalog.ts) · [Item validation](../../src/domain/items/rules.ts)

The ribbon and the workspace view display **Product Engineering** in both languages. The command labels follow the catalog. Protocol identifiers such as `list_items` and persisted value codes such as `open` retain their contract spellings. The copied diagnostics use English headings and include the active UI language code. [Ribbon](../../src/infrastructure/obsidian/shell/ribbon.ts) · [View](../../src/infrastructure/obsidian/shell/shell-view.ts) · [Commands](../../src/application/shell/commands.ts) · [Diagnostics](../../src/application/shell/diagnostics.ts)

## Consequences

Reload the plugin to pick up the host's language change. Use both catalogs when adding UI text or a new issue. The shared runtime test fixture defaults to German, and record lists use German numeric collation by default so a language switch keeps list order stable. [Language end-to-end spec](../../tests/e2e/specs/language.e2e.ts) · [Runtime test fixture](../../tests/support/runtime.ts) · [Record kit](../../src/application/notes/record-kit.ts)
