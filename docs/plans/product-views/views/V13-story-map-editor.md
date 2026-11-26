# V13 · Story Map editor

**Entry and dependencies.** `#/project/{project}/storymap/{mapId}`. V12 supplies map identity, V03/V04 the foundation notes and vault picker, V06 entities, V07–V09 backlog items and companion work, and V10 NFRs. Follow the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Map the journey

- Place title, goal, target group and **Map bearbeiten** above a single compact row of **Grundlagen**, **Prototypen**, **NFRs** and **Entitäten** with counts. Start closed. Open one area at a time. **Grundlagen bearbeiten** lets users replace or clear the PRD, choose multiple JTBDs and add or remove vault notes, images and files through the V04 picker. Deduplicate references and preserve the outer draft when the picker closes. Both empty and populated contexts keep their actions reachable.
- Arrange activities from left to right across the user's journey. Each activity spans its ordered **Nutzerschritte**. Align each story under its step. Each **Lieferabschnitt** forms a horizontal band with its own goal and order controls. Keep its edit and **Fürs Backlog prüfen** actions in a full-width header above the cells. Support adding and editing activities, steps, slices and stories, reordering and moving them where the clickdummy allows, and keeping unsliced stories under **Ohne Lieferabschnitt**.
- Keep names and outcomes readable without relying on color. A labelled add control identifies the step and slice. Use focusable controls for editing and movement. Opening actions must leave the story cells in place. Preserve the map's internal scroll and return focus to the affected card on save or cancel. At narrow widths retain activity/step and slice context and constrain overflow to the map.

## Link work once

Story cards have stable IDs, step and optional slice IDs, a need/outcome, and project-scoped links to existing backlog items. Open linked items and navigate back to the exact story. **Begleititems** supports Task, Issue, Frage and Bug before a PBI exists. **Nur an dieser Story** keeps work with the story. For new work with one linked PBI, preselect it and offer the story as an alternative. With several linked PBIs, require an explicit destination. Preserve the work ID, status and owner when assigning it. Creating a PBI in V14 leaves story-owned work there until assigned. Show attached and related work distinctly.

Use V10/V06's canonical NFR/entity assignments and backlinks. V14 consumes stable slice/card IDs. V15/V16 provide the one-click **Prototyp anlegen** with map scope and linked briefs; carry selected foundations, NFR criteria and semantic relationships. V21 resolves step/slice/story in trace. Keep data available independently of V24's opt-in assistant.

## Red-first acceptance

Start with failing native tests for step/slice placement, one open context and draft-safe foundation editing. Cover missing targets, repeated assignment, stale project, long cards, assigning story work to a linked PBI, and a keyboard trip from map to PBI and back. At 320 and 1252 pixels check that opening a slice action preserves cell alignment, all four disclosure controls remain reachable, and the leaf stays within its bounds. Run `npm run verify` and record its exit code.

**Reference.** In the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html), find `storyBackbone`, `storyBand`, `storyCard`, `mapContextBar`, `mapFoundationForm`, `storyWorkScope` and `saveStoryWork`. Port [context bar](../../../concept/tests/test_map_context_bar.py), [foundations](../../../concept/tests/test_map_foundations.py), [slice layout](../../../concept/tests/test_slice_layout.py), [canonical work](../../../concept/tests/test_product_flow.py), [NFR links](../../../concept/tests/test_nfr_links.py) and [entity links](../../../concept/tests/test_domain_scope_links.py).
