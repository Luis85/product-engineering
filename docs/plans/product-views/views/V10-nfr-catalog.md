# V10 · Non-functional requirements

**Entry and dependencies.** `#/project/{project}/backlog/nfrs` selects the third tab **NFRs**. Use V01/V02 project identity and optional owners, V07–V09 backlog records, and V06 domain scope for downstream consumers. Follow the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Enter, ingest and find an NFR

- Persist a project-local stable NFR ID, title, **Anforderung**, **Messbares Abnahmekriterium**, optional owner (default **Nicht zugewiesen**), classifications and typed scope links. Search by text and filter by standard, category or unclassified. Existing projects can have an empty catalog. Show the standard alongside each category.
- Use the clickdummy's stable category IDs and German labels. The catalog distinguishes the nine product-quality characteristics of ISO/IEC 25010:2023 from the four Annex A themes of ISO/IEC 27001:2022. Allow zero or multiple classifications across both sets. Classification is descriptive. A tag does not establish compliance or create an approval gate.
- **NFRs importieren** accepts local file contents or pasted CSV. Parse comma or semicolon separators, UTF-8 BOM, quoted fields and embedded newlines. Recognize the headers `Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien` once each. Pipe-separate category IDs or labels, optionally qualified, e.g. `25010:performance-efficiency|27001:technological`. Show the preview, exact source-line diagnostics, new rows and skips. Reject conflicting same-title records, invalid mappings or malformed CSV before any write. Editing the source invalidates the preview. An identical re-import skips existing records. On native save failure, restore or recover the batch with the shared write contract.

## Assignment and inheritance

The NFR owns many typed references to any V07/V08 backlog item or a V13 whole map. Either side edits the same set and opens the other record. Keep missing references identifiable and removable. Validate the full selection and current project before writing. Preserve unsaved fields in the parent editor when closing a nested picker.

For an item, include direct matches, ancestors, descendants and maps actually linked to that branch (including a companion's mapped PBI). For a map, include its direct scope, linked items, their ancestors and linked PBIs' companions. Avoid sibling and unrelated-map leakage. Return one record per NFR, with matched origins and measurable acceptance text. V15/V16 use this in the prototype brief. V17/V18 freeze it at request release and preserve historic acceptance text and the distinction between legacy missing data and a known empty snapshot.

## Red-first acceptance

Write failing native tests for quoted CSV, conflicting line numbers, retry/rollback, scope traversal and repeated assignment. Test keyboard preview/cancel and a stale project switch. Confirm links navigate in both directions and remain correct after a vault rename and reload. Run `npm run verify` and record its exit code.

**Reference.** Find `nfrView`, `nfrForm`, `parseNfrRows`, `nfrCsvPreview`, `setTargetNfrs` and `nfrsForScope` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Port cases from [catalog](../../../concept/tests/test_nfr.py), [import](../../../concept/tests/test_nfr_import.py), [links](../../../concept/tests/test_nfr_links.py), [scope](../../../concept/tests/test_nfr_scope.py), [brief](../../../concept/tests/test_prototype_nfrs.py) and [release](../../../concept/tests/test_request_nfrs.py).
