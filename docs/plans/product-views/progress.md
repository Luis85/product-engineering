# Product view implementation ledger

**Initial state: prepared for handoff.** All rows below are unstarted product work. Populate evidence on the implementation checkout when the groundwork team hands it over. This file is the coordinator's durable state across context resets and new chats.

## Integrated baseline

| Record at intake | Actual value |
| --- | --- |
| Source branch/worktree and exact integrated SHA, plus any relevant local diff | Pending groundwork handover |
| Groundwork completion report and ordered blueprint task evidence | Pending |
| Matching clickdummy, concept tests and packet revision present in this checkout | Pending |
| Host, plugin/runtime versions, supported platform and disposable test Vault | Pending |
| Baseline verification command, exit code and report location | Pending |
| Host navigation, module registration, settings, i18n and test fixture seams | Pending |
| Note storage, text-preserving write/conflict handling, index and backlog/Base integration | Pending |
| Git root mapping, actual history adapter and missing capabilities | Pending |
| Provider/authentication, global opt-in and project MCP policy | Pending |
| External Factory / CI contracts, available test endpoint or fixture, remaining live checks | Pending |

## Queue

Statuses are **queued**, **in progress**, **in review**, **accepted**, or **blocked**. A finding sends the current packet back for correction and re-review. If a required check is blocked, record the missing input and keep later views queued. Include the accepted row and its evidence in this view's commit after independent PASS and successful verification. A fresh session checks the ledger in Git history before advancing.

| Packet | Surface | Status | Evidence |
| --- | --- | --- | --- |
| V01 | Project workspace | queued | — |
| V02 | Project administration | queued | — |
| V03 | Knowledge library | queued | — |
| V04 | Knowledge note | queued | — |
| V05 | Git history | queued | — |
| V06 | Domainmodel | queued | — |
| V07 | Backlog list | queued | — |
| V08 | PBI detail | queued | — |
| V09 | Kanban board | queued | — |
| V10 | NFR catalog | queued | — |
| V11 | Deliverables | queued | — |
| V12 | Story Maps | queued | — |
| V13 | Story Map editor | queued | — |
| V14 | Slice handoff | queued | — |
| V15 | Prototype overview | queued | — |
| V16 | Prototype detail | queued | — |
| V17 | Request register | queued | — |
| V18 | Request detail | queued | — |
| V19 | Review register | queued | — |
| V20 | Review decision | queued | — |
| V21 | Trace | queued | — |
| V22 | Project overview | queued | — |
| V23 | Plugin settings | queued | — |
| V24 | Copilot | queued | — |

## Per-packet record

Copy these fields under a heading with the packet ID when dispatching it. A subsequent coordinator should be able to reproduce the result from this record.

- **Dispatch** — fresh worker, starting revision, assigned paths, entry point and fixture.
- **TDD evidence** — for each behavior or regression, record the test path/name, command, nonzero exit and observed assertion before implementation, then the green result and the outcome of reruns after any refactor.
- **Implemented** — changed files, published symbols, canonical storage location, schema compatibility and links consumed by the next packet.
- **Independent review** — reviewer identity, integrated revision or diff, clickdummy route, native entry point and fixture. For each due criterion record its expected and actual result, evidence, and verdict.
- **Screenshot comparisons** — the reviewer inserts two clickable Markdown links, **Normal** and **Narrow**, using paths relative to this ledger such as `evidence/V07/<revision>/normal.png` and `evidence/V07/<revision>/narrow.png`. Each PNG shows the clickdummy on the left and the native view on the right. Record the captured state, theme, zoom and actual CSS dimensions of each side. Open both links before sign-off and refresh the pair on a corrected revision.
- **Findings and sign-off** — reproduction, fix revision, independent retest and outcome for each issue. Record the reviewer's final PASS on the integrated revision, or the exact remaining finding or blocker.
- **Integrated** — integrated revision or local diff identifier, targeted green commands, `npm run verify` exit, host check and result. Distinguish native host, harness, adapter fixture and live service.
- **Git checkpoint** — integration branch, base SHA, reviewed candidate ID and exact subject `feat: Vxx <view name>`. Commit this entry with the view, tests and both linked screenshots. The containing commit's SHA is discoverable from the branch history and can be reported after commit.
- **Joins** — producer → consumer, owner, open/closed, reproduction and test. On closure, update the originating record as well.
- **Next action** — outstanding fix, review or commit check for this packet, or the next numbered packet once the accepted checkpoint is verified.

## Journey evidence and final handoff

Use the journey IDs in [acceptance.md](acceptance.md). Record the fixture, integrated revision, test path, environment, actual exit/result and outstanding limitation per journey. Re-run affected journeys when the source, scope or revision semantics change. Record final full verification and real-host results here alongside any pending external capability.
