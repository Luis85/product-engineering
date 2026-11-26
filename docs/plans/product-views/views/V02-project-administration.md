# V02 · Project administration

**Outcome.** A product maintainer can configure this project's vault location, repository, team, required artifacts and release criteria, then use those settings elsewhere in the project. Plugin-wide behavior such as provider opt-in stays in Obsidian settings.

**Inputs.** Requires V01 project identity, typed routing, the delivered record services and [shared contracts](../contracts.md). Consult the [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html) at `#/project/kundenportal/settings`. Search for `settingsView`, `definitionSettings`, `definitionForm`, `saveDefinition`, `requestDefinitions`, `required-rule` and `mcp-toggle`.

## Implement this slice

| Area | User action and native effect |
| --- | --- |
| Projekt | Edit product name, description, vault folder, Backlog-Base, repository and standard branch. Validate paths against the selected vault and collisions. Retain project identity on rename. Make the effect of a changed folder explicit. An ordinary settings save must preserve existing records and files. Handle unavailable repository information independently of successful project edits. |
| Team | Add a named project member and role. Keep the creation form open with entered values and a field error for a duplicate. Publish the project-scoped choices used for optional responsibility. An empty project team or owner is valid. A team member, knowledge actor and Obsidian user are distinct concepts. |
| Pflichtartefakte | Display required base artifacts and the role responsible. Explain fixed rules and persist the optional switches. Match the actual rules in the reference. Future release checks consume the stored project policy. |
| Ready & Done | Expose both phases with their base checks, configurable criteria, type, enabled state and version. Preserve IDs during edits and increment the ruleset version on meaningful changes. Publish a way to read active criteria for a new release and freeze that version on release. Previously released packages retain their criteria. |
| Vorlagen | Group product artifact and concept templates. Route **PRD anlegen**, concept and **PBI anlegen** to the same creation flow used by Wissen or Backlog, with type and current project preselected. The owning view registers its factory when available. |
| Integrationen | Show project repository, package contract, data class and MCP read scope. Make an available test action reflect the actual local integration and active scope. Route provider settings to the existing [Obsidian integration settings](../../../../src/infrastructure/obsidian/integrations/settings.ts). Keep project data exposure opt-in and enforce it at the tool boundary as well as in the UI. |

Use the delivered project writer and note store for project-owned settings. Inspect its concurrency/conflict handling before applying changes from a second leaf. Keep the six sections discoverable in narrow leaves, preserve field focus across switch updates and show validation beside the input. Avoid resetting unsaved fields after a background refresh.

## Test first and finish

1. Change project A's name and optional rule, reload and inspect A and B. IDs, project isolation and existing linked records survive. Duplicate a team assignment, correct it in place, save once and verify that Wissen's assignee choices use that team. Use [delivery review](../../../concept/tests/test_delivery_review.py) and [owner defaults](../../../concept/tests/test_project_chrome_and_owners.py).
2. Change a Ready criterion after a request has captured the previous ruleset. Assert the current policy changes and the released one retains its original text, type and status. Test an empty phase, an invalid criterion and version conflict. Until the release view arrives, exercise the snapshot contract using a consumer fixture.
3. Toggle per-project MCP access with the keyboard and assert focus remains on the switch. Confirm the global server setting remains independent and that an unauthorized project read fails even via a direct tool call. See [delivery layout](../../../concept/tests/test_delivery_layout.py). Open a template in this project and return to the same tab after cancellation once its owner lands.

Return the project settings and rule version interfaces, member lookup, template destinations and integration scope check. Record which downstream request, template and MCP bindings were exercised. Run the native behavior suites and `npm run verify` and report their exit codes.
