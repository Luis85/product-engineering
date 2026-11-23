# ADR 0006 · Module structure

## Context

Features share the shell and the record kit. A module groups its domain rules, application use cases, presentation, and host adapters as needed. The module name follows the feature across the layers, so a reader can find the implementation from its public entry. [Module registration test](../../tests/unit/application/modules.test.ts)

## Decision

Follow the inward dependency direction. Domain code owns rules and data. Application code owns ports and use cases. Presentation uses application operations through the shell's runtime bridge. Infrastructure implements ports at the edges. Dependencies between plugin modules follow feature → notes → shell. Composition wires the adapter and presentation entries. The current application modules in order are `shell`, `notes`, `items`, and `integrations`. [Application registry](../../src/application/modules.ts) · [Service composition](../../src/application/app-services-layer.ts)

Import a module through its public index. The notes adapter kit and the shell host entry are the two secondary APIs. Infrastructure uses the notes kit to implement the store. Host composition uses the shell host entry to mount or manage a surface. The MCP and provider CLI adapters each have a public index and depend inward on the integration ports. [Notes public index](../../src/application/notes/index.ts) · [Note adapter kit](../../src/application/notes/adapter.ts) · [Shell host entry](../../src/presentation/shell/host.ts) · [MCP adapter](../../src/infrastructure/mcp/index.ts) · [Provider CLI adapter](../../src/infrastructure/provider-cli/index.ts)

### Registration

| Place | Responsibility |
| --- | --- |
| Application manifest | `defineModule` declares the module name and both catalogs. It also declares the module's errors, note types, commands, routes, settings sections, and service layer when used. [Items example](../../src/application/items/module.ts) |
| Presentation manifest | `ModuleScreens` maps the module's declared routes and settings sections to views. Put lazy component loaders here. [Items example](../../src/presentation/items/screens.ts) |
| `APP_MODULES` | Add one entry to the application module list. The application derives messages, errors, routes, settings sections, commands, and `appNoteTypes` from it. [Application registry](../../src/application/modules.ts) · [Note type registry](../../src/application/note-types.ts) |
| `MODULE_SCREENS` | Add one entry for the presentation manifest. The typed map requires a presentation entry for each registered module. [Surface composition](../../src/presentation/app-surface.ts) |

### Enforcement

ESLint and fallow both derive their module names from the literal `APP_MODULES` list through the same reader. ESLint checks import entries and dependency directions. Fallow checks the source architecture and validates the generated configuration against the registry. Run `npm run fallow:config` when changing the registry or module folders. [Module reader](../../scripts/modules.mjs) · [ESLint config](../../eslint.config.mjs) · [Fallow config](../../configs/fallow.config.mjs)

## Consequences

Use English identifiers and stable field keys. Add product terms to the glossary when introducing them in code. Translate user-facing text in the owning module's catalogs. [Glossary](../../GLOSSARY.md) · [UI language decision](0005-ui-language.md)
