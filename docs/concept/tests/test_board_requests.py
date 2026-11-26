
"""Board-to-request handoff, explicit stages, and historical request visibility."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class BoardRequests(BrowserCase):
    start_route = "#/project/kundenportal/backlog/board"

    def card(self, id):
        return self.main.locator(f'[data-board-card="{id}"]')

    def visit(self, path):
        self.page.goto(self.url + "#/project/kundenportal/" + path)

    def test_ready_pbi_opens_preselected_draft_and_returns_to_its_filtered_board(self):
        self.main.get_by_label("Backlog durchsuchen").fill("UC-14")
        card = self.card("UC-14")
        before = card.locator("xpath=ancestor::section[1]").get_attribute("data-board-stage")
        expect(card).to_contain_text("Bereit für den Request-Entwurf")
        card.get_by_role("button", name="Feature Request erstellen", exact=True).click()
        expect(self.dialog.locator('[name="uc"]')).to_have_value("UC-14")
        expect(self.dialog.get_by_label("Lieferumfang")).to_have_value("Gesamter Use-Case")
        self.dialog.get_by_label("Auftragstitel").fill("Filter ausliefern")
        self.dialog.get_by_role("button", name="Paketentwurf erstellen").click()
        self.page.reload()
        self.main.get_by_role("button", name="Zurück zum Board", exact=True).click()
        expect(self.main.get_by_label("Backlog durchsuchen")).to_have_value("UC-14")
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("data-board-stage",before)
        expect(card).to_contain_text("Entwurf")
        expect(card.get_by_role("button", name="FR-025 · Filter ausliefern")).to_be_visible()
        expect(card.get_by_role("button", name="Feature Request erstellen", exact=True)).to_have_count(0)
        card.get_by_role("button", name="FR-025 · Filter ausliefern").click()
        expect(self.main.get_by_role("heading", name="Filter ausliefern")).to_be_visible()

    def test_blocked_pbi_and_uncommitted_sources_offer_the_relevant_preparation(self):
        card=self.card("UC-12")
        expect(card).to_contain_text("PRD-Anforderung verknüpfen")
        card.get_by_role("button", name="PBI vorbereiten",exact=True).click()
        expect(self.main.get_by_role("heading",name="Leere Trefferliste erklären")).to_be_visible()
        self.main.get_by_role("button",name="Zurück zum Board",exact=True).click()
        self.page.evaluate("() => {getUseCase('UC-14').body+=' Vermerk für die Übergabe';persist();render()}")
        ready=self.card("UC-14")
        expect(ready).to_contain_text("Commit")
        ready.get_by_role("button",name="Git-Stand prüfen").click()
        expect(self.dialog).to_contain_text("UC-14")

    def test_list_and_pbi_expose_active_and_completed_requests_without_duplicates(self):
        self.page.evaluate("""() => {
          const original=getRequest('FR-024');
          project().requests.push({...copy(original),id:'FR-030',status:'Abgenommen',title:'Abgenommene Teilmenge'});
          persist();render();
        }""")
        card=self.card("UC-09")
        expect(card.get_by_role("button",name="FR-024 · CSV-Export · Servicefälle")).to_be_visible()
        card.locator("summary").filter(has_text="Weitere Requests").click()
        expect(card.get_by_role("button",name="FR-030 · Abgenommene Teilmenge")).to_be_visible()
        self.main.get_by_role("button",name="Liste",exact=True).click()
        row=self.main.locator('[data-backlog-id="UC-09"]')
        expect(row.get_by_role("button",name="FR-024 · CSV-Export · Servicefälle")).to_be_visible()
        row.locator("summary").filter(has_text="Weitere Requests").click()
        expect(row.get_by_role("button",name="FR-030 · Abgenommene Teilmenge")).to_be_visible()
        row.get_by_role("button",name="Gefilterte Servicefälle exportieren",exact=True).click()
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        expect(self.main.get_by_role("button",name="FR-030 · Abgenommene Teilmenge")).to_be_visible()
        expect(self.main.get_by_role("button",name="Feature Request erstellen",exact=True)).to_have_count(0)

    def test_actual_dispatch_sets_development_but_review_completion_never_sets_done(self):
        card=self.card("UC-14")
        card.get_by_role("button",name="Feature Request erstellen",exact=True).click()
        self.dialog.get_by_role("button",name="Paketentwurf erstellen").click()
        self.main.locator('[data-action="release-request"]').click()
        self.assertEqual(self.page.evaluate("getUseCase('UC-14').status"),"Erledigt")
        self.main.locator('[data-action="dispatch"]').click()
        self.assertEqual(self.page.evaluate("getUseCase('UC-14').status"),"In Development")
        self.main.locator('[data-action="simulate-worker"]').click()
        self.main.locator('[data-action="simulate-success"]').click()
        self.visit("backlog/board")
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","In Development")
        expect(card).to_contain_text("In Review")
        self.visit("review/FR-025")
        for check in self.main.locator('[data-change="review-check"]').all(): check.check()
        self.main.locator('[data-action="approve-review"]').click()
        self.visit("backlog/board")
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","In Development")
        expect(card).to_contain_text("Abgenommen")
        card.get_by_role("combobox").select_option(label="Done")
        self.page.reload()
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","Done")

    def test_old_active_run_projects_without_rewriting_pbi_and_manual_override_survives(self):
        card=self.card("UC-09")
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","In Development")
        self.assertEqual(self.page.evaluate("getUseCase('UC-09').status"),"In Arbeit")
        self.page.evaluate("() => {delete getRequest('FR-024').run;persist();render()}")
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","In Development")
        card.get_by_role("combobox").select_option(label="In Progress")
        self.page.reload()
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","In Progress")
        expect(card.get_by_role("button",name="FR-024 · CSV-Export · Servicefälle")).to_be_visible()


    def test_request_created_from_the_request_register_appears_on_its_mobile_card(self):
        self.visit("requests")
        self.main.get_by_role("button",name="Feature Request erstellen",exact=True).click()
        self.dialog.locator('[name="uc"]').select_option("UC-12")
        self.dialog.get_by_label("Auftragstitel").fill("Leere Ergebnisliste prüfen")
        self.dialog.get_by_role("button",name="Paketentwurf erstellen").click()
        self.visit("backlog/board")
        self.page.set_viewport_size({"width":320,"height":700})
        self.page.reload()
        card=self.card("UC-12")
        expect(card.get_by_role("button",name="FR-025 · Leere Ergebnisliste prüfen")).to_be_visible()
        expect(card).to_contain_text("Entwurf")
        expect(card.locator("xpath=ancestor::section[1]")).to_have_attribute("aria-label","Open")
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))

