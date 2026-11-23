# Project v1

`product-engineering.project/v1` identifies a project registration note. Its `id` has the form `project-<lowercase UUID>`. The note's parent identifies the effective Vault folder. Project discovery uses the note index and follows the registration after a move or rename.

| Frontmatter key | Meaning |
| --- | --- |
| `name` | Product name |
| `description` | Short product description |
| `repository` | Organization and repository, such as `produktteam/kundenportal` |
| `branch` | Delivery branch, initially `main` |
| `backlog_base` | Name of the assigned Base in the project folder, initially `Backlog.base` |

A new registration reserves a folder below the configured root's `Projects` directory. A name collision receives the next available suffix. `Project.md` holds the registration and the Base filters on `note.project_id`. The creation ID identifies the same write across retries. A registration with a missing Base remains discoverable and offers repair in Project administration.

`projectOverviewRoute(projectId)` identifies the project's overview. `projectRecordRoute(reference, origin)` carries the project ID, record kind, stable record ID and an optional origin in that project. `projectById` resolves registered projects, and `projectChanges` follows index changes.

`ProjectSearchContributor` supplies records from its owning feature. Each result provides a project ID, kind, stable record ID, title and its scoped route. It can include a short display ID. Search checks project IDs on both the record and route and excludes ambiguous stable IDs.

Contribute through `projectSearch` on the presentation screen manifest using `ProjectSearchPart` from `src/presentation/projects`. Each loader returns a setup function that runs inside the workspace for each leaf. It can read an indexed stream through the shell and return a contributor that reads the latest snapshot. The palette and generic `project-record` route share those sources. A generic route with conflicting scope or identity, or a duplicate stable reference, resolves to the recovery state. A resolved entry retains its title, optional display ID and scope.

`useNavigationGuard` registers a guard for the lifetime of an editor. The guard can resolve synchronously or after a dialog. Returning `false` preserves the current route and history. The `create-project` intent checks whether the editor can leave before opening the new-project form. A screen can mark a persistent return control with `data-pe-focus-key` so Back can restore focus after a remount.
