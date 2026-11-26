# V22 · Project overview

Open **Überblick** or the host route corresponding to `#/project/{project}/overview`. The overview helps an empty project find its first job and an established team decide what needs attention today. Replace V01's initial landing content in place so existing links and project selection still work. Consume V03/V04 knowledge, V07–V09 backlog, V12–V14 planning, V17/V18 delivery and V19/V20 review. V02 supplies the name and product description.

## New project and planning context

Show **Vom Job zum Backlog** first for a project without requests. Its six rows are **Jobs to be Done**, **Produktvision**, **PRD mit Anforderung**, **Story Map**, **Erster Lieferabschnitt**, and **Übergabe ins Backlog**. Mark completed steps from actual records, link the supporting artifacts and give the next applicable step one clear action. In an empty project, **Ersten Job beschreiben** opens the job template with no responsible person selected. Returning from an editor or cancelling creation must leave the overview in that project's context.

Build a selectable planning context from each solution map, PRDs without a map and jobs without a planned solution. Show the selector when multiple contexts exist. Follow the selected map's own PRD and jobs. Use the PRD's linked vision when available, otherwise the project's applicable vision. Reuse a compatible existing vision. Preserve selection as a job acquires a PRD or map. Switching a branch must reveal its own first slice, stories and canonical PBIs. Restore the selection separately for each project.

An empty first slice offers planning. A populated first slice offers review. Count stories with a valid PBI or an explicit deferral for this slice, deduplicate PBI links, and leave a dangling or Feature-only association open for review. Show completed planning when every story has a recorded disposition. **Weiteren Job beschreiben** remains available in an established project.

## Established project and delivery

For a project with requests, lead with the most actionable delivery decision. Match the reference precedence: actionable business review, clarification/blocker, released package awaiting dispatch, active run, draft readiness, next PBI needing preparation, then historical acceptance or the empty state. Route the action to that exact record/revision. Display up to five other actions, each with a reason. Deduplicate the featured action.

Use V17/V18's stage query for six drill-downs: **Entwurf**, **Klärungsbedarf**, **Übergabebereit**, **In der Factory**, **In Review** and **Abgenommen**. Counts and filtered destinations must agree after a change, including zero-result filters. The ranked PBI table distinguishes priority, backlog status and delivery state. The secondary foundations list opens the canonical knowledge notes. In a narrow leaf give each PBI title a full readable row and label its metadata. Collapsing the left panel expands the available workspace.

## Red-first checks and handoff

1. Start in an empty project and write a failing host/DOM assertion for **Ersten Job beschreiben**. Follow job → vision → PRD → map → first slice → two stories → one canonical PBI. Back on the overview assert both stories have dispositions and only one PBI link appears. Reopen the Vault and check the links.
2. Give one job two competing solution maps and add a job with no PRD. Switch contexts and then projects, including a project with colliding short IDs. Assert the sources and next action follow the selected branch.
3. Seed an actionable review and a blocked request. Assert the review takes precedence, the second appears once, counts navigate to the same results as the register and a later decision updates both views. Repeat with no requests and then with only historical acceptance.
4. Test keyboard activation, tab focus on return, narrow-leaf layout and editing cancellation. Record expected red, green tests, host evidence and the `npm run verify` exit in the ledger.

Use `overviewContexts`, `overviewPlanning`, `overview` and `deliveryStage` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Start with [the product journey](../../../concept/tests/test_product_flow.py) and [workspace navigation](../../../concept/tests/test_workspace_navigation.py). Add native coverage for multi-context switching, stage counts and duplicates.
