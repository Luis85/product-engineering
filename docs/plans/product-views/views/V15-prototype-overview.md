# V15 · Prototype overview and brief creation

**Entry** `#/project/kundenportal/prototypes` → **Prototypen**. A product engineer selects what to prototype, records the interaction they want to test and can return to it from the source. Depends on V01–V04, V07–V10 and V13. V16 consumes the resulting brief. Read the [shared contracts](../contracts.md), [groundwork intake](../groundwork.md) and [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) first.

### Build the flow

1. List project prototypes by title, ID/revision, linked scope and current output status. Keep the clickable legacy `PT-03` on `UC-09` visible. An empty project offers **Prototyp anlegen**.
2. The same creation dialog opens from the register, a backlog item, Story Map or NFR. From a source, preselect its project-local typed ID. From the overview require one scope. Group the picker by backlog kind, whole Story Map and NFR. Preserve descriptive titles beside IDs, including Tasks, Issues, Fragen and Bugs.
3. Capture a title and an actionable description. Allow selecting a reusable **Styleguide** and **Designsystem**, or drafting either document inline. Save the brief and new material together. Cancel returns focus to the originating action and leaves any unsaved parent editor intact.
4. Save opens V16. At the V15 checkpoint the selection must already be usable: open a persisted brief summary with its source and description in the detail slot. V16 expands that slot with editing, export and preview. A source exposes all linked prototypes and their status. Changing scope moves this backlink immediately. Two prototypes may have the same scope.

### Data and native boundaries

Read the project item, map, NFR, knowledge and prototype indexes. Persist stable source kind/ID, title, description, optional design-note IDs, revision and project membership. Resolve legacy `uc`-only entries through the same backlink query. Resolve deleted sources as **Bezug nicht verfügbar**. Reject a missing or foreign scope at save without losing the draft. Coordinate ID allocation and compound writes through the project repository established by earlier views. Derive backlinks from the authoritative source link. Opening or saving a brief invokes no agent.

Register the surface via the existing [module assembly](../../../../src/application/modules.ts). Route into the shared [presentation shell](../../../../src/presentation/shell/routing.ts). Reuse the V01 modal and focus return, V03 document creation rules and project repository ports.

### Red-first acceptance and handoff

- In native tests first reproduce a failed scoped create from `SM-01`, a child backlog item and the register. Verify cancel leaves counts unchanged, inline material is reusable after save/reload, and changing scope removes exactly one old backlink.
- Exercise a legacy and a new prototype on `UC-09`, the same ID in a second project, a dangling source and a failed write. Verify a retry produces one prototype and one copy of each new design note.
- In an Obsidian test vault, open the dialog from a narrow backlog editor, operate the grouped picker with the keyboard, cancel and resume the original edit. At narrow widths keep scope and status labels attached to each register row.
- Hand V16 the typed source resolver and durable brief shape. Return the route, red/green evidence and `npm run verify` exit code to the orchestrator.

[Clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html) symbols include `prototypesView`, `newProto`, `savePrototypeBrief`, `prototypeScope`, `prototypesForSource`. Compare [brief creation](../../../concept/tests/test_prototype_brief.py), [source entry and backlinks](../../../concept/tests/test_prototype_sources.py).
