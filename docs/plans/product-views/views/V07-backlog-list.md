# V07 · Backlog hierarchy and item editor

**Entry and dependencies.** `#/project/{project}/backlog/list` selects **Liste**. Accept project and leaf navigation from V01/V02, reuse V04/V05 for Markdown and Git history, and attach V06 entity links. Place **Board**, **Liste**, **NFRs** and **Deliverables** in that order as their owners V09–V11 land. The default Backlog entry ultimately opens Board. Follow the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Read and edit a backlog

- Put the item name first. Align **Verantwortlich**, **Status** and **Priorität** into columns. Indent Epic → Feature → PBI → Task, Issue, Frage or Bug with disclosure controls, consistent type badges and readable labels in both themes. Blank metadata stays visually quiet. Provide a narrow-leaf layout and accessible names for icon actions. Expanding a row preserves the reading position.
- Keep the view switch and create action together, with search, level, priority and status filters below. Preserve filter context and originating row on return from detail. Distinguish a new project from a filtered empty result. Show matching descendants with the ancestor context needed to read them.
- **Neuer Eintrag** offers **PBI**. All new item types default to **Nicht zugewiesen** and may be assigned or cleared. Select a parent of the correct type. The first PBI can create its missing Epic and Feature within the same save. Cancel leaves the vault untouched.
- Open a wide, responsive editor. Show title, parent, status, priority, optional owner, and for Epics and Features a single readable Markdown description. Group related records and history separately. Keep **Änderungen speichern** reachable. Show the current position with **Höher** and **Tiefer**. Omit the former rank dropdown. Keep changes staged until save and protect unsaved fields when navigating to a linked record or history.

## Persistence and consumers

Adopt files from the project's registered `.base` using its field mappings and the Backlog plugin's `type`, `parent`, `order` and optional `pbl-id` semantics. Product links use a distinct stable product ID (`pe-id` in the concept). Explicit adoption can add product metadata to the existing Markdown file. Opening the list is read-only. Surface duplicate product IDs as conflicts. Keep the assigned Base reachable through the native host. See the adoption example in [section 7 of the product concept](../../../concept/Product-Engineering-Platform-Produktkonzept.md).

Use project-local IDs and canonical records (`EP`, `FE`, `UC`, `TASK`, `ISS`, `Q`, `BUG`). Preserve each PBI's existing `pbl-id` where present and one parent per non-root item. Changes from the tree, detail and board reach the same record. Validate parent types, rank moves and cycles. Between-row moves respect siblings in the tree and same-type ranking in level focus. Support legal inside drops, a keyboard alternative and scoped undo. Preserve unaffected fields and unrelated ranks on retry.

V08 attaches PBI details and canonical companions. V09 reads and writes the same stage. V10 supplies NFR assignments, V13/V14 story backlinks, V15/V16 source-scoped prototypes and V17/V18 linked requests. Resolve these through stable project and item IDs.

## Red-first acceptance

Start the interoperability test with an existing `.base`, a mapped status field, and two Markdown PBIs, one lacking the optional backlog ID. Adopt one through the plugin, edit its mapped status in the Base, then edit in the plugin and reopen the Base. Assert both views resolve one file, product references survive a rename, unknown keys and body are preserved, and the number of files stays constant.

Start native service tests for valid and invalid reparenting, undo and first-PBI creation, then DOM tests for the editor's status and owner defaults. Observe each failing assertion before implementation. Test save/reload of an Epic description, changing Feature status, clearing an assignee, cancelling a draft rank change, keyboard filtering and returning to the same row. Run `npm run verify` and record its exit code.

**Reference.** See `backlogContent`, `workItemRow`, `editBacklog`, `rankingPeers`, `locationForDrop` and `saveBacklogEdit` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Begin with [backlog](../../../concept/tests/test_backlog.py), [editor](../../../concept/tests/test_backlog_editor.py) and [planning review](../../../concept/tests/test_planning_review.py).
