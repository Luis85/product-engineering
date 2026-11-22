# V17 · Feature Request register

**Entry** `#/project/kundenportal/requests` → **Feature Requests**. The register tracks engineering handoffs across the project. Depends on V01, V02 and V07–V09. Introduce the request identity, draft-creation command and register projection here. V18 extends them with release and run transitions. V22 uses the same stage query for its overview. Start with the [shared contracts](../contracts.md), [groundwork intake](../groundwork.md) and [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md).

### Build the flow

- Render one row per request with title, ID, current revision, linked PBI, delivery status, run if present and Ready/Done progress. Use a minimal selected-draft readback at V17 so creation, reopen and return work immediately. V18 extends this destination with the package and connects the gate counts to its **Ready & Done** tab. A stage selected on the overview narrows the register and displays the count plus **Alle anzeigen**.
- **Feature Request erstellen** opens the same form as the board/PBI. Select a project PBI, name the request or inherit its title, and describe **Lieferumfang**. Without a PBI, offer **PBI anlegen**. A contextual entry preselects the exact PBI. Surface preparation actions for missing requirements or uncommitted inputs. An existing active request opens directly from that PBI. Preserve access to completed requests and return to the originating board filters.
- Saving creates a draft and a visible link on the card, PBI and list. Keep the engineering board lane until a subsequent explicit dispatch. In the register, distinguish an empty project from an empty phase filter.

### Data and native boundaries

Read project requests by PBI ID plus stage projection, blocker state, gate counts, run and revision through the shared request read model. Use fixtures for later workflow states until V18 lands. Use the same six overview categories (Entwurf, Klärungsbedarf, Übergabebereit, In der Factory, In Review, Abgenommen). Creation writes a single draft with stable ID, revision, PBI and scope. Guard repeated submission of the same command. From a PBI, recheck for an active request before creating. The register supports separate requests with intentionally distinct delivery scopes on the same PBI. Follow the shared [route registry](../../../../src/application/routes.ts) and shell navigation. Keep simulated Factory status isolated from the configured chat/MCP integrations.

### Red-first acceptance and handoff

- With `FR-024` linked to `UC-09` and a second eligible PBI, fail a native test first for contextual create, then verify a single active draft after repeated activation, links on both sides, and the original board lane after reload. Verify a register-created draft on a narrow board card.
- Verify exact stage counts, navigation into gate details and filtered return. Test an empty project, empty filter, unavailable PBI and identical IDs in another project. Keyboard focus should return to the result that opened the detail. Collapse table headings into labeled row metadata on narrow splits.
- Hand V18 the PBI/draft identifier and V09/V22 the shared status and backlink queries. Report route, tests and `npm run verify` exit code.

[Clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html) symbols include `requestsView`, `newRequest`, `deliveryRegister`, `deliveryStage`, `requestStage`. Compare [creation and board linkage](../../../concept/tests/test_board_requests.py), [delivery review](../../../concept/tests/test_delivery_review.py).
