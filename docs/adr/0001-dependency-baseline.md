# ADR 0001 · Dependency baseline

## Context

The plugin ships a single JavaScript bundle and needs reproducible tooling for development, tests, and releases. Direct dependencies use exact versions. The npm lockfile records the transitive tree. The baseline starts from the registry's latest stable releases and accepts a different pin when a compatibility probe identifies a blocker.

The plugin is Product Engineering (`product-engineering`) in `Luis85/product-engineering`. The CSS prefix is `pe`, the record root is `Product Engineering`, and the UI languages are English and German. English is the fallback. German is the test and collation language.

## Decision

Use Node 24 and npm 11. The initial probes used Node 24.22.3 and npm 11.19.0 on Windows. WebdriverIO 10.2.0 requires at least Node 24.22.1 on the Node 24 line, so use a current Node 24 patch. The app baseline is Obsidian 1.15.1, verified against [Obsidian's desktop release index](https://github.com/obsidianmd/obsidian-releases/blob/master/desktop-releases.json).

### Versions

| Package | Pin | Manifest field | Purpose |
| --- | --- | --- | --- |
| `vue` | 3.5.46 | `dependencies` | Vue components and per-surface applications |
| `@nuxt/ui` | 4.13.0 | `dependencies` | UI components and theme tokens |
| `@iconify/vue` | 5.0.5 | `dependencies` | Locally registered SVG icons |
| `tailwindcss` | 4.3.5 | `dependencies` | Prefixed utility classes |
| `effect` | 4.1.5 | `dependencies` | Runtime, service layers, schemas and typed errors |
| `@tanstack/vue-form` | 1.33.5 | `dependencies` | Vue form state and validation |
| `obsidian` | 1.14.4 | `devDependencies` | Obsidian API declarations |
| `typescript` | 6.0.3 | `devDependencies` | TypeScript compiler |
| `vue-tsc` | 3.3.14 | `devDependencies` | Vue SFC type checking |
| `@types/node` | 26.6.6 | `devDependencies` | Node API declarations |
| `vite` | 8.3.8 | `devDependencies` | Production build and browser harness |
| `@vitejs/plugin-vue` | 6.0.11 | `devDependencies` | Vue SFC transforms |
| `postcss` | 8.5.33 | `devDependencies` | Compiled CSS inspection and transformation |
| `postcss-selector-parser` | 7.2.1 | `devDependencies` | CSS selector parsing |
| `@iconify-json/lucide` | 1.2.158 | `devDependencies` | Offline Lucide icon data |
| `vitest` | 5.1.1 | `devDependencies` | Unit and DOM test runner |
| `@vitest/coverage-v8` | 5.1.1 | `devDependencies` | V8 coverage provider |
| `@effect/vitest` | 4.1.5 | `devDependencies` | Effect-aware tests |
| `@vue/test-utils` | 2.6.0 | `devDependencies` | Component mounts |
| `happy-dom` | 21.0.4 | `devDependencies` | DOM test environment |
| `fast-check` | 4.11.0 | `devDependencies` | Property-based tests |
| `yaml` | 2.9.1 | `devDependencies` | Lossless parsing support for note frontmatter |
| `wdio-obsidian-service` | 3.5.0 | `devDependencies` | Launches real Obsidian test sessions |
| `wdio-obsidian-reporter` | 3.5.0 | `devDependencies` | Obsidian test reporting |
| `@wdio/cli` | 10.2.0 | `devDependencies` | End-to-end runner CLI |
| `@wdio/local-runner` | 10.2.0 | `devDependencies` | End-to-end worker runner |
| `@wdio/mocha-framework` | 10.2.0 | `devDependencies` | Mocha framework adapter |
| `@wdio/globals` | 10.2.0 | `devDependencies` | WebdriverIO test APIs |
| `mocha` | 12.0.3 | `devDependencies` | End-to-end test framework |
| `@types/mocha` | 10.0.10 | `devDependencies` | Mocha API declarations |
| `@stryker-mutator/core` | 10.1.1 | `devDependencies` | Mutation testing orchestrator |
| `@stryker-mutator/vitest-runner` | 10.1.1 | `devDependencies` | Vitest adapter for mutation testing |
| `@stryker-mutator/typescript-checker` | 10.1.1 | `devDependencies` | Rejects invalid TypeScript mutants |
| `oxlint` | 1.94.0 | `devDependencies` | Fast lint and architectural import restrictions |
| `eslint` | 9.39.5 | `devDependencies` | Semantic and architectural lint |
| `@eslint/js` | 9.39.5 | `devDependencies` | ESLint JavaScript rule presets |
| `typescript-eslint` | 8.73.0 | `devDependencies` | Type-aware TypeScript linting |
| `eslint-plugin-vue` | 10.12.1 | `devDependencies` | Vue lint rules |
| `vue-eslint-parser` | 10.4.2 | `devDependencies` | Vue SFC parser for ESLint |
| `eslint-plugin-obsidianmd` | 0.6.0 | `devDependencies` | Obsidian plugin submission rules |
| `eslint-plugin-oxlint` | 1.94.0 | `devDependencies` | Disables ESLint rules already handled by oxlint |
| `globals` | 17.14.0 | `devDependencies` | Lint environment globals |
| `prettier` | 3.10.1 | `devDependencies` | Formatting |
| `fallow` | 3.46.0 | `devDependencies` | Static dependency and complexity analysis |

### Fallbacks and blockers

| Latest release | Decision |
| --- | --- |
| TypeScript 7.0.2 | Use 6.0.3. `typescript-eslint@8.73.0` requires TypeScript `>=4.8.4 <6.1.0`. |
| ESLint 10.15.0 and `@eslint/js@10.0.1` | Use 9.39.5 for both. `npm ls --package-lock-only --all` rejected the ESLint 10 tree with `ELSPROBLEMS`. The peer ranges of `@microsoft/eslint-plugin-sdl`, `eslint-plugin-import`, and `eslint-plugin-react` exclude ESLint 10. |
| Obsidian desktop 1.15.1 | Use `obsidian@1.14.4` for API declarations. The registry lists no 1.15.x declarations. Use APIs declared by the pinned types. |

### Compatibility probes on 2026-11-22

| Probe | Result |
| --- | --- |
| Vue type checking | Exit 2 with errors in the SFC script and template. Exit 0 after both were fixed. |
| Stryker and Vitest | Two of two mutants killed with the Vitest runner. The same two were killed with the TypeScript checker enabled. |
| Nuxt UI, Vite, and Tailwind | A build using `router: false` completed and emitted the Nuxt UI button class `.rounded-md`. |
| Effect and Vitest | An `it.effect` test passed. |
| TanStack Form in happy-dom | An invalid submit rendered the field message. A valid submit invoked the handler once with the entered value. |
| TypeScript ESLint | The installed 6.0.3 was within the declared peer range and the baseline dependency tree passed `npm ls --all`. |
| Obsidian ESLint rules | The baseline dependency tree with ESLint 9 passed `npm ls --all`. |
| Obsidian API types | The installed package matched the latest published API declarations and includes `getSettingDefinitions`. The desktop release baseline remains 1.15.1. |
| Newer Lucide data, fast-check, and fallow | The Settings icon resolved, a fast-check property passed, and the fallow executable reported version 3.46.0 with a verified signature. |

### Security overrides

The unmodified tree reported 25 moderate findings across three transitive packages and their dependants. The clean overridden lockfile reported zero findings. The compatibility probes were repeated after applying the overrides. Applying the overrides to an existing installation initially left two stale `glob` entries, so the clean lockfile was resolved from an empty dependency tree.

| Override | Advisory | Dependency path and compatibility |
| --- | --- | --- |
| `qs@<6.17.0` → `6.17.1` | GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw | Stryker's dashboard reporter uses it through `typed-rest-client`. The pin stays within the 6.x API. |
| `minimatch@>=7.0.0 <11.0.1` → `11.0.9` | GHSA-g3hv-75wg-m249 | Used by Stryker, ESLint plugins, Vue Test Utils, and WebdriverIO. Version 11 retains `Minimatch`, `minimatch()`, and `escape()`. |
| `glob@>=9.0.0 <14.0.2` → `14.0.6` | GHSA-3g3m-2fjr-6pw4 | Replaces vulnerable copies used by Mocha and the Vue Test Utils dependency `js-beautify`. The tooling uses file globbing. |

### Runtime dependencies and their costs

| Package | Justification |
| --- | --- |
| `vue` | Owns component state, rendering, and each surface's Vue application. |
| `@nuxt/ui` | Supplies the interactive controls and accessibility behavior used by Vue views. |
| `@iconify/vue` | Renders the offline icon collection through the icon components. |
| `tailwindcss` | Generates the utility CSS used by Nuxt UI at build time. |
| `effect` | Owns schema validation, expected failures, scoped services, and the managed runtime. |
| `@tanstack/vue-form` | Manages validation and submission of Vue forms. |

New runtime dependencies need a justification in this ADR. Add each override with the first tool that introduces its affected dependency into the lockfile.

### Desktop agent integration packages

| Package | Pin | Manifest field | Purpose |
| --- | --- | --- | --- |
| `@modelcontextprotocol/server` | 2.4.0 | `dependencies` | Registers typed tools and negotiates MCP protocol versions. |
| `@modelcontextprotocol/node` | 2.1.2 | `dependencies` | Connects the Streamable HTTP transport to the local Node listener. |
| `@tanstack/ai` | 1.8.0 | `dependencies` | Streams chat through adapters for the installed Claude Code and Codex CLIs. |
| `@modelcontextprotocol/client` | 2.4.0 | `devDependencies` | Exercises tool discovery, calls, and teardown with an MCP client during tests. |

The read-only MCP tools and server added about 324 KB to the minified CommonJS probe. The provider adapters and session controller were tested with local fixtures. Authentication and billing follow the active account of the installed CLI. [MCP transport specification](https://modelcontextprotocol.io/specification/latest/basic/transports), [TanStack AI](https://tanstack.com/ai/latest/docs/getting-started/overview), [Claude Code terms](https://code.claude.com/docs/en/legal-and-compliance), [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

### Other choices

The desktop-only manifest stays in place until mobile behavior can be verified. Prettier supplies the formatter while Oxfmt is in its 0.x series. Add packages when they are first used so the static analyzer can flag real unused dependencies.

## Consequences

Update repository dependencies with exact version pins and commit the lockfile. Inspect `npm outdated` monthly and after Obsidian minor releases, then rerun the probes for each changed combination. Retire an override once all applicable parents require a patched dependency.
