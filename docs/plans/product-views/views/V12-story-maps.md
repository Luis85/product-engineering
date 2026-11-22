# V12 · Story Maps register and creation

**Entry and dependencies.** `#/project/{project}/storymaps` opens **Story Maps** under Planung. Consume V01/V02 project navigation, V03/V04 knowledge notes and the V07 index for valid linked backlog items. Follow the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## Start a map from the problem it solves

1. Show one scannable entry per map with its title, user goal, target audience, stable map ID, story count and number of stories with a valid backlog link. Each row opens its map. A story with several valid links counts once. Resolve links within the current project. A link to a Feature contributes to this register's link count, while V14 specifically counts stories covered by a PBI.
2. Offer **Story Map erstellen** in both populated and empty states. Require **Name der Story Map**, **Zielgruppe** and **Nutzerziel**. Create a project-local map with empty activities, steps, slices and cards. Existing projects can have zero maps. Persist the map before opening its editor and keep the form usable if saving fails.
3. From a PRD in V04, **Story Map anlegen** opens the same form with the PRD title, target group from the linked vision where available and the documented outcome. The clickdummy falls back to a single linked job's desired progress. Keep prefills editable, retain the source PRD and its valid JTBD IDs on save, and display the new map as a backlink on the PRD. An incomplete foundation still permits manual input. A separately created map can attach its foundations later.
4. Give the register one primary creation action. Rows should remain readable with long titles. Use a labelled button or link for each row and return keyboard focus to it on back navigation. On narrow leaves, stack the counts below the title. Expose validation against the corresponding field.

## Ownership and handoff

Keep the map ID stable across title changes. V12 owns map identity, creation and list projection. V13 owns the journey editor and foundation edits. V14 owns the per-slice backlog review. A user can describe a job, derive a PRD and map the solution before choosing any backlog item. V15 can select the whole map by ID when creating a prototype. V21/V22 consume map/source relationships and the next authoring action respectively.

## Red-first acceptance

First observe failing service and DOM tests for independent creation, PRD-derived creation and register counts. Create a PRD from a job in a fresh vault, start a map from the PRD, check prefills, cancel once and then save. Reopen the register and the PRD backlink. Exercise missing references, repeated submit, renamed PRD, project switch and an empty map. At the V13 integration gate, verify the route actually opens the matching editor. Run `npm run verify` and record its exit code.

**Reference.** Find `storyMapsView`, `storyMapForm`, `foundationJobs` and `setupStoryMaps` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Read [project-to-PBI journey](../../../concept/tests/test_product_flow.py), [map foundations](../../../concept/tests/test_map_foundations.py) and the [story mapping research and UX decisions](../../../concept/Product-Engineering-UX-Qualitaetsreview.md).
