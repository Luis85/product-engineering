# Testing

Write a behavior test, run it to confirm the expected failure, and implement the change. Then run `npm run verify` and read its exit code. The gate prints each step's duration, stops at the first failure, and marks the remaining steps as unrun. `npm run verify:full` appends the incremental inner mutation run. [Gate script](../../scripts/verify.mjs), [Gate tests](../../tests/unit/scripts/verify.test.ts)

## Test projects

| Project     | Environment                            | Use                                                                                                                                                              |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Node                                   | Domain rules, application Effects, store contracts, and build and release scripts. [Unit tests](../../tests/unit)                                                |
| DOM         | Happy DOM with Vue and Nuxt UI         | Production surfaces, lifecycle and focus, and host callbacks through the Obsidian double. [DOM tests](../../tests/dom)                                           |
| Desktop E2E | WebdriverIO and Mocha driving Obsidian | Production artifacts in copied fixture vaults, including the reference vault for readiness and index timing. [WDIO configuration](../../tests/e2e/wdio.conf.mts) |

```bash
npm test -- tests/unit/domain/items/rules.test.ts
npm test -- --project dom
npm test -- -t "rereads an event received during the first build"
npm run test:coverage
```

Vitest uses UTC and runs both projects by default. Coverage checks 90% for lines, statements, and functions and 85% for branches. The independent Windows checkout at `4c9562d` passed 794 tests in 147 files, with 94.88% statements, 87.79% branches, 96.56% functions, and 96.72% lines. [Vitest configuration](../../configs/vitest.config.ts)

| Gate step       | Seconds in that run |
| --------------- | ------------------: |
| `format:check`  |               17.12 |
| `lint`          |               65.46 |
| `typecheck`     |               21.33 |
| `test:coverage` |               41.08 |
| `analyze`       |                5.94 |
| `build`         |                7.71 |
| `check:dist`    |                1.91 |
| `check:notices` |                0.91 |
| `test:mutation` |            4,837.21 |

The checkout passed `npm ci`, `npm ls --all`, and `npm run verify:full` with exit code 0. It installed its own dependencies and started with an empty mutation cache. Its three production artifacts matched the workspace build byte for byte. The script measured 1,344,288 bytes for `main.js`, 74,037 bytes for `styles.css`, and 240 bytes for `manifest.json`.

## Adapters and timing

- Explicitly mock `obsidian` with `vi.mock("obsidian", () => import("@test/obsidian"))` in a test that exercises host adapters. Unmocked imports fail through the Vitest guard. Extend the double against measured host behavior with a small shared case. The double models delayed metadata, cancellable subscriptions, synchronous component teardown, and windows with distinct documents. [Double](../../tests/support/obsidian), [Unit guard proof](../../tests/unit/obsidian-guard.test.ts), [DOM guard proof](../../tests/dom/obsidian-guard.test.ts)
- Compose the same app services over controlled test adapters. `testRuntime` supplies fixture settings, note storage, recorded notices and logs, and a `vaultReady` helper. `mountApp` creates a routed surface. `mountComposable` tests one bridge or command. Dispose the runtime and close mounted surfaces in cleanup. [Test adapters](../../tests/support/adapters.ts), [Runtime helper](../../tests/support/runtime.ts), [Surface helper](../../tests/support/surface.ts), [Composable helper](../../tests/support/composable.ts)
- Run the common store contract against memory and the Obsidian double, including simulated filename sensitivity. The native probe checks shared vault facts, storage scenarios, and cache-readiness behavior using copied files. Exercise mocked provider processes in unit tests and the loopback MCP server with a client fixture. [Note contract](../../tests/support/notes/contract.ts), [Fidelity scenarios](../../tests/support/notes/scenarios.ts), [Probe plugin](../../tests/e2e/probe-plugin/main.ts), [Provider fixtures](../../tests/unit/infrastructure/provider-cli), [MCP fixtures](../../tests/unit/infrastructure/mcp)
- Wait for observable state with `eventually` in DOM tests. It polls every 10 ms within 4 seconds. Use `TestClock` for index quiet periods and maximum batch age. The work-budget unit test counts scans, reads, and decodes. Desktop E2E measures time with the real metadata cache. [Wait helper](../../tests/support/wait.ts), [Index fixture](../../tests/support/notes/index-fixture.ts), [Counted-work test](../../tests/unit/application/notes/note-index-budget.test.ts), [Native index timing](../../tests/e2e/specs/note-index.e2e.ts)

## Static and artifact checks

`npm run lint` runs Oxlint and ESLint. `npm run analyze` checks the generated Fallow configuration and architecture. A planted import from application notes into Items failed both ESLint and Fallow during the tracer task. Module registry tests catch unregistered feature folders, and the route test pins the order of settings sections. [Oxlint rules](../../.oxlintrc.json), [ESLint rules](../../eslint.config.mjs), [Analyzer input](../../configs/fallow.config.mjs), [Registry proof](../../tests/unit/application/modules.test.ts), [Routes proof](../../tests/unit/application/routes.test.ts)

The build checks validate the CommonJS entry, allowed externals, CSS scope, size budgets, and bundle license inventory. Distribution tests exercise invalid fixtures and stale manifests. A real development build failed packaging on the size budget during release checks. [Artifact check](../../scripts/check-dist.mjs), [Distribution tests](../../tests/unit/scripts/check-dist.test.ts), [License checks](../../scripts/third-party-notices.mjs), [Release guide](releasing.md)

`npm run lint:scanner` previews the Obsidian community source scanner against the tracked checkout. CI reports its findings in an informational job. Read the scanner output alongside the release and architecture checks. [Scanner configuration](../../configs/eslint.scanner.config.mjs), [GitHub setup](github-setup.md)

### Manifest and gate acceptance proofs

The throwaway Extras feature was added in an isolated local clone. The Items DOM fixture now reads the section label from the surface manifest, so adding a feature does not require another shared label map.

| Temporary state | Check | Exit | Observation |
| --- | --- | ---: | --- |
| Domain folder alone | Module list test | 1 | The test requests an application-manifest registration. |
| Application manifest registered | Typecheck | 2 | The surface registry requires the new module entry. |
| Application manifest registered, generated configuration still old | Architecture | 1 | The analyzer requests regeneration of the module boundaries. |
| Surface entry and incomplete screen manifest | Typecheck | 2 | The contributed settings section requires its presentation part. |
| Both manifests and both shared entries, with regenerated boundaries | Typecheck, architecture, module list test | 0 each | The module is registered. The temporary typed section expectation includes the new ID. |
| Registered module with the existing runtime route expectation | Route test | 1 | The visible settings section order includes Extras. Adjusting the temporary expectation passes. |
| Extra module removed | Boundary generation | 0 | The original configuration bytes match and the proof clone is clean. |
| String assigned to the numeric title limit | Regular gate | 2 | The gate reports `typecheck` as failed and records every later step as `not run`. |

The tracked plugin sources and tests contain no pending implementation markers, focused or skipped tests, or reasonless lint and type suppressions. The repository-wide marker grep matches a search-command example in the existing Obsidian CLI skill.

## Mutation testing

```bash
npm run test:mutation
npm run test:mutation:full
npx stryker run configs/stryker.config.mjs --mutate "src/domain/items/**/*.ts,src/application/items/**/*.ts"
npm run test:mutation:edge
```

The inner run mutates domain and application TypeScript and breaks below 75%. The edge run reports an informational score for Obsidian and memory adapters, presentation TypeScript, and bootstrap. Both use the same temporary directory within a checkout, so run them serially there. The nightly workflow keeps independent caches and uploads separate reports. [Inner configuration](../../configs/stryker.config.mjs), [Edge configuration](../../configs/stryker.edge.config.mjs), [Nightly workflow](../../.github/workflows/nightly-mutation.yml)

When a mutant survives, apply that change by hand and run the relevant Vitest tests. Add a behavior assertion if the hand-planted change survives and matters to users. Restore the original production code and force the mutation run after changing the tests. Read the timeout count beside each score. Stryker includes timeouts in its score. The controlled filename proof removed the highest clash-suffix assertion, let the boundary mutant survive, then restored the assertion and killed it. [Filename tests](../../tests/unit/domain/notes/file-name.test.ts), [Dependency and mutation baseline](../adr/0001-dependency-baseline.md)

| Recorded Windows run                                |  Score | Timed out | Exit |
| --------------------------------------------------- | -----: | --------: | ---: |
| Forced inner run                                    | 76.05% |       143 |    0 |
| Incremental inner run in the release-task full gate | 76.48% |       139 |    0 |
| Notes scope using the completed inner results       | 80.39% |        82 |    0 |
| Forced Items scope after strengthening tests        | 93.68% |         2 |    0 |
| Informational edge scope                            | 74.56% |         1 |    0 |
| Independent checkout with an empty cache            | 75.22% |        37 |    0 |

## Browser harness

Run `npm run dev:ui` to preview the production surface over memory adapters. `npm run build:ui` builds the preview. Use `?scenario=loaded&lang=de` to start with two items in German. The preview includes a wide surface and a 320 px surface, a theme switch, and a notice list. [Harness entry](../../harness/main.ts), [Fake host styles](../../harness/fake-host.css)

| Scenario   | Fixture                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------- |
| `loaded`   | Two editable items.                                                                         |
| `empty`    | An empty Items list.                                                                        |
| `invalid`  | An invalid status, duplicate titles, unreadable frontmatter, and a malformed schema marker. |
| `readonly` | A valid item beside an item using a newer schema.                                           |
| `failure`  | The initial index scan fails and retry loads an item.                                       |

These cases share the app's runtime, form, and index behavior. Native windows, filesystem behavior, and Obsidian's metadata timing are exercised in the desktop suite. [Harness fixture tests](../../tests/unit/harness-layers.test.ts), [Harness scenarios](../../harness/layers.ts)

## Obsidian desktop tests

Run E2E for lifecycle, settings tab, theme, pop-out, view state, or vault changes. The test script builds the plugin and probe and generates the reference vault. WDIO copies its fixture vaults and stores app downloads in its local Obsidian cache. Keep installers in that cache and use the E2E reports for logs and timing. [WDIO configuration](../../tests/e2e/wdio.conf.mts), [Reference generator](../../scripts/reference-vault.mjs), [Fixture vault](../../tests/e2e/vaults/basic)

```bash
xvfb-run -a npm run test:e2e
xvfb-run -a npm run test:e2e -- --spec tests/e2e/specs/note-store.e2e.ts
```

On Windows, run `npm run test:e2e` from the desktop session. Set `OBSIDIAN_VERSIONS` to `1.15.1/1.15.1` to reproduce the measured app and installer pair. Keep the default two instances or set `WDIO_MAX_INSTANCES` to `1` for a serial investigation. The independent checkout passed all 20 spec files with exit code 0 on this Windows pair in 2 minutes and 4 seconds. It used the existing local Obsidian download cache and separate vault copies. [Desktop baseline](../adr/0001-dependency-baseline.md), [Fixture support](../../tests/e2e/support.ts)

| Spec                                                                   | Native behavior                                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Lifecycle](../../tests/e2e/specs/lifecycle.e2e.ts)                    | Enable, disable, re-enable, open and restore the view through three cycles.                  |
| [Settings and theme](../../tests/e2e/specs/settings-and-theme.e2e.ts)  | Native technical controls, theme change, and read-only newer settings.                       |
| [External settings](../../tests/e2e/specs/external-settings.e2e.ts)    | Live settings edits while a view is open.                                                    |
| [Pop-out](../../tests/e2e/specs/popout.e2e.ts)                         | View, portal, dialog, and Items sheet focus in the owning window.                            |
| [Navigation](../../tests/e2e/specs/navigation.e2e.ts)                  | Route persistence and fallback, history controls, and opening a note in a separate leaf.     |
| [Language](../../tests/e2e/specs/language.e2e.ts)                      | Localized views, commands, settings and notices, plus the fixed ribbon name.                 |
| [Offline icons](../../tests/e2e/specs/no-network.e2e.ts)               | Keep missing-icon resolution local while rendering a view and dialog.                        |
| [Events](../../tests/e2e/specs/events.e2e.ts)                          | Host listener registration and cleanup, plus safe writes in the fixture vault.               |
| [Note store](../../tests/e2e/specs/note-store.e2e.ts)                  | Shared vault facts, store probe scenario, and folder spelling on Windows.                    |
| [Write fidelity](../../tests/e2e/specs/note-write-fidelity.e2e.ts)     | YAML value round-trip, raw frontmatter fences, and byte preservation through the Items form. |
| [Vault readiness](../../tests/e2e/specs/vault-ready.e2e.ts)            | A single complete readiness event on cold, warm and running startup.                         |
| [Note index](../../tests/e2e/specs/note-index.e2e.ts)                  | Reference vault startup and outside edit timings.                                            |
| [Items CRUD](../../tests/e2e/specs/items-crud.e2e.ts)                  | Validate, create, edit, rename and trash a record.                                           |
| [Items outside edits](../../tests/e2e/specs/items-outside-edit.e2e.ts) | Preserve an independent edit and resolve a same-field conflict.                              |
| [Items newer schema](../../tests/e2e/specs/items-newer-schema.e2e.ts)  | Read-only record and preserved file across reload.                                           |
| [Items invalid data](../../tests/e2e/specs/items-invalid.e2e.ts)       | Field repair, duplicate issues, and opening an unreadable note separately.                   |
| [Items focus](../../tests/e2e/specs/items-focus.e2e.ts)                | Modal focus, first invalid field, and focus after create, rename, cancel and delete.         |
| [Settings sections](../../tests/e2e/specs/settings-sections.e2e.ts)    | Section navigation, counts, saved selection and a 320 px layout.                             |
| [Appearance](../../tests/e2e/specs/appearance.e2e.ts)                  | Default light and dark contrast, scoped layout, and a long title in the sidebar.             |
| [MCP sharing](../../tests/e2e/specs/mcp-sharing.e2e.ts)                | Native item consent and revocation, loopback start and stop, and persisted selection.        |

## Manual checks

A personal-vault keyboard-only pass, screen reader, zoom, and a community theme remain manual. Unicode folder spelling on macOS and signed-in provider behavior also need live environments. The desktop suite uses fixture vaults. Claude Code and Codex test cases use controlled local processes. [Provider tests](../../tests/unit/infrastructure/provider-cli), [Vault data ADR](../adr/0007-vault-data-access.md)
