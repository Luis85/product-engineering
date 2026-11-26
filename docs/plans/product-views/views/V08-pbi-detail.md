# V08 · PBI detail and companion items

**Entry and dependencies.** `#/project/{project}/usecase/{pbiId}` opens the canonical PBI from V07. Accept direct links and return to the originating Board or Liste with its filters and selected tab. V01–V06 supply the project, knowledge sources, Git and domain entities. Follow the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Reading, authoring and readiness

1. Lead with the title, PBI ID, parent, and separate **Backlog**, **Fachlich** and **Factory** statuses. Give the next preparation action a clear label. Use the reading tabs **Use-Case**, **Begleititems**, **Kriterien & Gherkin**, **Verknüpfungen**, **Bearbeiten** and **Git History**. Group Prototypen, NFRs and Entitäten compactly. Keep actions available at phone width.
2. Edit the existing PBI's description and source links. Let users attach the PRD and requirement, job, Research and optional ADR. Reuse the vault picker and Markdown editor for note content and references. A source note navigation restores the originating PBI tab. An invalid link remains identifiable.
3. Create, edit and track **Task**, **Issue**, **Frage** or **Bug**. Persist one child ID, parent, description, priority, status and optional owner. Board and map display the same work when it is attached to the PBI. Keep open and total counts current.
4. Create an observable acceptance criterion and an associated named Gherkin scenario with Given, When and Then. Preserve criterion/scenario identifiers so a later request can cite a particular revision. The readable specification and downloadable feature use these same records.
5. Explain individual readiness gaps and give the user a route to resolve them. Use the project's enabled evidence and ADR rules, approved vision and PRD requirement, PBI approval, complete scenarios and repository. Resolve outstanding commits through V05. A planning-stage change or an open companion alone does not grant or revoke release approval. Save substantive changes using the shared revision and approval rules.

## Later connections

The PBI's Markdown narrative retains the actor and goal, trigger and preconditions, main flow, alternatives and result. Start from `addBacklogPbi` in the reference. Verify that editing a single section preserves authored Markdown elsewhere and keeps the anchors/criteria used in the package.

V09 adds the board return path and request preparation. V10 supplies NFR assignments. V13/V14 add exact story backlinks and source provenance. V15/V16 attach preselected prototype creation and linked previews. V17/V18 attach current and previous requests with their own statuses and frozen criteria. Give the trace view the stable PBI, requirement and criterion identifiers.

## Red-first acceptance

Write failing native tests for the same child read from multiple surfaces, source edits that invalidate approval, Gherkin output and return navigation. Verify by keyboard that a user can create an unassigned question and criterion, cancel an edit, recover an unsaved draft and return from a link. Exercise a missing PBI and a link to a different project. Reload a vault note to prove the data survived. Run `npm run verify` and record its exit code.

**Reference.** Find `useCaseView`, `workPanel`, `approveUseCase`, `gaps` and `pbiMarkdown` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Read [PBI layout](../../../concept/tests/test_pbi_context_layout.py), [companion chooser](../../../concept/tests/test_companion_chooser.py), [planning navigation](../../../concept/tests/test_planning_review.py), [vault references](../../../concept/tests/test_vault_references.py) and [board/request handoff](../../../concept/tests/test_board_requests.py).
