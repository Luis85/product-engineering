# V14 · Review a delivery slice for the backlog

**Entry and dependencies.** From a V13 slice header, **Fürs Backlog prüfen** opens `#/project/{project}/storymap/{mapId}/slice/{sliceId}`. Use V12/V13 map, story and foundation identity, V07's first-PBI creation and V08/V09's canonical PBI. Follow the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Turn selected stories into backlog work

1. Lead with slice title, outcome and a count of stories with PBIs. List only this slice's stories in journey order, each with its activity and step, title, need, current references and decision. An empty slice offers **Zur Story Map**. Keep the underlying map and its reading position reachable.
2. **PBI aus Story anlegen** prefills the story title and need, the map's PRD requirement and a linked job if available. Prefer a Feature explicitly linked to the card. Let the user review the parent, priority and optional owner (initially **Nicht zugewiesen**). Use the same create flow as the backlog when a Feature or Epic is missing. Saving creates one PBI in the Backlog stage and a link from this story with creation provenance.
3. **Vorhandenes Item verknüpfen** attaches an existing project item. Opening a PBI, Feature or companion uses its correct detail action. Several stories may reference the same PBI. Mark a story covered only when at least one linked PBI resolves. An Epic, Feature, missing reference or a same-ID record in another project cannot satisfy coverage. Distinguish **Neu angelegt**, **Bestehendes PBI** and other linked work in the list.
4. **Zurückstellen** records a decision for this story in this slice, keeping prior links and work. **Wieder aufnehmen** reopens it. Display decisions **PBI offen**, **PBI verknüpft** and **Zurückgestellt** in text. Keep actions keyboard-accessible and return focus to the reviewed story after each decision.

## Integrity and downstream consumers

Before writing, revalidate project/map/slice/card, current coverage, defer state and selected parent. Publish PBI creation, missing prerequisites and story link as one recoverable operation. Repeated submission or retry after an interrupted write yields the same single PBI and link. Story-owned questions retain their ownership until explicitly moved in V13. Reuse and derive choices leave unrelated PBIs, ranks, slice contents and delivery states alone. V15–V18 consume provenance, NFRs and entities through the resulting scope; V21 traces the exact card to the PBI.

## Red-first acceptance

Run native failing tests before implementing creation and reuse. Exercise the end-to-end journey in a fresh vault: create project → job → vision → PRD → map → activity, step, slice and two stories → create one PBI for the first and link it to the second. Verify the PBI count, both backlinks and retained source IDs after reopening Obsidian. Exercise cancel before the first PBI, duplicate submit, stale/deferred card, missing Feature, empty slice, unrelated map and prior Feature link. Run `npm run verify` and record its exit code.

**Reference.** Find `storySliceReview`, `sliceReviewCard`, `storyPbiForm`, `saveStoryPbi`, `storyLinkForm` and `addBacklogPbi` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Read [complete journey and deferral](../../../concept/tests/test_product_flow.py), [foundation inheritance](../../../concept/tests/test_map_foundations.py), [first-PBI cancellation](../../../concept/tests/test_planning_review.py) and [slice controls](../../../concept/tests/test_slice_layout.py).
