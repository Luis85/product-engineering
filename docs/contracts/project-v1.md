# Project v1

`product-engineering.project/v1` identifies a project registration note. Its `id` has the form `project-<lowercase UUID>`. Project discovery uses the note index and follows the registration after a move or rename. The note's parent identifies the effective Vault folder for a registration without a `vault_folder` override.

| Frontmatter key | Meaning |
| --- | --- |
| `name` | Product name |
| `description` | Short product description |
| `repository` | Optional organization and repository, such as `produktteam/kundenportal` |
| `branch` | Delivery branch, initially `main` |
| `vault_folder` | Optional existing Vault-relative folder for new project files. `/` selects the Vault root. |
| `backlog_base` | Name of the assigned Base in the effective project folder, initially `Backlog.base` |
| `team` | List of JSON strings, one per `{id, name, role}` assignment. The list defaults to empty. |
| `research_jtbd_required`, `integration_adr_required` | Optional artifact rules. Both default to enabled. |
| `release_rules` | JSON string containing `{version, ready, done}`. Each criterion holds `{id, title, type, enabled}`. Missing configuration starts at version 1 with the base checks in both phases. |
| `data_class` | `internal` (default), `public` or `confidential` |
| `mcp_read` | Explicit permission for the local MCP `get_project` tool, initially off |

A new registration reserves a folder below the configured root's `Projects` directory. A name collision receives the next available suffix. `Project.md` holds the registration and the Base filters on `note.project_id`. The creation ID identifies the same write across retries. A registration with a missing Base remains discoverable and offers repair in Project administration.

An administration save changes the registration fields in place. Changing the configured folder or Base chooses the destination for subsequent work. The registration, existing Base files, linked notes and other Vault files retain their paths and contents. The replacement Base can be an existing Base with the project's filter or a free filename created through the separate restore action. Project details and data class use the note writer's field conflict checks.

`projectMemberChoices(projectId)` reads scoped choices and `resolveProjectMember(projectId, memberId)` resolves optional responsibility by stable `project-member-<lowercase UUID>` ID. A member ID belongs to its project and identifies an assignment independently of knowledge actors and host users. `projectArtifactPolicy(projectId)` exposes the required artifacts and responsible roles. `projectReleaseRules(project)` reads the saved Ready and Done settings, `projectBaseChecks` identifies the fixed checks, and `captureProjectReleaseRules(projectId)` returns a detached immutable snapshot of the version and enabled criteria. Release consumers persist that snapshot with the released revision.

`ProjectTemplatePart` from `src/presentation/projects` adds `projectTemplates` entries to the owner’s screen manifest. The creation component receives a `ProjectTemplateRequest` with the current `projectId`, preselected template, `dismiss` callback and typed `returnTo` route. Inline cancellation restores the triggering control. A routed flow can use `returnTo` to reopen the template section and focus the same control.

`projectDeliverySettings(projectId)` provides the delivery destination, data class and project read policy. `get_project` accepts one project ID and returns ID, name, repository, branch and data class from the current registration only when it is opted in and has a configured repository and valid data class. The tool re-reads the registration bytes before authorizing. The authenticated loopback listener is managed in native Obsidian integration settings.

`projectOverviewRoute(projectId)` identifies the project's overview. `projectRecordRoute(reference, origin)` carries the project ID, record kind, stable record ID and an optional origin in that project. `projectById` resolves registered projects, and `projectChanges` follows index changes.

`ProjectSearchContributor` supplies records from its owning feature. Each result provides a project ID, kind, stable record ID, title and its scoped route. It can include a short display ID. Search checks project IDs on both the record and route and excludes ambiguous stable IDs.

Contribute through `projectSearch` on the presentation screen manifest using `ProjectSearchPart` from `src/presentation/projects`. Each loader returns a setup function that runs inside the workspace for each leaf. It can read an indexed stream through the shell and return a contributor that reads the latest snapshot. The palette and generic `project-record` route share those sources. A generic route with conflicting scope or identity, or a duplicate stable reference, resolves to the recovery state. A resolved entry retains its title, optional display ID and scope.

`useNavigationGuard` registers a guard for the lifetime of an editor. The guard can resolve synchronously or after a dialog. Returning `false` preserves the current route and history. The `create-project` intent checks whether the editor can leave before opening the new-project form. A screen can mark a persistent return control with `data-pe-focus-key` so Back can restore focus after a remount.
