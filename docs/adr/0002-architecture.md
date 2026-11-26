# ADR 0002 · Four layers and scoped UI

## Context

Product Engineering needs the same record rules and use cases in Obsidian, the browser harness and tests. Each Obsidian view can close or move to another window while the plugin stays loaded. The host also owns the styles outside the plugin's view.

## Decision

| Layer | Responsibility |
| --- | --- |
| Domain | Pure schemas, record and settings rules, filenames and issue codes. |
| Application | Effect service ports, use cases, typed errors and message catalogs. |
| Infrastructure | Obsidian and in-memory adapters, plus the local MCP and provider CLI adapters. |
| Presentation | Vue and Nuxt UI surfaces with per-view navigation, form state and focus. |

The application defines its ports and builds the service graph from supplied adapters. `bootstrap` composes the real host, integration and presentation entries. The harness and tests supply equivalent layers. [Service graph](../../src/application/app-services-layer.ts), [Obsidian adapters](../../src/infrastructure/obsidian/app-layer.ts), [Harness](../../harness/layers.ts)

Presentation calls application use cases through `useQuery`, `useCommand` and `useStream`. Effect imports in presentation belong in the shell runtime bridge. A query can be superseded, a command shares its pending execution across repeat submits, and a stream subscription follows its Vue scope. The native settings tab uses Obsidian's declarative API. Record and chat forms use TanStack Form. [Runtime bridge](../../src/presentation/shell/runtime/use-runtime.ts), [Streams](../../src/presentation/shell/runtime/use-stream.ts), [Native settings tab](../../src/infrastructure/obsidian/shell/settings-tab.ts), [Record form](../../src/presentation/notes/use-record-form.ts), [Chat form](../../src/presentation/integrations/components/AgentChatView.vue)

Each plugin load has one `ManagedRuntime`. Opening a view lazily mounts one Vue app in that view. Its owner document supplies the theme and elements, including a portal for that surface. Plugin teardown closes every registered surface before disposing the runtime. Shared state belongs in scoped application services. Keep other state in the owning view. Introduce a client store when state needs to be shared between views and has no service owner. [Bootstrap](../../src/bootstrap.ts), [Surface mount](../../src/presentation/shell/mount.ts)

The plugin owns CSS inside `.product-engineering-root`. Build it from Tailwind theme and utilities, Nuxt UI roles, plugin tokens and the scoped base reset. The build omits preflight, flattens layers and prefixes keyframes. Host variables drive the derived foreground, fill and border tokens. The view acquires theme classes from its own window and mounts its portal under the scoped root. Asset and theme installation stay out of `document.head`. The harness supplies Obsidian-like variables and base rules for the same surfaces. [Stylesheet entry](../../src/styles/app.css), [Tokens](../../src/styles/tokens.css), [UI bridge and reset](../../src/styles/bridge.css), [Build scope](../../scripts/scope-css.mjs), [Host head protection](../../scripts/no-head-plugins.mjs), [Harness host styles](../../harness/fake-host.css)

## Consequences

Application and domain tests can exercise record behavior with deterministic adapters. The DOM and native suites cover view lifetime, focus, theme and pop-out behavior. Dependency boundaries and packaged CSS have their own checks. [Architecture guide](../engineering/architecture.md), [Distribution check](../../scripts/check-dist.mjs)
