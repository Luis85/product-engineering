# V21 · Trace from need to acceptance

**Entry** `#/project/kundenportal/trace` → **Nachweiskette**. Select a PBI and answer which need, specification and solution it came from and what has actually been verified. Consume V03/V04 source notes, V05 revisions, V08 PBIs, V13/V14 story backlinks and V18/V20 revision-bound evidence. Read the [shared contracts](../contracts.md), [groundwork intake](../groundwork.md) and [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md).

### Build the flow

- Label the selector **PBI** and order project PBIs by backlog rank. The first selection defaults to the leading PBI. For an empty project show **Backlog öffnen**. Keep focus on the selector when the chain changes.
- **Bedarf und Spezifikation** follows that PBI’s research → JTBD → linked PRD’s vision → PRD requirement → Story Map card and delivery slice → PBI. Preserve multiple real map origins. A map link opens the exact card with focus/scroll restored. Indicate a missing link and offer **PBI öffnen** for the first actionable gap.
- **Lieferung und Abnahme** shows the linked request, PR/tested SHA, stale evidence indicator and business decision. The criteria/evidence section pairs acceptance criterion and scenario IDs with recorded CI and business evidence. When a follow-up draft lacks a test commit, a previous result is explicitly labeled with its revision. Never pair a new live criterion with an old CI pass by display order.
- Read relationships through V13 scope queries and V18/V20 evidence records. Scope every lookup to the selected project and PBI. Navigation and selection are the only writes and belong in leaf-local view state. Preserve the distinct identities of a knowledge note’s Git SHA and the implementation SHA under review.

### Native seam and red-first acceptance

Use the typed [application route registry](../../../../src/application/routes.ts) and V13’s card-focus intent. Project the two chains from existing application queries in one renderable result to avoid flashing unrelated evidence while switching the selector.

1. Fail a native test on `UC-09` with `JOB-12`, `PRD-03#REQ-18`, `SM-01:CARD-03`, `FR-024` and `e3b7c21`. Open the map link and verify the target card receives focus. Switch to `UC-12`, verify `CARD-04` appears and the unrelated `VIS-01` disappears.
2. Test no PBIs, missing research/PRD, a stale decision and a current follow-up draft whose prior revision has evidence. Add a duplicate-looking PBI in a second project to verify ID isolation. Verify a change requested in V20 reaches the trace and a result from another PBI never fills a gap.
3. At narrow width stack the two labeled groups and keep long SHA/IDs, criterion text and navigation accessible. Hand V22 the verified chain and source-gap query. Report red/green evidence and `npm run verify` exit code.

[Clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html) symbols include `traceView`, `storyMapBacklinks`, `lastRequest`, `requestByEvidence`, `stale`. Compare [source and decision trace](../../../concept/tests/test_delivery_review.py), [product journey](../../../concept/tests/test_product_flow.py), [snapshot evidence](../../../concept/tests/test_request_nfrs.py).
