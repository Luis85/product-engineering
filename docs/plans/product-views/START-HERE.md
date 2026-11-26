# Start a fresh implementation session

Choose **GPT-6.2 Sol** (`gpt-6.2-sol`) as the model in a new chat opened on the implementation checkout. Open this file on the branch or worktree that contains the completed groundwork, this handoff, and the matching `docs/concept/` directory. If the groundwork team supplied a specific revision or verification report, include it after the prompt.

For a different checkout, the portable handoff archive contains both documentation directories with their repository-relative paths. Use it to supply missing handoff files on the delivered groundwork branch. If that checkout already has newer concept documents, compare the versions and record the reference revision you choose.

## Paste this prompt

```text
Act as the GPT-6.2 Sol coordinator for the Product Engineering Obsidian plugin. Execute the 24 packets in docs/plans/product-views/README.md in order, one view at a time. Assign a fresh implementer and a separate fresh reviewer to each view. You own integration, acceptance and one local Git commit per view.

Read AGENTS.md and the groundwork.md, orchestration.md, contracts.md, acceptance.md and progress.md files in docs/plans/product-views/. Confirm the completed groundwork, matching clickdummy and reference tests are present. Record the integration branch, baseline commit, native integration points and npm run verify exit code. On resumption, reconcile the ledger with the view commits on this branch before dispatching work.

For each view:
1. Give the implementer the packet, starting commit, native entry points, reference flows and acceptance criteria. Use test-driven development (Red–Green–Refactor), one behavior at a time. Run a focused native test and observe the expected failure before implementing. Make it pass, refactor where useful, and rerun affected tests. Record the test name, command, red assertion and green result. Integrate the changes and run the focused tests and npm run verify.
2. Give the independent reviewer the integrated candidate, clickdummy route, fixture and due acceptance criteria. Have them exercise the same tasks in both interfaces, including layout, keyboard use, navigation, persistence and relevant recovery paths. Check the TDD evidence and record a verdict for each criterion.
3. Have the reviewer save normal.png and narrow.png under docs/plans/product-views/evidence/<packet>/<reviewed-candidate-id>/. Each PNG must show the labeled clickdummy on the left and the native Obsidian view on the right with matching fixture, state, theme and zoom. Use packet-specific widths or default to 1440 and 390 CSS pixels. Match the reference viewport to the native surface, record actual dimensions, and have the reviewer add and open both relative links in progress.md before signing off.
4. Route confirmed findings to the implementer. Reproduce behavioral defects with failing regression tests and visual defects with a failing comparison. Integrate fixes, rerun affected tests and npm run verify, and have the reviewer retest the corrected candidate, refresh both screenshots and update the ledger. Repeat until all due criteria pass and the reviewer explicitly signs off. Keep the current packet open if required evidence is missing.
5. After verification exits 0 and independent sign-off is recorded, create exactly one local Git commit for this view on the integration branch. Use the subject “feat: Vxx <view name>”. Include the reviewed implementation, its tests and fixtures, both final screenshots, and the accepted progress.md entry with findings, retests, verification results and the next packet. Inspect the staged diff and exclude unrelated work, including previously staged changes. Record the reviewed candidate ID in the ledger; report the resulting commit SHA after committing.
6. Inspect the new commit and confirm it contains the signed-off code and tests, the ledger entry, and both PNGs at the paths linked in that committed ledger. Only then dispatch the next view. A failed or interrupted commit leaves this view current. On restart, find the last consecutive accepted view backed by a verified commit on the integration branch, preserve unfinished work, and resume at the first view without that checkpoint.

Include the final cross-view journeys and native host checks from acceptance.md in V24 verification before its commit. Report the view commits, verification results and any external integrations exercised only with fixtures.
```

To resume, open the implementation branch in the fresh session and use the same prompt. The coordinator checks the committed ledger and screenshots against Git history and reconciles any unfinished local work before dispatching the next view.
