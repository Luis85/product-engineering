# V06 · Domainmodel

**Entry and dependencies.** Open `#/project/{project}/domainmodel` directly below **Wissen**. An entity or relationship ID after the route selects it. Use V01–V05 for project identity, notes, editing, vault links, revision handling and navigation. Use the completed [shell blueprint](../../obsidian-plugin-shell-blueprint/README.md) and [product contracts](../contracts.md).

## What the user can do

- Choose **Entität anlegen**, name and describe a business concept, add named attributes with descriptions, and open the same note in Wissen. Editing the note updates the diagram. Selecting a relationship explains both endpoints, its verb, direction, cardinalities and optional description. Show an empty state when the project has no active entities.
- Use **Beziehung anlegen** to select the source, target, verb and both cardinalities. Offer `1`, `0..1`, `1..*` and `0..*`, and explain them in words for the selected endpoints. Keep parallel edges, reciprocal edges and loops individually selectable. Provide a keyboard-accessible relationship list and selection inspector alongside the diagram.
- Zoom around the pointer with the plain mouse wheel. Provide bounded zoom buttons, **Originalgröße** and **Einpassen**. Drag or touch the background to pan. With keyboard focus on the canvas, arrows pan. On a node, arrows move it. Offer single-click move controls. Keep movement in model coordinates at all zoom levels. Limit gesture capture to the canvas and retain the camera when selection changes.

## Vault and integration

Each entity is one typed project note with a stable `ENT` ID, readable definition and attributes. Keep outgoing relationships on the source entity. Derive incoming edges from the index. Preserve each `REL` ID on edits and source changes, and avoid reusing deleted IDs. Reject duplicate source–verb–target combinations, missing endpoints and stale writes. Archive after confirmation, retain the note and relationships, and allow restoration from Wissen. Existing links identify archived entities. Exclude them from new assignments and brief generation. Store camera and layout separately from semantic revisions so moving the viewport cannot dirty a note.

An entity owns its direct typed scope links to PRDs, backlog items and maps. Enable editing from either end with one write model, including PRDs via V04, items in V07/V08 and maps in V13. Expose matched entities and their incident relationships with endpoint IDs, titles, cardinalities, descriptions and source provenance. Limit expansion to immediate neighbors. V15–V18 consume this for prototype briefs and feature requests, retaining the appropriate draft or released revision.

## Red-first acceptance

Write and run failing native tests for edge round-trip, archive/restore, pointer anchoring and independent project cameras before implementing each behavior. Exercise external note rename, selection deep link, stale endpoint, repeated assignment, parallel edges and unrelated scope in the native application layer. In an Obsidian leaf, create two entities, relate them, open the source note, reload, zoom and pan with mouse and touch, and confirm edge identity. Run `npm run verify` and record its exit code.

**Reference.** Find `domainView`, `domainCanvas`, `domainFormSubmit`, `domainForScope` and `entityScopeSection` in the [clickdummy](../../../concept/Product-Engineering-Clickdummy-Story-Maps.html). Port cases from [view](../../../concept/tests/test_domain_view.py), [canvas](../../../concept/tests/test_domain_canvas.py), [camera](../../../concept/tests/test_domain_camera.py), [editing](../../../concept/tests/test_domain_editing.py), [note identity](../../../concept/tests/test_domain_notes.py), [scope](../../../concept/tests/test_domain_scope.py) and [bidirectional links](../../../concept/tests/test_domain_scope_links.py).
