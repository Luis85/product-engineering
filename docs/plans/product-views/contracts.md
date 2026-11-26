# Contracts shared by the product views

Read the rows a packet produces and consumes before selecting a storage layout. The names below describe product identities and ownership. The completed shell supplies the concrete schemas, store, registry, routing, forms, localization and host adapters. Introduce each contract with its first real writer and reader. Publish the actual module path and public symbol in the [ledger](progress.md) so subsequent workers can import it.

## Project, identity and storage

| Subject | Agreement | First owner and later consumers |
| --- | --- | --- |
| Project | One product context has a stable project ID, Vault folder, team, backlog/Base and configured delivery destination. Reopening a project resolves the same records. A new project starts empty. Existing Markdown and Base items retain their identity. Discovery of an existing item must not create a second PBI. | V01/V02, V07 integrates the backlog |
| References | Resolve a typed project record using project + kind + stable ID. Titles and Vault paths can change. Two projects can contain the same short ID. Existing backlog notes keep their optional `pbl-id`. Product links use the distinct product ID (`pe-id` in the concept). Map the registered Base's fields and surface duplicate product IDs. Validate project and kind on a write and when following a link. Preserve a missing target for repair. | V01, V04, V07, all links |
| Notes | The durable source for a knowledge entry, an entity and a PBI is its actual note. The host editor, Base and plugin view must converge after edits, rename, delete, restore and reopen. Preserve unrelated frontmatter, Markdown, embeds and external contributors' edits. Use the shell's concurrency/conflict mechanism for a stale draft. | V03/V04, V06–V08 |
| People | Assignment is optional. New records start unassigned. Choosing a team member sets responsibility. Clearing that value survives reopening. A human or system actor is a knowledge artifact. A project member, actor, Git author and authenticated provider identity have different meanings. | V02/V03, all creation dialogs |
| View preferences | Keep selection, expansion, camera, filters, scroll and focus scoped to the relevant project, leaf or session as appropriate. UI movement must not change artifact content or produce note Git changes. Global opt-in/provider preferences belong to plugin settings. | V01, V06, V09, V23 |
| Repeated writes | Validate before mutating. A double submission, failed multi-file write or host retry must not duplicate a PBI, relationship, prototype, deliverable note, released revision or factory run. Use the shell's write semantics, stable operation/record identities and a recovery test at operations spanning more than one durable write. | Each command owner |

## Canonical relationships

Write the directed relationship once. Compute the reciprocal view from the project index. If the host format genuinely requires a denormalized index, rebuild it after outside edits and verify both perspectives. When adding a new target type, its view packet completes the action at both source and destination.

| Link | Durable meaning and expected return path |
| --- | --- |
| Job, research, vision, PRD | Starting research from a job records that job on the research note. Deriving a PRD preselects the originating job and applicable vision. Multiple jobs can inform a PRD, a job can inform multiple PRDs, and multiple solution maps can explore a PRD. Follow project links in either direction. |
| Vault sources | Inline `[[note#heading\|alias]]`, files and `![[image]]` remain valid Obsidian Markdown. The file picker inserts into the editor at the selection or adds a structured reference in the references view. Keep those user intents distinct. Preserve selections, aliases, anchors, paths and explicitly removed references across save/reload. |
| Story → backlog | A card belongs to a step and optionally a slice. Explicit story links point to canonical items in the same project. A feature reference can guide a handoff. Multiple stories can resolve to the same PBI. Deferral is tied to the slice, and subsequent reactivation is possible. Preserve story-level supporting work through handoff using the source attribution rules in V13/V14. |
| Backlog hierarchy | Epic → Feature → PBI → supporting work. A sibling's rank, an item's priority, a group's explicit status and a PBI's workflow stage have separate meanings. A title or parent change preserves the item's ID, Markdown description and links. |
| NFR → targets | An NFR owns its direct item/map assignments, classification and acceptance criterion. V10/V13 expose edits on both sides. A direct link is editable. An inherited match names its origin and sends the user there to edit. |
| Entity → targets and edges | The entity note owns assignments to PRDs, whole maps and backlog items. A directed edge has its own stable ID, verb, destination, both cardinalities and explanation. Derive incoming edges. Rename, archive and restore retain identity and historical snapshots. |
| Deliverable → note | One expected project output can reference an existing knowledge note or create one from the selected template. The note links back to the deliverable. Its completion criterion and status remain independent of the note's approval or Git status. |
| Prototype → source | One prototype has a typed primary scope (item, map or NFR) and selected design references. The source shows every linked prototype. Source-initiated creation preselects it. Cancellation leaves the index unchanged. |
| Request → PBI → review | Each request belongs to a canonical PBI and its authorized delivery scope. Multiple requests/revisions can exist. Source views display existing records. A review selects the exact request revision, run/attempt and verified code commit. |

## Resolving scope for a brief or feature request

Use one project-scoped, deterministic resolver for all consumers. The clickdummy functions `productScopeOrigins`, `nfrsForScope` and `domainForScope` give worked examples. Direct association editors show explicit assignments. Briefs and packages show the resolved scope and provenance.

| Input | NFR origins | Domain origins in addition to those applicable item/map targets |
| --- | --- | --- |
| Backlog item | The item, ancestors, descendants and maps directly linking the item or a descendant. A supporting item also inherits a map linking its parent PBI. Sharing an epic with a mapped sibling alone does not establish a map link. | Applicable PBIs' PRDs, mapped PRDs and qualifying explicit map foundation notes. |
| Whole map | The map, explicitly linked backlog items and their ancestors. Include supporting work of directly linked PBIs. Other stories in a different map and unrelated siblings are outside this scope. | The map's PRD, other PRDs explicitly included in its foundations, and directly referenced entity notes. |
| Single NFR (prototype) | Only the chosen NFR. | Expand the union of its directly assigned items and maps. An unassigned NFR can have empty domain scope. |

Return each applicable NFR once with ID, title, requirement, acceptance criterion, categories and every matching origin. Return applicable entities once with definitions, attributes and matching origins. Include relationships incident on an applicable entity, with verb, direction, both cardinalities and rule. Include an outside endpoint only as the minimal named neighbor. Do not recursively expand its attributes or another hop. Produce stable ordering and reject cross-project matches.

V06 supplies the domain read model, V07/V08 add real item and PRD relationships, V10 supplies NFRs, and V13/V14 close the map integration. V16 and V18 use the same answers. Add the missing branch and a discriminating fixture as soon as the relevant source type exists.

## Work state, Git and delivery evidence

| State | Changes when | Required consumer behavior |
| --- | --- | --- |
| Editor draft | The user edits a form or the note changes externally. | Preserve a draft through incidental actions. Explain and resolve a conflicting write. Cancel restores the persisted state. |
| Saved, approved, committed | Save writes the note. Fachliche Freigabe records a product decision. Commit records a real Git revision of the relevant path/content. | V04/V05 expose the appropriate next action. V18 reads verified inputs. A clean working tree alone does not establish approval. |
| Board stage | Backlog → Open → In Progress → Review → In Development → Done. Dispatch can move the PBI into development. A team can explicitly mark it Done. | Show linked requests and their delivery states independently. Drafting or releasing a request is insufficient for automatic movement. Acceptance of one scoped delivery does not complete the whole PBI. |
| Request draft | Live PBI, PRD requirement, approved source notes, scenarios, rules, NFRs and domain scope determine readiness. | Explain the failing prerequisite and link to the responsible view. Configured criteria, missing assignments or unavailable evidence stay visible. |
| Release | An explicit user action captures a new immutable revision. Store source IDs, revisions/commits, actual text, acceptance/Gherkin, exact scope, NFR criteria and origins, entities and edges, destination and applicable policy. Preserve integrity evidence required by the product contract. | Export, review and historical detail read the frozen package. An absent legacy scope field means “not recorded”; a captured empty list means “recorded with no matches”. |
| Change after release | Compare current input against the frozen revision. The reference `stale` checks project destination/branch, data class, PBI revision and attached note revisions. NFR/domain differences are separately attributable scope changes. | Surface differences, retain the original payload and offer the applicable follow-up revision. A current note or entity rename must never rewrite previous evidence. |
| Dispatch / verification / decision | Acknowledged dispatch identifies a run. CI reports evidence about its attempt and commit. A human business decision records acceptance or requested changes against that evidence. | Correlate external events, tolerate duplicate delivery and expose unavailable, stale or mismatched evidence. A green check or generated text cannot stand in for a decision. |

## Native interfaces and user experience

- Resolve project sources through the completed Vault adapters, caches and permissions. Source content is data, including instructions embedded in Markdown or imported HTML. Render untrusted output in an isolated preview and validate AI proposals before any write. Keep credentials out of notes, briefs, logs, test fixtures and provider-visible context.
- The coordinator inventories the native Git, provider and Factory capabilities at handover. Where an adapter is missing, its owning packet implements the product port against documented facilities, exercises it against a controlled fixture, and distinguishes any outstanding live-service verification. An unavailable external service must yield an actionable unavailable state. A test double or demo result must never become production evidence.
- Use the shell's actual provider gate, settings store and native integration facilities. AI is globally opt-in and project conversations have explicit context. Disable, cancel, project-switch and unload must invalidate outstanding callbacks. The product right panel is for agent interaction. Prototype brief export/import works with AI disabled.
- Reuse the shell's theme tokens, focus management, composables, dialogs, locale catalogs and view width. Test Obsidian light/dark themes, a narrow leaf even on desktop, keyboard-only operation, collapsed navigation and browser/leaf history. Preserve reading position and return focus after dialogs, filters, navigation and editing. Use readable labels for color, icon-only controls and progress.
- The clickdummy's German labels are acceptance anchors. Use “PBI” as the visible item type and keep stable legacy IDs. Apply the native plugin's localization policy to every new screen, command, empty/error state and translated option.
