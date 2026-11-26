from playwright.sync_api import expect
from browser_case import BrowserCase


class NoteCommitActionsTest(BrowserCase):
    start_route = "#/project/kundenportal/doc/PRD-03"

    def test_note_actions_and_scope_do_not_compete_with_the_reading_surface(self):
        self.page.goto(self.url+"#/project/kundenportal/doc/ENT-01")
        self.assertEqual(self.main.locator('article.document [data-entity-scope="entity:ENT-01"]').count(),1,
                         "Scope belongs with the note, not in a separate strip above the card")
        expect(self.main.get_by_role("button",name="Notiz bearbeiten")).to_be_visible()
        actions=self.main.locator("summary").filter(has_text="Notizaktionen")
        actions.click()
        expect(self.main.get_by_role("button",name="Notiz exportieren")).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(actions).to_be_focused()

    def test_actions_menu_remains_in_view_on_a_small_phone(self):
        self.page.set_viewport_size({"width":320,"height":740})
        self.main.get_by_role("button",name="Notiz bearbeiten").click()
        self.main.locator("summary").filter(has_text="Notizaktionen").click()
        bounds=self.main.get_by_role("button",name="Notiz exportieren").bounding_box()
        self.assertGreaterEqual(bounds["x"],0)
        self.assertLessEqual(bounds["x"]+bounds["width"],320)

    def test_saved_changes_show_immediate_compare_and_commit_actions(self):
        self.main.get_by_role("button", name="Notiz bearbeiten").click()
        self.main.get_by_label("Titel",exact=True).fill("Übergabe bis Freitag")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        action=self.main.get_by_role("button",name="Commit erstellen",exact=True)
        self.assertEqual(action.count(),1,"A saved knowledge change must be committable on the reading screen")
        expect(self.main).to_contain_text("Commit ausstehend")
        self.main.get_by_role("button",name="Änderungen vergleichen",exact=True).click()
        expect(self.main.get_by_role("region",name="Versionsvergleich")).to_contain_text("Übergabe bis Freitag")
        self.main.get_by_role("button",name="Inhalt",exact=True).click()
        action.click()
        self.dialog.get_by_label("Commit-Nachricht").fill("Termin für die Übergabe präzisiert")
        self.dialog.get_by_role("button",name="Commit speichern").click()
        self.page.keyboard.press("Escape")
        expect(action).to_have_count(0)
        expect(self.main).not_to_contain_text("Commit ausstehend")

    def test_unsaved_buffer_can_be_saved_then_committed_without_losing_text(self):
        self.main.get_by_role("button",name="Notiz bearbeiten").click()
        self.main.get_by_role("textbox",name="Inhalt",exact=True).fill("Neue Abnahmeregel")
        save_then_commit=self.main.get_by_role("button",name="Speichern und committen",exact=True)
        self.assertEqual(save_then_commit.count(),1,"The editor should offer a direct saved-commit path")
        expect(self.main).to_contain_text("Ungespeicherte Änderungen")
        save_then_commit.click()
        expect(self.dialog.get_by_role("heading")).to_contain_text("Commit erstellen")
        self.dialog.get_by_role("button",name="Abbrechen").click()
        self.page.reload()
        expect(self.main.get_by_text("Neue Abnahmeregel",exact=True)).to_be_visible()
        expect(self.main.get_by_role("button",name="Commit erstellen",exact=True)).to_be_enabled()
