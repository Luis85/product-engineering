"""Direct NFR assignments across project maps and backlog item types."""

import re
import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class NfrLinksTest(BrowserCase):
    start_route = "#/project/kundenportal/backlog/nfrs"
    requirement = "Berechtigung an jedem Einstieg prüfen"
    acceptance = "Alle 12 Testfälle mit fremder Organisation werden abgewiesen."

    def create_requirement(self):
        self.main.get_by_role("button", name="NFR anlegen", exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill(self.requirement)
        self.dialog.get_by_label("Anforderung", exact=True).fill("Jeder Einstieg prüft die aktuelle Organisation.")
        self.dialog.get_by_label("Messbares Abnahmekriterium").fill(self.acceptance)

    def choose_targets(self):
        section = self.dialog.get_by_role("group", name="Gilt für", exact=True)
        self.assertEqual(section.count(), 1, "An NFR must expose its direct project targets")
        section.get_by_text("Zuordnungen auswählen", exact=True).click()
        return section

    def test_all_backlog_types_and_whole_map_are_navigable_in_both_directions(self):
        self.page.goto(self.url + "#/project/kundenportal/usecase/UC-09")
        self.main.get_by_role("button", name="Begleititems", exact=True).click()
        self.main.get_by_role("button", name="Frage erfassen", exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill("Welcher Einstieg gilt?")
        self.dialog.locator('button[type="submit"]').click()
        self.page.goto(self.url + self.start_route)
        self.create_requirement()
        targets = self.choose_targets()
        ids = ["EP-01", "FE-01", "UC-09", "TASK-01", "ISS-01", "BUG-01", "Q-01", "SM-01"]
        for item_id in ids:
            targets.get_by_role("checkbox", name=re.compile(re.escape(item_id) + r"\b")).check()
        self.dialog.get_by_role("button", name="NFR speichern").click()

        for item_id in ids:
            with self.subTest(target=item_id):
                self.page.goto(self.url + self.start_route)
                self.page.reload()
                self.main.get_by_role("button", name=self.requirement, exact=True).click()
                kind = "map" if item_id.startswith("SM") else "item"
                self.dialog.locator(f'[data-action="nfr-open-target"][data-id="{kind}:{item_id}"]').click()
                if kind == "map":
                    self.open_map_context("NFRs")
                related = self.page.locator(f'[data-nfr-source="{kind}:{item_id}"]:visible')
                expect(related.get_by_role("button", name=self.requirement, exact=True)).to_be_visible()
                related.get_by_role("button", name=self.requirement, exact=True).click()
                expect(self.dialog.get_by_label("Messbares Abnahmekriterium")).to_have_value(self.acceptance)

        self.page.goto(self.url + "#/project/admin-console/backlog/nfrs")
        expect(self.main.get_by_role("button", name=self.requirement, exact=True)).to_have_count(0)

    def test_assigning_from_a_dirty_source_editor_preserves_its_draft(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.create_requirement()
        self.dialog.get_by_role("button", name="NFR speichern").click()
        self.page.goto(self.url + "#/project/kundenportal/backlog/list")
        self.main.get_by_role("button", name="Servicefälle verwalten", exact=True).click()
        title = self.dialog.get_by_label("Titel", exact=True)
        title.fill("Bearbeiteter Feature-Titel")
        related = self.dialog.locator('[data-nfr-source="item:FE-01"]')
        self.assertEqual(related.count(), 1, "An existing backlog item must expose its NFR assignments")
        for commit in [False, True]:
            related.get_by_role("button", name="NFRs zuordnen", exact=True).click()
            child = self.page.get_by_role("dialog", name="NFRs zuordnen", exact=True)
            choice = child.get_by_role("checkbox", name=re.compile(self.requirement))
            expect(choice).not_to_be_checked()
            expect(child).to_contain_text(self.acceptance)
            choice.check()
            child.get_by_role("button", name="Zuordnung speichern" if commit else "Abbrechen", exact=True).click()
            expect(title).to_have_value("Bearbeiteter Feature-Titel")
        linked = related.get_by_role("button", name=self.requirement, exact=True)
        linked.click()
        self.page.get_by_role("dialog", name="Ungespeicherte Änderungen").get_by_role("button", name="Weiter bearbeiten").click()
        expect(title).to_have_value("Bearbeiteter Feature-Titel")
        self.dialog.get_by_role("button", name="Änderungen speichern", exact=True).click()
        self.page.reload()
        self.main.get_by_role("button", name="Bearbeiteter Feature-Titel", exact=True).click()
        related.get_by_role("button", name="NFRs zuordnen", exact=True).click()
        child = self.page.get_by_role("dialog", name="NFRs zuordnen", exact=True)
        child.get_by_role("checkbox", name=re.compile(self.requirement)).uncheck()
        child.get_by_role("button", name="Zuordnung speichern").click()
        expect(linked).to_have_count(0)

    def test_legacy_missing_target_stays_identifiable_and_can_be_removed(self):
        self.page.evaluate("""() => {
            const key='product-engineering-clickdummy-v1';
            const stored=JSON.parse(localStorage.getItem(key));
            const nfr=stored.projects.find(project=>project.id==='kundenportal').nfrs[0];
            nfr.targets=[{kind:'item',id:'FE-404'}];
            localStorage.setItem(key,JSON.stringify(stored));
        }""")
        self.page.reload()
        self.main.locator('[data-action="nfr-edit"]').first.click()
        targets = self.choose_targets()
        missing = targets.get_by_role("checkbox", name=re.compile("FE-404"))
        expect(missing).to_be_checked()
        targets.get_by_role("checkbox", name=re.compile("FE-01")).check()
        self.dialog.get_by_role("button", name="NFR speichern").click()
        expect(self.dialog).to_be_visible()
        missing.uncheck()
        self.dialog.get_by_role("button", name="NFR speichern").click()
        self.page.reload()
        self.main.locator('[data-action="nfr-edit"]').first.click()
        expect(self.dialog.locator('[data-action="nfr-open-target"][data-id="item:FE-01"]')).to_be_visible()
        expect(self.dialog.get_by_text(re.compile("FE-404"))).to_have_count(0)

    def test_pending_assignment_in_nfr_editor_is_cancelable_and_source_navigation_is_guarded(self):
        self.create_requirement()
        self.choose_targets().get_by_role("checkbox", name=re.compile("SM-01")).check()
        self.dialog.get_by_role("button", name="NFR speichern").click()
        self.main.get_by_role("button", name=self.requirement, exact=True).click()
        targets = self.choose_targets()
        targets.get_by_role("checkbox", name=re.compile("SM-01")).uncheck()
        self.dialog.get_by_role("button", name="Abbrechen", exact=True).click()
        self.main.get_by_role("button", name=self.requirement, exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill("Titelentwurf")
        self.dialog.locator('[data-action="nfr-open-target"][data-id="map:SM-01"]').click()
        guard = self.page.get_by_role("dialog", name="Ungespeicherte Änderungen")
        guard.get_by_role("button", name="Weiter bearbeiten").click()
        expect(self.dialog.get_by_label("Titel", exact=True)).to_have_value("Titelentwurf")
        self.dialog.locator('[data-action="nfr-open-target"][data-id="map:SM-01"]').click()
        guard.get_by_role("button", name="Verwerfen und öffnen", exact=True).click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Servicefälle verlässlich übergeben")
        self.open_map_context("NFRs")
        self.main.locator('[data-nfr-source="map:SM-01"]').get_by_role(
            "button", name=self.requirement, exact=True
        ).click()
        expect(self.dialog.get_by_label("Titel", exact=True)).to_have_value(self.requirement)


if __name__ == "__main__":
    unittest.main()
