# V19 · Review register

**Entry** `#/project/kundenportal/reviews` → **Reviews**. Find the request ready for a human decision and see which decisions refer to an older tested state. Depends on V01 and V18. V20 owns decision details, V22 consumes overview counts. Read the [shared contracts](../contracts.md), [groundwork intake](../groundwork.md) and [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md).

### Build the flow

- Project current requests into a register when they have a tested commit or the state **Änderung angefragt**. Preserve accepted results in the register while their revision is current. Display the request title, ID/run, business review state, technical approval and abbreviated tested SHA. Mark stale evidence **Früherer Stand**. At the V19 checkpoint, open the selected request’s existing evidence from V18. V20 adds the dedicated decision view at the review route and connects the register to it.
- With no qualifying records, explain that the first prüfbarer request appears after a test commit. A narrow split stacks labeled pairs. Technical approval, CI success and business acceptance must remain visually and verbally distinguishable without relying on badge color.
- This is a read-only projection of the V18 store. Opening a row, selecting a project or refreshing creates no review, approval or run. If a new draft revision has begun, the prior decision is accessible from version history. Reflect project-local updates after dispatch, evidence arrival or a decision without reordering keyboard focus unexpectedly.

### Native seam and red-first acceptance

Use the V01 route outlet and V18 revision/evidence selectors. The [application module convention](../../../../src/application/module.ts) keeps the projection in application code and view interaction in the registered screen. Treat the record key as project + request + revision and resolve it again when a deep link is restored.

1. Start a failing native test with a draft without evidence, an in-review `FR-024` revision 2 at `e3b7c21`, and a second request with a documented change request. Verify membership, displayed evidence and routing. A technically cleared review still needs the human decision.
2. Change the source PBI’s revision and verify the **Früherer Stand** indicator survives reload while its tested SHA remains exact. Switch to another project sharing a request ID and verify isolation. Handle a missing record with **Reviews öffnen**.
3. Walk the list in a narrow host pane using keyboard only, open the selected evidence and return to the same row. Repeat with the V20 decision destination when integrated. Return red/green evidence and the `npm run verify` exit code. Hand the register query and accepted/stale example to V20/V22.

[Clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html) symbols include `reviewsView`, `deliveryRegister`, `deliveryField`, `stale`, `reviewView`. Compare [delivery decisions and trace](../../../concept/tests/test_delivery_review.py), [delivery surfaces](../../../concept/tests/test_delivery_layout.py).
