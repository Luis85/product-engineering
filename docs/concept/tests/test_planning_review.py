"""Regression checks for editing, ranking and returning to related planning work."""

import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class PlanningReviewTest(BrowserCase):
    start_route = "#/project/kundenportal/backlog/list"

    def test_ranking_keeps_the_draft_until_save_and_cancel_leaves_the_tree_intact(self):
        row = self.main.locator('tr[data-backlog-id="FE-01"]')
        for save in [False, True]:
            row.get_by_role("button", name="Servicefälle verwalten", exact=True).click()
            self.dialog.get_by_label("Titel", exact=True).fill("Servicefälle einordnen")
            self.dialog.get_by_role("button", name="Tiefer", exact=True).click()
            expect(self.dialog).to_be_visible()
            self.assertEqual(self.dialog.get_by_label("Titel", exact=True).input_value(), "Servicefälle einordnen")
            self.dialog.get_by_role("button", name="Änderungen speichern" if save else "Abbrechen", exact=True).click()
            features = self.main.locator('tr[data-backlog-id^="FE-"]')
            self.assertEqual(features.first.get_attribute("data-backlog-id"), "FE-02" if save else "FE-01")
            expect(row).to_contain_text("Servicefälle einordnen" if save else "Servicefälle verwalten")

    def test_first_pbi_can_be_saved_with_its_prerequisites_or_cancelled_cleanly(self):
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        self.dialog.locator('[data-action="new-project"]').click()
        for label, value in [("Produktname", "Planung"), ("Kurzbeschreibung", "Planung testen"), ("Git-Repository", "team/planung")]:
            self.dialog.get_by_label(label).fill(value)
        self.dialog.get_by_role("button", name="Projekt anlegen", exact=True).click()
        self.page.get_by_role("navigation", name="Projektbereiche").get_by_role("button", name="Backlog", exact=True).click()
        self.main.get_by_role("button", name="Liste", exact=True).click()
        for save in [False, True]:
            self.main.get_by_role("button", name="Neuer Eintrag", exact=True).click()
            self.dialog.get_by_role("button", name="PBI anlegen", exact=True).click()
            self.assertEqual(self.dialog.get_by_label("Neues Epic", exact=True).count(), 1)
            self.dialog.get_by_label("Titel", exact=True).fill("Übergabe starten")
            self.dialog.get_by_label("Neues Epic", exact=True).fill("Schichtwechsel")
            self.dialog.get_by_label("Neues Feature", exact=True).fill("Übergaben")
            self.dialog.get_by_role("button", name="PBI anlegen" if save else "Abbrechen", exact=True).click()
            if not save:
                expect(self.main.locator("tr[data-backlog-id]")).to_have_count(0)
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Übergabe starten")
        self.page.get_by_role("navigation", name="Projektbereiche").get_by_role("button", name="Backlog", exact=True).click()
        self.main.get_by_role("button", name="Liste", exact=True).click()
        expect(self.main.locator("tr[data-backlog-id]")).to_have_count(3)

    def test_pbi_links_restore_the_selected_reading_tab(self):
        self.main.get_by_role("button", name="Gefilterte Servicefälle exportieren", exact=True).click()
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        sources = self.main.get_by_role("heading", name="Quellen", exact=True)
        expect(sources).to_be_visible()
        self.main.locator('[data-action="open-doc"][data-id="PRD-03"]').click()
        self.page.go_back()
        expect(sources).to_be_visible()
        self.page.reload()
        expect(self.main.get_by_role("button", name="Verknüpfungen", exact=True)).to_have_attribute("aria-pressed", "true")


if __name__ == "__main__":
    unittest.main()
