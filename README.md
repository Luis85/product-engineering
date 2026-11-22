# Product Engineering

Product Engineering is an Obsidian desktop plugin for managing product engineering records in a vault.

## Installation

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/product-engineering/`, then enable Product Engineering in Community plugins.

## Development

The [plugin blueprint](docs/plans/obsidian-plugin-shell-blueprint/README.md) describes how the repository is built. Use Node 24 and npm 11.

## Agent settings

Open **Settings → Product Engineering** in Obsidian.

- Under **Local MCP server**, leave the port blank for automatic assignment or enter a fixed local port. Start the server and use **Copy MCP connection** to configure a client. The listener binds to loopback, and each start generates a fresh connection credential.
- Under **AI adapters**, leave executable paths blank for automatic discovery or enter full paths to Claude Code and Codex. The installed CLI handles authentication. A path change applies to the next request sent from **Agent chat** in the plugin view.
