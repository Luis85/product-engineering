# V11 · Project deliverables

**Entry and dependencies.** `#/project/{project}/backlog/deliverables` opens **Deliverables** after Board, Liste and NFRs. Reuse project identity and owner choices from V01/V02, the knowledge library, template and editor from V03/V04, and the shared backlog tabs from V07/V09/V10. Use the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Track an outcome and its evidence

1. From **Deliverable anlegen**, require **Titel** and **Erwartetes Ergebnis**. Allow **Verantwortlich** (initially **Nicht zugewiesen**), **Fällig am**, **Dokumentvorlage** (including **Ohne feste Vorlage**) and one linked Wissensnotiz. Assign a stable project-local `DEL` identifier and start in **Geplant**.
2. List deliverables with their expected result, owner, date, template, note and status. Open the title to edit. The inline status control supports **Geplant**, **In Arbeit**, **In Prüfung** and **Erledigt**. Search by title, ID or linked note and filter by status and template. Provide a reset action and separate empty-project and empty-filter messages. A phone-width list keeps the title, status and action reachable and all four tab labels visible.
3. **Notiz verknüpfen** selects an existing compatible project note. **Notiz anlegen** opens the V03 creation form with the deliverable's template selected. Saving the note connects its ID, opens its normal editor, and exposes the deliverable in the note's **Verknüpfungen**. Following that backlink opens this deliverable's edit dialog. Cancelling creation leaves the original deliverable intact.
4. Resolve the linked note by stable ID. Renaming updates the displayed title. If the file disappears, identify the existing missing link and let the user clear or repair it. If the chosen template conflicts with a selected note, focus the field and explain the choice. A stale project or duplicate submit cannot connect the wrong note.

## Persistence and boundaries

Store deliverable tracking separately from its optional content note. Changing status to **Erledigt** leaves that note's approval, Git state, PBI board stage and V17/V18 handoff readiness untouched. Existing projects open with zero deliverables unless they have real records. V22 can route to this register by project. The note editor and register remain the owners of their respective state.

## Red-first acceptance

Write and observe native failures for deliverable creation, linking an existing note, prepared note creation/backlink, and independent completion. Use a fresh vault to create a Betriebskonzept deliverable without an owner, create an OPS note, edit it, return through the backlink and reload. Test keyboard-only status changes, a cancelled mobile dialog, a missing note and isolation between projects. Run `npm run verify` and record its exit code.

**Reference.** Find `deliverableView`, `deliverableForm`, `deliverableNoteOptions`, `saveDeliverable` and `deliverableRelated` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Start with [deliverables](../../../concept/tests/test_deliverables.py) and [knowledge templates including actors](../../../concept/tests/test_actor_notes.py).
