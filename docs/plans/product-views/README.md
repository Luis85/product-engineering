# Implementing the Product Engineering views in Obsidian

Use this plan **after the plugin groundwork is handed over**. Its target is a working Obsidian plugin in which a team can take a job from research through planning, prepare a versioned request, and trace the delivery decision to its evidence. Each numbered packet is one independently assignable view or user-facing surface.

**Start a fresh chat with GPT-6.2 Sol and paste the prompt in [Start here](START-HERE.md).** Each packet has a fresh implementer and a separate fresh reviewer who compares the integrated plugin with the clickdummy and the packet's acceptance criteria. The reviewer links side-by-side screenshots at normal and narrow widths in the [ledger](progress.md) before signing off. The coordinator gets findings fixed and independently rechecked before dispatching the next view.

## What to read

| When | Document | What it settles |
| --- | --- | --- |
| Before product work | [Groundwork handover](groundwork.md) | Which branch, shell interfaces, storage and host checks the team is building on |
| Before dispatch | [Orchestration](orchestration.md) | Worker input, write ownership, reviews, integration and resumption |
| While implementing | [Shared contracts](contracts.md) | Identities, ownership of links, inherited scope, revisions, capabilities and interaction standards |
| At integration | [Acceptance journeys](acceptance.md) | Evidence that the views work together in the plugin |
| After each packet | [Execution ledger](progress.md) | Actual baseline, work completed, test evidence and outstanding joins |

## Implementation order and ownership

Execute the packets in order. After independent sign-off and verification, the coordinator makes one local Git commit per view containing its implementation, tests, both final screenshots and accepted ledger entry. Verify that commit before dispatching the next packet. A fresh session resumes from the last consecutive accepted checkpoint on the integration branch. The full overview comes late because it reads real product and delivery state. V01 supplies a usable landing page from the beginning. A later packet that exposes a feature in an earlier view owns both ends of that integration and the regression test. In particular, V07 can ship a usable list before V09 registers the Board as the default Backlog destination.

| Packet | User-facing responsibility | What the next views can rely on |
| --- | --- | --- |
| [V01 · Project workspace](views/V01-project-workspace.md) | Create or select a project, navigate, search, collapse the sidebar and return to context | Scoped identities, project routes, Vault location and history |
| [V02 · Project administration](views/V02-project-administration.md) | Manage team, roles, repository, data handling and project rules | Project policy and destination shared by delivery and AI |
| [V03 · Knowledge library](views/V03-knowledge-library.md) | Find, create and classify project notes, including human and system actors | Indexed note types, templates and creation |
| [V04 · Knowledge note](views/V04-knowledge-note.md) | Read, edit, pick Vault references and derive research and PRDs from jobs | Canonical Markdown, relationships and return paths |
| [V05 · Git history](views/V05-git-history.md) | Commit a changed note and compare revisions | Real path-scoped version evidence and working-copy status |
| [V06 · Domainmodel](views/V06-domainmodel.md) | Model entities, attributes and relationships on a navigable canvas | Entity notes and shared domain scope |
| [V07 · Backlog list](views/V07-backlog-list.md) | Scan and edit the Epic → Feature → PBI hierarchy and its supporting work | One ordered, project-scoped backlog |
| [V08 · PBI detail](views/V08-pbi-detail.md) | Specify scenarios, acceptance criteria, readiness and related work | Canonical PBI and requirements used in handoff |
| [V09 · Kanban board](views/V09-kanban-board.md) | Plan work in six columns, add PBIs and supporting work | Default Backlog view with product stage independent of delivery |
| [V10 · NFR catalog](views/V10-nfr-catalog.md) | Capture, classify, import and assign measurable nonfunctional requirements | NFR scope and acceptance criteria |
| [V11 · Deliverables](views/V11-deliverables.md) | Track expected project outputs and create or link their notes | Delivery criteria and note backlinks |
| [V12 · Story Maps](views/V12-story-maps.md) | Find or create alternative solutions for a job and PRD | Map identity and explicit problem context |
| [V13 · Story Map editor](views/V13-story-map-editor.md) | Edit the journey, release slices, foundations and story work | Ordered activities, steps, slices, cards and explicit item links |
| [V14 · Slice handoff](views/V14-slice-handoff.md) | Review a slice, reuse/create a PBI or defer a story | Auditable many-stories-to-one-PBI handoff |
| [V15 · Prototype overview](views/V15-prototype-overview.md) | Find or start a prototype from a selected scope | Brief identity, preselection and source backlinks |
| [V16 · Prototype detail](views/V16-prototype-detail.md) | Prepare a brief, supply design sources, preview and exchange HTML | Scoped brief and attributable prototype output |
| [V17 · Feature request register](views/V17-request-register.md) | Find requests and start a draft from its PBI | Request index and links on board, list and PBI |
| [V18 · Feature request detail](views/V18-request-detail.md) | Check readiness, freeze a revision, dispatch it and inspect the run | Immutable packages and real delivery transitions |
| [V19 · Review register](views/V19-review-register.md) | Find the request revisions awaiting a decision | Project-scoped review queue |
| [V20 · Review decision](views/V20-review-decision.md) | Inspect technical evidence and record a business decision | Decision tied to one exact revision and commit |
| [V21 · Trace](views/V21-trace.md) | Follow a selected PBI from evidence to acceptance | Navigable, revision-aware chain |
| [V22 · Project overview](views/V22-project-overview.md) | Pick the next product action for the selected planning or delivery context | End-to-end entry point for new and mature projects |
| [V23 · Plugin settings](views/V23-plugin-settings.md) | Opt into AI and configure the supported provider | Global capability and credential boundary |
| [V24 · Copilot](views/V24-copilot.md) | Work with explicitly selected project sources and review proposed changes | Opt-in note review, drafting and prototype generation |

Include the Vault and editing journeys in V05 verification, problem-to-backlog and scope in V14, delivery end to end in V22, and AI and the final integrated check in V24. The [acceptance matrix](acceptance.md) identifies the first complete checkpoint for each journey. Record each due result before making that view's commit.

## Product and technical evidence

- Use the [clickdummy guide](../../concept/README.md) and [interactive clickdummy](../../concept/Product-Engineering-Clickdummy-Story-Maps.html) for labels, routes, ordering, empty states, dialogs and return paths. The [browser tests](../../concept/tests/) name the behaviors to reproduce with real plugin tests.
- Use the [product concept](../../concept/Product-Engineering-Platform-Produktkonzept.md), [research and UX review](../../concept/Product-Engineering-UX-Qualitaetsreview.md) and [Factory architecture](../../concept/Product-Engineering-und-Factory-Architektur.html) for intent, design evidence and boundaries. Older references to “Use-Case-PBI” correspond to the PBI. Existing IDs such as `UC-09` remain valid.
- Use the [repository instructions](../../../AGENTS.md), the [ordered shell blueprint](../obsidian-plugin-shell-blueprint/README.md) and the **integrated groundwork revision** for host integration. The native architecture determines how to implement a product behavior. Browser storage, simulated identities, generated Git hashes and fabricated CI results are reference-fixture details.
- Keep this directory and `docs/concept/` together in the implementation checkout. The packets link to files in the repository. They require no chat history, screenshot attachment, running localhost server or copy of a developer's demo data.
- Identifiers such as `SM-01`, `UC-09`, `FR-024` and `PT-03` name records in the reference fixture. Seed a disposable test Vault for those scenarios. A user's first project starts with their own content. Versioned readers protect supported older records. Importing a browser's local demo state is outside the implementation plan.
