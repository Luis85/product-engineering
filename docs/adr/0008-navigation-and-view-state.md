# ADR 0008 · Navigation and view state

## Context

An Obsidian workspace can restore tabs, split them or move them into another window. Product Engineering needs a durable current screen and back and forward actions scoped to the open tab.

## Decision

Register one Obsidian view type, `product-engineering-view`. A command or ribbon activation reveals the first existing plugin leaf, or opens a new tab if the workspace has none. An explicit route can update that leaf. `ShellView.navigation` is `false` so the frame owns navigation inside the fixed tab. [View adapter](../../src/infrastructure/obsidian/shell/shell-view.ts), [Open route](../../src/infrastructure/obsidian/shell/open-route.ts)

Represent a route as typed data. The route schema combines application route declarations and the ordered settings sections. Its default opens **Items** under **Settings**. Missing, invalid or obsolete saved routes decode to that default. The application route is saved in the Obsidian view state. The first restore resets the leaf's history and later states navigate from the current route. A change requests a layout save. [Route registry](../../src/application/routes.ts), [Route decoding](../../src/application/shell/routes.ts), [View state](../../src/infrastructure/obsidian/shell/shell-view.ts)

Each leaf has its own in-memory history, with at most 50 prior positions. Repeated navigation to the equivalent route keeps its position. Back and forward travel the existing history, and a new route clears the forward stack. The saved view state carries the current route across reloads. [History rules](../../src/application/shell/history.ts), [Per-leaf navigation](../../src/presentation/shell/routing.ts), [Frame controls](../../src/presentation/shell/components/AppFrame.vue)

The shell's **Settings** screen hosts the Items and Data issues sections from their manifests. Section controls can keep focus as the selected component changes. Section content and optional badges use independent lazy loaders. **Agent chat** is a separate frame route. Obsidian's native settings tab remains the home for technical controls. [Surface composition](../../src/presentation/app-surface.ts), [Settings screen](../../src/presentation/shell/components/SettingsScreen.vue), [Agent chat screen](../../src/presentation/integrations/screens.ts), [Native settings](../../src/infrastructure/obsidian/shell/settings-tab.ts)

## Consequences

Restoring a workspace can reopen the last section with a fresh history for that leaf. The same route schema and surface definition work in the browser harness. Tests exercise layout state, restored and obsolete routes, history, and independent view teardown. [View state tests](../../tests/dom/infrastructure/shell/view-state.test.ts), [Native navigation](../../tests/e2e/specs/navigation.e2e.ts), [Native settings sections](../../tests/e2e/specs/settings-sections.e2e.ts), [Native pop-out](../../tests/e2e/specs/popout.e2e.ts)
