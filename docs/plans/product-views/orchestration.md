# Running the plan with fresh subagents

**Each packet has a fresh implementer, a separate fresh reviewer and one coordinator-owned Git commit on the integration branch.** The coordinator dispatches the next view after verifying the accepted view's commit. Its [ledger entry](progress.md), tests and screenshots let a fresh GPT-6.2 Sol session resume from Git history. The [ordered index](README.md) is the queue. The [groundwork handover](groundwork.md) is the first checkpoint.

## Establish the starting point

1. Reconcile the handed-over branch/revision, local changes and test evidence with the ordered shell blueprint. Inspect `AGENTS.md`, actual package scripts, current module manifests and host adapters. Record the integrated revision, branch/worktree, relevant local diff and unresolved capability gaps. Keep unrelated work and the groundwork team's checkout intact.
2. Confirm the concept files, individual view packets and referenced tests are readable in this checkout. For a handoff split across branches/worktrees, bring the agreed docs and baseline together before dispatch. Use stable repo-relative links in worker prompts. A localhost URL in old feedback is unnecessary.
3. Run the baseline gate, read the process exit code and record it. If the supplied baseline fails, identify the failing command and owner. If the shell is still in progress, leave a precise handback for that team. Record product-specific adapters under their owning packets and check their availability when those packets become due.
4. Retain the actual native interfaces in the ledger. For each packet, select a fixture and red assertion before deciding which shared files need changes. Use an empty disposable Vault for creation and a small deterministic populated one for recovery/history/relationship cases. Keep operator data and service credentials outside the fixtures.

## Dispatch one view

Spawn a **new** subagent with a clean context for the selected packet. With a tool that supports it, use `fork_turns="none"` and supply the prompt below. Do not reuse the previous view's implementer. The model selection requirement applies to the coordinator. Keep the packet self-contained even if a worker has no prior messages.

```text
Implement [Vxx · name] in [repo / integration checkout] at [revision + relevant uncommitted baseline]. Read AGENTS.md, docs/plans/product-views/views/[packet], docs/plans/product-views/contracts.md, and the relevant entries in acceptance.md. Open the cited clickdummy functions and tests. Use [actual completed shell paths and prerequisite module symbols].

Own [route + feature files, focused tests, named integration edits]. Coordinate edits to [shared registry/catalog/adapter] with me. Earlier producers available: [IDs/symbols]. Later joins: [owner, condition]. Use [fixture and project]. The native entry point and success observation are [user action and visible/durable result]. Required cross-view assertions for this slice: [journey IDs and concrete result].

Use test-driven development (Red–Green–Refactor), one behavior at a time. Write a focused native test before the implementation and run it to observe the intended assertion fail. Implement the smallest change that makes it pass. Refactor where useful and rerun the affected tests before starting the next behavior. Preserve canonical records and external Vault edits. Cover empty/populated, failure/retry, keyboard/narrow leaf and reload as applicable. Finish through the normal host UI. Run focused tests and npm run verify, reading each exit code. Report the test names, exact red/green commands and outcomes, changed paths, integration evidence, public interfaces and outstanding joins.
```

Each dispatch fills in real paths, current revision and named dependencies. One neutral shell tracer route must not become the implementation of multiple product views. Move shared functionality into the appropriate existing module when two real consumers need it. Preserve shell checks when replacing the tracer.

## Integration and scheduling

**Keep one view in flight.** Keep its changes together as a review candidate based on the preceding checkpoint. Workers return scoped changes to the coordinator. The coordinator makes the single packet commit on the integration branch after review. At dispatch, record the base SHA. At review, identify the candidate by its implementation and test contents, including new files. Use that identifier for sign-off and both screenshot paths. A changed implementation or test produces a new candidate identifier.

| First owner | Later packet closing the join | What must work through the UI at that point |
| --- | --- | --- |
| V01 shell and V03 library | V04, then V22 | Open the same note from the library, a derived job/PRD or the overview and return to its origin |
| V04 note editing, V05 Git | V07/V08 and V18 | Git reads the actual item/note and blocks a release with uncommitted required inputs |
| V06 domain, V07 backlog and V10 NFR | V13/V14 | Map foundations, applicable entities, NFRs and a canonical PBI are navigable in both directions |
| V07 list, V08 PBI and V09 board | V14 and V17/V18 | A slice-created PBI is visible once, existing requests appear on it and dispatch updates the board |
| V11 deliverables and V03/V04 notes | V11 | Creating or linking a deliverable note returns to the same deliverable after reopen |
| V12–V14 map and slice | V15/V16 | A scoped brief includes the current map, design references, NFR criteria and model context |
| V17 register | V18 | Create/open a draft from a PBI and release/dispatch through the real detail route |
| V18 versioned packages | V19–V21 | Exact revisions feed the review queue, decision and trace; a later edit cannot change prior evidence |
| V01 interim project landing | V22 | Both first-job onboarding and a mature project's delivery decisions use real sources |
| V16 external brief, V04 note review entry | V23 then V24 | Settings authorize AI; the Copilot exposes in-context review and an explicitly approved prototype generation |

Record an unbuilt destination under the later owner's packet. Until it exists, present a working earlier view with available actions and actual records. Integration is a later packet's task even when completing it requires editing an earlier view. Do not ship a disabled placeholder for a finished capability or silently count a future join as passed.

## Dispatch the independent reviewer

After integration, spawn a fresh reviewer with a clean context for this view. The reviewer writes the comparison PNGs and the visual evidence in this packet's ledger entry. The implementer owns product fixes and the coordinator owns final acceptance. Give the reviewer the packet, the integrated revision or diff, the prerequisites, the disposable fixture and both entry points.

```text
Independently review [Vxx and packet path] on [integrated revision/diff]. Open [clickdummy route] and [native plugin entry] with equivalent [fixture]. Read the packet, its cited concept tests and [journey IDs/criteria due now]. Perform the same user tasks in both interfaces. Check the visual hierarchy, accessible actions, normal and narrow layouts, navigation, writes/reload and applicable recovery paths. Use the documented native behavior where the packet deliberately adapts a simulated clickdummy interaction.

Save normal.png and narrow.png following “Capture the comparison pair” in docs/plans/product-views/orchestration.md. Add two clickable relative links in this packet's progress.md entry, record the revision, state and dimensions, and open both links before returning PASS.

Check the implementer's TDD evidence for the behaviors delivered and the regressions fixed. For each criterion, give the expected behavior, observed native result and reproducible evidence. For a discrepancy give steps, scope and expected versus actual. Identify any check you could not exercise. Return PASS only when every current criterion has evidence and both linked PNGs show the reviewed revision. Otherwise return CHANGES REQUIRED or BLOCKED with the reason.
```

### Capture the comparison pair

1. Open the actual clickdummy and installed native view on the same fixture, route or equivalent native entry, selection, scroll position, theme and zoom. Capture the state under review. For a dialog or panel packet, show it open. A legitimate native adaptation can be explained beside the links.
2. Use the packet's normal and narrow widths where specified. Otherwise target **1440 CSS px** and **390 CSS px**, respectively. Resize the native leaf or relevant host surface and match the clickdummy viewport to that available width. Record the actual width × height for each side at both sizes. Capture each interface at its own width before composing the images, so placing them side by side does not halve the tested layout.
3. Compose one legible PNG at each width with **Clickdummy** on the left and **Obsidian plugin** on the right. Save `normal.png` and `narrow.png` in `docs/plans/product-views/evidence/<packet>/<reviewed-revision-or-diff-id>/`. Use a filesystem-safe identifier for the implementation being reviewed. Keep the PNGs with the handoff so links survive a fresh checkout.
4. Add two Markdown links relative to [progress.md](progress.md) under the packet's **Screenshot comparisons** field. Open both links and check labels, rendered state and revision before issuing PASS. After a code correction, capture both images on the corrected revision and update the links. If either capture or link is unavailable, keep the review open.

## Fix findings, accept and resume

1. **Implementer** supplies a compact report with an observed red assertion, focused green test names/output, gate result, changed files and what to reproduce in the UI. A compile error or a missing test runner is insufficient red evidence for a behavior.
2. **Coordinator** integrates the candidate, inspects the diff, runs the focused tests and `npm run verify`, reads the exit codes and commissions the independent review above. Include the [journeys](acceptance.md) due at this checkpoint.
3. **Implementer** reproduces each confirmed behavioral defect with a failing regression test before fixing it, then keeps that test green. For a purely visual finding, record the failing comparison and verify the same state after the fix. The coordinator integrates the fixes, reruns affected tests and `npm run verify`, then gives the corrected revision to the independent reviewer. Have the reviewer repeat the original reproductions and affected criteria. Repeat for any remaining issues. If the reviewer becomes unavailable, assign a fresh independent reviewer the open findings and evidence.
4. **Coordinator** prepares the accepted ledger entry only after the independent reviewer passes the final candidate, both screenshot links open, all due criteria have evidence, findings are resolved and `npm run verify` exits 0. Include the next packet and any previously assigned downstream joins. For V24, complete the final checks below and record their results before committing.

### Commit the accepted view

1. Stage the signed-off implementation, integration edits, tests and necessary fixtures, the final `normal.png` and `narrow.png`, and the accepted `progress.md` entry. Inspect `git diff --cached --name-status` and `git diff --cached` against the reviewed scope. Preserve unrelated staged and unstaged work. Use an isolated integration checkout if the current index or shared-file changes prevent a clean packet commit.
2. Make one local commit with subject `feat: Vxx <view name>`, for example `feat: V07 backlog list`. The ledger names the base SHA, reviewed candidate ID and checkpoint subject. Git supplies the SHA of the commit containing that entry. Report it using `git rev-parse HEAD` after success.
3. Inspect `git show --name-status --format=fuller <sha>` and the committed ledger with `git show <sha>:docs/plans/product-views/progress.md`. Resolve both relative image links against that ledger's directory and check each exists in the commit with `git cat-file -e <sha>:<repo-relative-png-path>`. Confirm the implementation and test contents match the signed-off candidate, including newly added files. Dispatch the next packet only when these checks pass. A rejected hook, missing blob or changed candidate keeps the current view open. Repair and reverify it before advancing, with independent re-review if the implementation or tests changed.

### Resume from Git history

On the recorded integration branch, inspect the first-parent log (for example `git log --first-parent --oneline --grep="^feat: V"`), the committed ledger and local status. Starting at V01, identify the last consecutive view with a matching accepted entry and verified checkpoint. Resume the first view missing one. If sign-off survived an interruption before commit, compare the current candidate with that sign-off and finish its checkpoint. If the commit already exists, verify its contents and continue without duplicating it. Preserve partial changes and resolve any disagreement between Git and the ledger before dispatch.

At the final checkpoint, inspect every outstanding join, repeat the journeys in a fresh Vault and after plugin reload, and run the full available host verification described in [acceptance.md](acceptance.md). Report the view commit SHAs, exercised real integrations and any remaining gaps with the exact information needed to close them.
