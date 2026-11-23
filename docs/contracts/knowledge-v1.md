# Knowledge v1

`product-engineering.knowledge/v1` identifies a project Knowledge note. The note's `id` has the form `knowledge-<lowercase UUID>`. Its `project_id` identifies the project registration. New notes go into that registration's effective Vault folder. The note index discovers records in any Vault folder by their schema and project ID.

| Frontmatter key | Meaning |
| --- | --- |
| `title` | Display title |
| `kind` | Knowledge template, such as `actor`, `jtbd`, `prd` or `test-concept`. Readable records with unfamiliar values appear under Other notes. |
| `display_id` | Project-unique short ID such as `AKT-01` or `PRD-03` |
| `approval` | `draft`, `in-review`, `approved` or `changes-requested`. New notes start as drafts. |
| `owner_id` | Optional current project member ID |
| `actor_type` | `human` or `system` on an actor |
| `requirement_id` | Separate project-unique PRD requirement ID such as `REQ-03` |
| `vision_id` | Optional stable Knowledge ID of the product vision |
| `job_ids` | Stable Knowledge IDs of Jobs to Be Done |
| `deliverable_id` | Optional stable ID provided by the deliverables owner |
| `references` | Additional Vault references as wikilinks. New references use the selected file's Vault path. These remain separate from links and embeds in the body. |

The PRD persists its chosen foundations. A note derived from a job or a vision persists the validated origin among its relationship fields. Derive reciprocal links from the index. The deliverables owner supplies a `KnowledgeDeliverableOrigins` service to resolve the exact project and stable ID at submit.

`createKnowledge(request, draft)` accepts a stable ID from `newKnowledgeId`, the project and an optional `KnowledgeOrigin`. It returns the created note. Use the same ID on an operation retry. The note follows its own ID after a title or path change. `knowledgeDetailRoute(projectId, id, origin)` joins the project record route using kind `knowledge`. `knowledgeNoteOptions(projectId)` lists indexed note options, and `resolveKnowledgeNote(projectId, id)` verifies the selected note against the current Vault contents. Both actor subtypes and domain entities use these same record identities.

Application entry: [Knowledge module](../../src/application/knowledge/index.ts). The library displays safe plain-text excerpts. Use the shared `NoteStore.readContent` for freshly read frontmatter and Markdown. Use the registered codec and the note writer's conflict handling for field edits. [Vault data access](../adr/0007-vault-data-access.md)

`readKnowledgeNote(projectId, id, path)` verifies scope and identity and reads the persisted Markdown. `saveKnowledgeNote(base, body, fields)` compares the loaded body and edited fields inside the same Vault operation. A conflicting write retains both the Vault file and the editable draft. Disjoint frontmatter changes merge through the registered codec.

The Knowledge screen manifest contributes the `knowledge` project record screen. Creation uses `KnowledgeCreateDialog` with a typed `KnowledgeOrigin`. Its leaf-local handoff opens the created note by its normal route and focuses the Markdown buffer. `KnowledgeRelatedNotes` joins the scoped note index to show direct sources and derived notes. The **References** view resolves explicit references against the current note path and displays inline links and Vault backlinks separately. **Git History** resolves the saved project record and reads its exact working bytes, native history and selected commit parent through the project Git port.

[Artifact Git](../../src/application/git/index.ts) exposes `inspectArtifactGit`, `compareArtifactGit`, `readArtifactRevision` and `commitArtifactGit`. Knowledge supplies its canonical project record through `knowledgeGitSource`. A caller with another record type provides the same `GitArtifactSource` from its own record resolver. The adapter discovers the worktree from the desktop Vault file. Project repository and branch settings identify the delivery destination. The explicit note commit operates against the checked-out local revision and the reviewed bytes. `readArtifactRevision` returns the historical repository-relative path and exact blob bytes for the requested full commit ID.
