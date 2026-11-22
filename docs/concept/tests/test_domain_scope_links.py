"""Two-way product-scope links on entity notes, PRDs, Story Maps and backlog items."""

import re

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class DomainScopeLinksTest(BrowserCase):
    start_route = "#/project/kundenportal/domainmodel/ENT-01"

    def region(self, key):
        if key.startswith("map:"):
            self.open_map_context("Entitäten")
        return self.page.locator(f'[data-entity-scope="{key}"]:visible')

    def picker(self, key):
        section = self.region(key)
        self.assertEqual(section.count(), 1, f"Missing direct entity scope section on {key}")
        section.locator('[data-action="entity-scope-edit"]').click()
        return self.page.locator("#entity-scope-picker")

    def test_entity_diagram_and_note_link_both_ways_to_every_target_type(self):
        self.page.goto(self.url + "#/project/kundenportal/usecase/UC-09")
        self.main.get_by_role("button", name="Begleititems", exact=True).click()
        self.main.get_by_role("button", name="Frage erfassen", exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill("Wann wird der Fall geschlossen?")
        self.dialog.locator('button[type="submit"]').click()
        self.page.goto(self.url + self.start_route)
        keys = ["prd:PRD-03", "map:SM-01", "item:EP-01", "item:FE-01", "item:UC-09",
                "item:TASK-01", "item:ISS-01", "item:BUG-01", "item:Q-01"]
        picker = self.picker("entity:ENT-01")
        for key in keys:
            picker.locator(f'input[value="{key}"]').check()
        picker.get_by_role("button", name="Zuordnung speichern").click()
        expect(self.region("entity:ENT-01").locator('[data-action="entity-scope-edit"]')).to_be_focused()

        for key in keys:
            with self.subTest(target=key):
                self.main.get_by_role("button", name="Notiz öffnen", exact=True).click()
                note = self.region("entity:ENT-01")
                note.locator(f'[data-action="entity-scope-open"][data-id="{key}"]').click()
                other_side = self.region(key)
                reverse = other_side.get_by_role("button", name="Organisation", exact=True)
                expect(reverse).to_have_count(1)
                reverse.click()
                expect(self.main.get_by_role("heading", level=1)).to_have_text("Domainmodel")
                expect(self.region("entity:ENT-01")).to_be_visible()
        self.page.reload()
        expect(self.region("entity:ENT-01").locator('[data-action="entity-scope-open"][data-id="prd:PRD-03"]')).to_be_visible()
        self.page.goto(self.url + "#/project/admin-console/backlog/list")
        expect(self.main.get_by_role("button", name="Organisation", exact=True)).to_have_count(0)

    def test_target_picker_and_cross_record_navigation_preserve_pending_source_edits(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.goto(self.url + "#/project/kundenportal/backlog/list")
        self.main.get_by_role("button", name="Servicefälle verwalten", exact=True).click()
        title = self.dialog.get_by_label("Titel", exact=True)
        title.fill("Diesen Feature-Titel behalten")
        section = self.region("item:FE-01")
        picker = self.picker("item:FE-01")
        choice = picker.get_by_role("checkbox", name=re.compile("ENT-03"))
        before = choice.is_checked()
        choice.set_checked(not before)
        picker.get_by_role("button", name="Abbrechen").click()
        expect(title).to_have_value("Diesen Feature-Titel behalten")
        self.picker("item:FE-01")
        self.assertEqual(choice.is_checked(), before)
        choice.check()
        picker.get_by_role("button", name="Zuordnung speichern").click()
        expect(title).to_have_value("Diesen Feature-Titel behalten")
        linked = section.get_by_role("button", name="Übergabe", exact=True)
        linked.click()
        self.page.get_by_role("dialog", name="Ungespeicherte Änderungen").get_by_role(
            "button", name="Weiter bearbeiten"
        ).click()
        expect(title).to_have_value("Diesen Feature-Titel behalten")
        self.dialog.get_by_role("button", name="Änderungen speichern", exact=True).click()
        self.main.get_by_role("button", name="Diesen Feature-Titel behalten", exact=True).click()
        self.picker("item:FE-01")
        choice.uncheck()
        picker.get_by_role("button", name="Zuordnung speichern").click()
        expect(linked).to_have_count(0)

    def test_archived_entity_is_identifiable_but_cannot_be_newly_assigned(self):
        # Old vault notes can already reference an entity that was removed from the active diagram.
        self.page.evaluate("""() => {
            const key='product-engineering-clickdummy-v1', data=JSON.parse(localStorage.getItem(key));
            const p=data.projects.find(project=>project.id==='kundenportal');
            const entity=p.docs.find(doc=>doc.id==='ENT-01');
            entity.domainArchived=true;
            entity.domainTargets=[{kind:'prd',id:'PRD-03'}];
            localStorage.setItem(key,JSON.stringify(data));
        }""")
        self.page.goto(self.url + "#/project/kundenportal/doc/PRD-03")
        self.page.reload()
        side = self.region("prd:PRD-03")
        expect(side).to_contain_text("Archiviert")
        side.get_by_role("button", name="Organisation", exact=True).click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Organisation")
        picker = self.picker("entity:ENT-01")
        expect(picker.get_by_role("checkbox")).to_have_count(1)
        picker.get_by_role("checkbox").uncheck()
        picker.get_by_role("button", name="Zuordnung speichern").click()
        self.page.goto(self.url + "#/project/kundenportal/doc/PRD-03")
        self.picker("prd:PRD-03")
        expect(self.page.locator('#entity-scope-picker input[value="entity:ENT-01"]')).to_have_count(0)

    def test_editing_entity_definition_and_assignments_can_be_saved_in_the_same_visit(self):
        self.main.get_by_role("button", name="Entität bearbeiten", exact=True).click()
        name = self.dialog.get_by_label("Bezeichnung", exact=True)
        name.fill("Organisationseinheit")
        section = self.dialog.locator('[data-entity-scope="entity:ENT-01"]')
        self.assertEqual(section.count(), 1, "An open entity editor should keep its fields when choosing scope")
        section.get_by_role("button", name="Produktumfang zuordnen").click()
        picker = self.page.locator("#entity-scope-picker")
        expect(picker.get_by_text("Zugehörige PRDs, Story Maps und Backlog-Einträge")).to_be_focused()
        picker.locator('input[value="map:SM-01"]').check()
        picker.get_by_role("button", name="Zuordnung speichern").click()
        expect(name).to_have_value("Organisationseinheit")
        self.dialog.get_by_role("button", name="Änderungen speichern").click()
        expect(self.dialog).not_to_be_visible()
        self.page.reload()
        expect(self.main.locator(".domain-inspect h2")).to_have_text("Organisationseinheit")
        expect(self.region("entity:ENT-01").locator('[data-id="map:SM-01"]')).to_be_visible()

    def change_map_assignment(self):
        picker = self.picker("entity:ENT-01")
        target = picker.locator('input[value="map:SM-01"]')
        target.set_checked(not target.is_checked())
        picker.get_by_role("button", name="Zuordnung speichern").click()

    def open_approved_entity_note(self):
        self.main.get_by_role("button", name="Notiz öffnen", exact=True).click()
        approve = self.main.get_by_role("button", name="Fachlich freigeben", exact=True)
        if approve.count():
            approve.click()
        expect(self.main.locator(".artifact-meta")).to_contain_text("Freigegeben")

    def test_changing_an_approved_note_scope_updates_working_tree_and_approval_immediately(self):
        self.open_approved_entity_note()
        self.main.get_by_role("button", name="Git History", exact=True).click()
        commit = self.main.get_by_role("button", name="Commit erstellen", exact=True)
        if commit.is_enabled():
            commit.click()
            self.dialog.get_by_role("button", name="Commit speichern").click()
            self.page.keyboard.press("Escape")
        expect(commit).to_be_disabled()
        self.change_map_assignment()
        expect(self.main.locator(".artifact-meta")).to_contain_text("Entwurf")
        expect(commit).to_be_enabled()
        expect(self.main.get_by_role("region", name="Versionsvergleich")).to_contain_text("pe-produktbezug")

    def test_scope_save_refreshes_approval_without_losing_an_unsaved_entity_note(self):
        self.open_approved_entity_note()
        self.main.get_by_role("button", name="Notiz bearbeiten", exact=True).click()
        title = self.main.get_by_role("textbox", name="Titel", exact=True)
        title.fill("Noch nicht gespeicherter Name")
        self.change_map_assignment()
        expect(title).to_have_value("Noch nicht gespeicherter Name")
        expect(self.main.get_by_role("button", name="Fachlich freigeben", exact=True)).to_be_visible()
        expect(self.main.locator(".artifact-meta")).to_contain_text("Entwurf")

    def test_background_brief_is_marked_stale_without_restarting_its_preview(self):
        self.enable_demo_ai()
        self.page.goto(self.url + "#/project/kundenportal/prototypes")
        self.main.get_by_role("button", name="Prototyp anlegen", exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill("Feature im Kontext")
        self.dialog.get_by_role("combobox", name="Umfang", exact=True).select_option("item:FE-01")
        self.dialog.get_by_role("textbox", name="Beschreibung", exact=True).fill("Offene Servicefälle prüfen.")
        self.dialog.get_by_role("button", name="Briefing speichern", exact=True).click()
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        self.main.get_by_text("Briefing", exact=True).click()
        frame = self.main.frame_locator("iframe")
        action = frame.locator(".choice").first
        action.click()
        expect(action).to_have_attribute("aria-expanded", "true")
        self.main.locator('.agent-brief [data-action="backlog-edit"][data-id="FE-01"]').click()
        picker = self.picker("item:FE-01")
        choice = picker.locator('input[value="entity:ENT-01"]')
        choice.set_checked(not choice.is_checked())
        picker.get_by_role("button", name="Zuordnung speichern").click()
        expect(self.dialog).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(self.main.locator(".agent-status")).to_contain_text("Briefing geändert")
        expect(action).to_have_attribute("aria-expanded", "true")
