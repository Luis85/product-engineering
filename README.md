# Product Engineering

Product Engineering is an Obsidian desktop plugin for managing Markdown-backed items. Create items with a title, status, and optional due date. The Items view follows outside vault edits, preserves the note body and unknown frontmatter, and lets you resolve conflicting field changes before saving.

The plugin ID is `product-engineering`. The interface supports English and German. Use Obsidian desktop 1.15.1 or newer.

## Installation

Use the three files from a published release, or run `npm run build && npm run release:package` to stage them under `release/product-engineering`. Copy `main.js`, `manifest.json`, and `styles.css` into the plugin directory in your vault and enable **Product Engineering** in Community plugins.

The usual plugin directory is `<vault>/.obsidian/plugins/product-engineering`. [Third-party notices](THIRD-PARTY-NOTICES.txt) ship beside the plugin folder. To install a published beta, use BRAT’s **Add beta plugin** action with the repository URL. [Installation and releases](docs/engineering/releasing.md)

## Use

Open the **Product Engineering** ribbon button or run the open-view command. The workspace opens to **Items**. Add, edit, or delete items from that view. Choose **Open in Obsidian** to inspect a read-only item or a note listed under **Data issues**.

New items go in **Product Engineering/Items** by default. The schema marker identifies items throughout the vault, including moved files. [Item contract](docs/contracts/item-v1.md)

| Command ID | Action |
| --- | --- |
| `product-engineering:open-view` | Opens or focuses the workspace |
| `product-engineering:copy-diagnostics` | Copies the bounded diagnostic report |

The commands have no default hotkeys.

## Local agent integrations

Open **Settings → Product Engineering**.

- **Local MCP server** controls the port, shared items, and listener. Leave the port blank for automatic assignment, select the items clients may read, start the server, and use **Copy MCP connection** for your client’s Streamable HTTP configuration. Each start issues a new credential for the loopback endpoint. New selections apply at the next start. Removing a selection revokes access immediately. Clients can list and retrieve the explicitly shared item IDs, titles, statuses, and optional due dates.
- **AI adapters** controls the Claude Code and Codex executable paths. Leave the paths blank for discovery or enter absolute paths. Open **AI chat** in the plugin view and choose a provider. The TanStack AI adapters invoke the installed CLI with its active authentication. Path changes apply at the next chat request.

## Development

Use Node 24.22.1 or a newer Node 24 patch with npm 11. Install the locked dependencies with `npm ci`.

Copy [.env.local.example](.env.local.example) to `.env.local` and set `OBSIDIAN_PLUGIN_DIR` for watch builds that install into a development vault. Run `npm run dev`. With the directory unset the command builds the development bundle locally.

Run `npm run dev:ui` for the browser harness. It renders a wide and a narrow pane over an in-memory vault. Use the `scenario` query parameter with `loaded`, `empty`, `invalid`, `readonly`, or `failure`. Use `lang` to select `en` or `de`.

Run `npm run test:e2e` on a Windows or macOS desktop. Use `xvfb-run -a npm run test:e2e` on Linux without a display. The suite copies its fixture vaults, builds the test probe, and launches real Obsidian.

| Script | Purpose |
| --- | --- |
| `npm run verify` | Formatting, lint, type checks, coverage, architecture, production build, artifact and notice checks |
| `npm run verify:full` | The regular gate followed by the incremental inner mutation suite |
| `npm test` | Unit and DOM tests |
| `npm run test:coverage` | Unit and DOM tests with coverage reports |
| `npm run test:e2e` | Desktop Obsidian suite with fixture vaults |
| `npm run test:mutation` | Gated inner mutation suite with incremental results |
| `npm run test:mutation:full` | Forced inner mutation run |
| `npm run test:mutation:edge` | Informational adapter and presentation mutation run |
| `npm run format` / `npm run format:check` | Format files or check formatting |
| `npm run lint` / `npm run typecheck` | Source lint and TypeScript checks |
| `npm run lint:scanner` | Informational community-scanner preview |
| `npm run fallow:config` / `npm run analyze` | Regenerate module boundaries or check architecture and code health |
| `npm run build` / `npm run check:dist` | Build and validate the production distribution |
| `npm run build:probe` / `npm run vault:reference` | Build the test probe and generate the reference fixture vault |
| `npm run dev:ui` / `npm run build:ui` | Run or build the browser harness |
| `npm run notices` / `npm run check:notices` | Generate or validate third-party notices |
| `npm run release:package` | Stage the built plugin and its notices |

## Repository map

| Path | Contents |
| --- | --- |
| `src` | Domain, application, infrastructure, and presentation |
| `tests` | Unit, DOM, desktop specs, adapters, and fixtures |
| `harness` | Browser preview |
| `configs` | Build, analysis, TypeScript, and mutation configuration |
| `scripts` | Development installation, checks, fixture generation, and release staging |
| `.github` | Workflow, dependency update, and pull request configuration |
| `docs` | Decisions, guides, plans, and the item contract |

## Engineering guides

[Architecture](docs/engineering/architecture.md) · [Adding a feature](docs/engineering/adding-a-feature.md) · [Testing](docs/engineering/testing.md) · [Error handling](docs/engineering/error-handling.md) · [GitHub setup](docs/engineering/github-setup.md) · [Releasing](docs/engineering/releasing.md) · [Blueprint](docs/plans/obsidian-plugin-shell-blueprint/README.md)

## Acceptance and limits

The regular gate includes scoped build artifacts and a notice comparison against the current bundle. The full gate adds the 75% mutation threshold across the domain and application layers. The desktop suite covers request and listener teardown, vault writes, file fidelity, focus and pop-outs, themes, and Settings flows.

The record-store contract runs against the memory and Obsidian test doubles. A test-only probe covers selected fidelity scenarios in real Obsidian. Vault readiness depends on Obsidian indexing every current Markdown file, and the index publishes snapshots one type at a time. The manual GitHub setup, hosted release and nightly runs, and personal-vault checks are listed in the [testing guide](docs/engineering/testing.md) and [GitHub setup](docs/engineering/github-setup.md).
