# V09 · Backlog board

**Entry and dependencies.** Both `#/project/{project}/backlog` and `…/backlog/board` open the first **Board** tab. Reuse the V07 tab bar, filters, item editor and status vocabulary, V08 PBI/companion actions, and V05 commit state. Use the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Plan work and hand it to delivery

- In order show **Backlog → Open → In Progress → Review → In Development → Done**. Display PBIs with their ID, title, parent Feature, priority, optional owner, open companion count and linked request status. Distinguish planning, readiness and factory status. Read existing stage values including `Offen`, `In Arbeit` and `Erledigt`.
- Put **PBI anlegen** in the Backlog lane, including on an empty or filtered board. Start in Backlog with **Nicht zugewiesen**. Reuse the creation transaction for missing Epic/Feature. Reveal the newly created PBI if filters previously hid it. A cancelled dialog preserves the previous filter and board state.
- Move cards by drag/drop or a labelled status control usable by keyboard and touch. Preserve rank and parent. Backlog and Done collapse and expand independently, retain counts, accept legal drops while folded and remember preferences per project. Scope horizontal overflow to the board. A narrow Obsidian leaf must still expose every lane and its controls.
- On each PBI, **Begleititem erfassen** opens a chooser with distinct Task, Issue, Frage and Bug options. Reuse V08's child creation. After save, update only the correct card and return focus to the action.
- For an unready PBI show its first concrete gap and **PBI vorbereiten**. If source commits are pending, show **Git-Stand prüfen**. A ready PBI can **Feature Request erstellen** with that PBI preselected. V17/V18 own request creation, dispatch and statuses. Display current and previous requests regardless of creation entry point, and reopen the active one on repeated attempts.

## Stage and return rules

Creating a draft or approving a request leaves the planning stage alone. A successful factory dispatch sets **In Development** and exposes the run's actual status. For older records with active runs, project the effective stage without rewriting notes on read. Honor explicit manual stage choices and completed PBIs. Review acceptance in V20 leaves **Done** under user control. Preserve filtered board origin through request and PBI navigation. V15/V16 attach source-scoped prototype actions.

## Red-first acceptance

Write native failures for the six-lane ordering, a drag and non-drag move, stage projection, linked-request deduplication and independent collapsed states. Port the actual dispatch integration test when V18 lands. Open the first PBI from an empty filtered board, add each child type, switch projects and reload. Assert draft creation and acceptance leave the expected stage untouched. Run `npm run verify` and record its exit code.

**Reference.** Find `kanbanBoard`, `kanbanCard`, `pbiBoardStage`, `boardRequestHandoff` and `moveBoardCard` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Compare [board and toolbar](../../../concept/tests/test_backlog.py), [creation and collapsing](../../../concept/tests/test_board_quick_add.py), [companion chooser](../../../concept/tests/test_companion_chooser.py) and [request lifecycle](../../../concept/tests/test_board_requests.py).
