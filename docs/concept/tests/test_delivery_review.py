
"""Decision provenance, scope clarity and recoverable administration errors."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class DeliveryReview(BrowserCase):
    def visit(self, route):
        self.page.goto(self.url + "#/project/kundenportal/" + route)

    def test_trace_follows_only_the_selected_pbis_sources(self):
        self.visit("trace")
        expect(self.main.get_by_role("button", name="Produktvision Kundenportal")).to_be_visible()
        card = self.main.locator('[data-action="sm-focus"][data-id="SM-01:CARD-03"]')
        expect(card.locator("..")).to_contain_text("Erster nutzbarer Ablauf")
        card.click()
        expect(self.page.locator("#story-card-CARD-03")).to_be_focused()
        self.visit("trace")
        self.page.locator("#trace-select").select_option("UC-12")
        expect(self.main.locator('[data-id="VIS-01"]')).to_have_count(0)
        expect(self.main.locator('[data-id="SM-01:CARD-04"]')).to_be_visible()
        expect(self.page.locator("#trace-select")).to_be_focused()

    def test_frozen_document_shows_package_text_and_links_to_current_work(self):
        self.visit("doc/PRD-03")
        self.main.get_by_role("button", name="Bearbeiten", exact=True).click()
        self.main.locator("[data-rich-editor]").fill("Aktueller Text nach der Paketfreigabe.")
        self.main.get_by_role("button", name="Änderungen speichern", exact=True).click()
        self.visit("request/FR-024")
        source = self.main.locator("details").filter(
            has=self.page.locator("summary", has_text="PRD-03")
        )
        expect(source).to_have_count(1)
        source.locator("summary").click()
        expect(source).to_contain_text("innerhalb von drei Minuten")
        expect(source).not_to_contain_text("Aktueller Text nach der Paketfreigabe.")
        source.get_by_role("button", name="Arbeitsstand öffnen").click()
        expect(self.main).to_contain_text("Aktueller Text nach der Paketfreigabe.")

    def test_requested_change_names_review_revision_and_propagates_to_trace(self):
        self.visit("review/FR-024")
        self.main.get_by_role("button", name="Änderung anfragen", exact=True).click()
        for value in ["FR-024", "Revision 2", "e3b7c21"]:
            expect(self.dialog).to_contain_text(value)
        self.dialog.get_by_label("Befund und erwartetes Ergebnis").fill("Export für eine zweite Organisation ausschließen.")
        self.dialog.get_by_role("button", name="Änderung dokumentieren").click()
        expect(self.main).to_contain_text("Änderung angefragt")
        self.visit("trace")
        expect(self.main.get_by_role("button", name="Fachliche Änderung angefragt")).to_be_visible()

    def test_worker_question_carries_scope_of_the_actual_request(self):
        self.visit("requests")
        self.main.get_by_role("button", name="Feature Request erstellen").click()
        self.dialog.locator('[name="uc"]').select_option("UC-14")
        self.dialog.get_by_label("Auftragstitel").fill("Statusauswahl am PBI")
        self.dialog.get_by_label("Lieferumfang").fill("Statusfilter für abgeschlossene Fälle")
        self.dialog.locator('button[type="submit"]').click()
        for action in ("release-request", "dispatch", "simulate-worker", "simulate-question"):
            self.main.locator(f'[data-action="{action}"]').click()
        expect(self.main).to_contain_text("Statusfilter für abgeschlossene Fälle")
        expect(self.main).not_to_contain_text("zum Export ohne Treffer")
        self.main.get_by_role("button", name="Rückfrage beantworten").click()
        expect(self.dialog).to_contain_text("FR-025")
        expect(self.dialog).to_contain_text("Statusfilter für abgeschlossene Fälle")

    def test_duplicate_team_assignment_can_be_corrected_in_the_dialog(self):
        self.visit("settings")
        self.main.get_by_role("button", name="Team", exact=True).click()
        self.main.get_by_role("button", name="Mitglied hinzufügen").click()
        name = self.dialog.get_by_label("Name", exact=True)
        name.fill("Mara König")
        self.dialog.locator('[name="role"]').select_option("Product Owner")
        self.dialog.locator('button[type="submit"]').click()
        expect(self.dialog.get_by_role("alert")).to_contain_text("bereits")
        expect(name).to_be_focused()
        name.fill("Mara Klein")
        self.dialog.locator('button[type="submit"]').click()
        expect(self.main.get_by_role("row").filter(has_text="Mara Klein")).to_be_visible()

