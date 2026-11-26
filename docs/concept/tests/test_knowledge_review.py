"""Protect unfinished notes and test keyboard navigation through project records."""

import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class KnowledgeReviewTest(BrowserCase):
    start_route = "#/project/kundenportal/knowledge"

    def edit_research(self):
        self.main.get_by_role("button", name="Interview zur Wochenübergabe", exact=False).click()
        self.main.get_by_role("button", name="Notiz bearbeiten", exact=True).click()
        editor = self.main.get_by_role("textbox", name="Inhalt", exact=True)
        editor.fill("Noch nicht gespeicherte Beobachtung.")
        return editor

    def test_history_back_can_resume_or_discard_the_editor(self):
        editor = self.edit_research()
        self.page.go_back()
        expect(self.dialog.get_by_role("heading")).to_have_text("Ungespeicherte Änderungen")
        self.page.keyboard.press("Escape")
        expect(editor).to_be_focused()
        expect(editor).to_have_text("Noch nicht gespeicherte Beobachtung.")
        expect(self.page).to_have_url(self.url + "#/project/kundenportal/doc/RES-14")
        self.page.go_back()
        self.dialog.get_by_role("button", name="Änderungen verwerfen").click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Wissen")
        self.page.go_forward()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Interview zur Wochenübergabe")
        expect(self.main.get_by_text("Noch nicht gespeicherte Beobachtung.", exact=True)).to_have_count(0)

    def test_new_project_respects_an_unsaved_document(self):
        editor = self.edit_research()
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        self.dialog.get_by_role("button", name="Projekt anlegen").click()
        expect(self.dialog.get_by_role("heading")).to_have_text("Ungespeicherte Änderungen")
        keep = self.dialog.get_by_role("button", name="Weiter bearbeiten")
        expect(keep).to_be_focused()
        keep.click()
        expect(editor).to_be_focused()
        expect(editor).to_have_text("Noch nicht gespeicherte Beobachtung.")

    def test_search_finds_maps_and_prototypes_in_the_current_project(self):
        for identifier, title in (("SM-01", "Servicefälle verlässlich übergeben"), ("PT-03", "CSV-Export in der Fallübersicht")):
            self.page.keyboard.press("Control+k")
            self.dialog.get_by_role("searchbox").fill(identifier)
            self.dialog.get_by_role("button", name=title, exact=False).click()
            expect(self.main.get_by_role("heading", level=1)).to_have_text(title)
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        self.dialog.get_by_role("button", name="Admin Console").click()
        self.page.keyboard.press("Control+k")
        self.dialog.get_by_role("searchbox").fill("SM-01")
        expect(self.dialog.get_by_text("Keine Treffer.", exact=False)).to_be_visible()

    def test_escape_closes_a_populated_search_and_returns_focus(self):
        search = self.page.locator('#topbar [data-action="search"]')
        search.click()
        self.dialog.get_by_role("searchbox").fill("REQ-18")
        self.page.keyboard.press("Escape")
        expect(self.dialog).not_to_be_visible()
        expect(search).to_be_focused()

    def test_link_editor_keeps_an_unsupported_address_available_to_correct(self):
        self.edit_research()
        self.main.get_by_role("button", name="Link", exact=True).click()
        field = self.dialog.get_by_role("textbox", name="URL")
        field.fill("mailto:team@example.org")
        self.dialog.get_by_role("button", name="Link einfügen", exact=True).click()
        expect(field).to_be_focused()
        expect(field).to_have_attribute("aria-invalid", "true")
        expect(self.dialog.get_by_role("alert")).to_contain_text("https://")
        field.fill("https://example.org/fundstelle")
        self.dialog.get_by_role("button", name="Link einfügen", exact=True).click()
        expect(self.dialog).not_to_be_visible()
        expect(self.main.locator('[data-rich-editor] a')).to_have_attribute("href", "https://example.org/fundstelle")

    def test_direct_sources_appear_once_in_document_relations(self):
        self.main.get_by_role("button", name="Servicefälle übergeben", exact=False).click()
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        expect(self.main.locator('article [data-action="open-doc"][data-id="JOB-12"]')).to_have_count(1)
        expect(self.main.locator('article [data-action="open-doc"][data-id="RES-14"]')).to_be_visible()


if __name__ == "__main__":
    unittest.main()
