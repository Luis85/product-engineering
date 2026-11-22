# V20 · Commit-specific review decision

**Entry** `#/project/kundenportal/review/FR-024` → **Fachliche Review**. The Product Owner confirms a particular released revision and technical result. Depends on V05, V08, V18 and V19. V09, V21 and V22 observe the outcome. Read the [shared contracts](../contracts.md), [groundwork intake](../groundwork.md) and [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md).

### Build the flow

1. Identify the request, revision and tested commit. Show frozen PBI criteria + Gherkin scenario IDs, PR/run, CI, technical approval, responsible reviewer and the frozen NFR/domain material. **Gherkin ansehen** opens the packaged scenarios. The current request remains one navigation step away. A scope-based Done rule checks both the released work IDs and current linked work. Missing scoped IDs need resolution.
2. Accept manual criterion checks only for the current **In Review** revision with a tested commit, technical approval and valid source baseline. Keep the confirmation count visible. Compute **Done** from the released definitions, criterion checks and scoped work requirements. Explain the specific blocker when **Fachlich abnehmen** is unavailable.
3. **Fachlich abnehmen** records the reviewed revision/SHA and Done evidence. **Änderung anfragen** opens a focused dialog naming the request, revision and SHA. Require a nonblank **Befund und erwartetes Ergebnis** and persist it with the decision. Cancelling leaves the review open and preserves existing checks.
4. Show the saved decision, reason and **Folgerevision vorbereiten** where V18 allows it. Keep previous decisions readable if sources subsequently change. Let the product engineer decide when to mark the whole PBI **Done**, including when the request covers only part of it.

### Data and native boundaries

Read the V18 frozen package and receipt for the selected revision. Keep the selected commit, technical state, criteria confirmations and manual gate outcomes separately identifiable. Compare request/revision/SHA/expected state on submit so a newer run or decision cannot receive a stale checkbox update. Write the decision, evidence and history entry in one project repository operation. Reuse [shell modal lifecycle](../../../../src/presentation/shell/modal.ts) for the change request dialog and return focus on cancel. Use local technical evidence fixtures during development.

### Red-first acceptance and handoff

- First reproduce the missing behavior with seeded `FR-024` revision 2, PR #47, SHA `e3b7c21`. A passed CI receipt alone leaves acceptance pending. Satisfy required individual checks/Done rows and verify one decision, board stage preserved and frozen evidence after reload.
- Try missing technical approval, stale source, absent SHA, whitespace-only reason and an intervening revision from a second leaf. Confirm no invalid decision is saved. Change a current NFR or archive an entity and verify historical evidence remains readable. Accept and return to the register in one fixture and request a change in another.
- In a narrow host split keep **Prüfnachweise**, criteria and the decision in reading order, expose the decision target in text and restore focus after the dialog. Hand V21 the selected evidence tuple, change reason and freshness state. Report red/green evidence and `npm run verify` exit code.

[Clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html) symbols include `reviewView`, `reviewDecision`, `gateEditable`, `definitionRows`, `doneForAcceptance`, `canStartFollowup`. Compare [commit-specific decisions](../../../concept/tests/test_delivery_review.py), [frozen domain](../../../concept/tests/test_request_domain.py), [quality criteria](../../../concept/tests/test_request_nfrs.py), [board independence](../../../concept/tests/test_board_requests.py).
