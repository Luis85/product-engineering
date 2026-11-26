from playwright.sync_api import expect
from browser_case import BrowserCase


class BacklogEditorTest(BrowserCase):
    start_route="#/project/kundenportal/backlog/list"

    def test_opening_history_cannot_discard_an_unsaved_description_by_accident(self):
        row=self.main.locator('[data-backlog-id="FE-03"]')
        row.locator('[data-action="backlog-edit"]').first.click()
        self.dialog.get_by_role("textbox",name="Titel",exact=True).fill("Geänderter Titel")
        self.dialog.get_by_role("button",name="Beschreibung bearbeiten").click()
        body=self.dialog.get_by_role("textbox",name="Beschreibung",exact=True)
        body.fill("## Ungespeicherter Abschnitt\n\nEine fachliche Ergänzung.")
        self.dialog.get_by_role("button",name="Git-Historie öffnen",exact=True).click()
        guard=self.page.get_by_role("dialog",name="Ungespeicherte Änderungen",exact=True)
        self.assertEqual(guard.count(),1,"Leaving an edited backlog record must protect the draft")
        self.page.keyboard.press("Escape")
        expect(self.dialog.get_by_role("textbox",name="Titel",exact=True)).to_have_value("Geänderter Titel")
        expect(body).to_have_value("## Ungespeicherter Abschnitt\n\nEine fachliche Ergänzung.")
        self.dialog.get_by_role("button",name="Git-Historie öffnen",exact=True).click()
        guard.get_by_role("button",name="Weiter bearbeiten",exact=True).click()
        expect(body).to_be_visible()
        self.dialog.get_by_role("button",name="Änderungen speichern",exact=True).click()
        row.get_by_role("button",name="Geänderter Titel",exact=True).click()
        expect(self.dialog.get_by_role("heading",name="Ungespeicherter Abschnitt")).to_be_visible()

    def test_epics_and_features_keep_one_readable_markdown_description(self):
        for kind in ("Epic","Feature"):
            with self.subTest(kind=kind):
                self.main.get_by_role("button",name="Neuer Eintrag",exact=True).click()
                self.dialog.get_by_role("button",name=kind+" anlegen",exact=True).click()
                body=self.dialog.get_by_role("textbox",name="Beschreibung",exact=True)
                self.assertEqual(body.count(),1,"Groups need optional Markdown content when created")
                title=kind+" im Schichtbuch"
                self.dialog.get_by_role("textbox",name="Titel",exact=True).fill(title)
                body.fill("## Hintergrund\n\nDiese **Schicht** ist zuständig.")
                self.dialog.locator('button[type="submit"]').click()
                self.main.get_by_role("button",name=title,exact=True).click()
                read=self.dialog.get_by_role("region",name="Beschreibung",exact=True)
                expect(read.get_by_role("heading",name="Hintergrund",exact=True)).to_be_visible()
                expect(read.locator("strong",has_text="Schicht")).to_be_visible()
                read.get_by_role("button",name="Beschreibung bearbeiten",exact=True).click()
                self.dialog.get_by_role("textbox",name="Beschreibung",exact=True).fill("Geänderter Inhalt")
                self.dialog.get_by_role("button",name="Abbrechen",exact=True).click()
                self.main.get_by_role("button",name=title,exact=True).click()
                expect(read.get_by_role("heading",name="Hintergrund",exact=True)).to_be_visible()
                read.get_by_role("button",name="Beschreibung bearbeiten",exact=True).click()
                self.dialog.get_by_role("textbox",name="Beschreibung",exact=True).fill("## Neuer Abschnitt\n\nErste Schicht.")
                self.dialog.get_by_role("button",name="Änderungen speichern").click()
                self.page.reload();self.main.get_by_role("button",name=title,exact=True).click()
                expect(read.get_by_role("heading",name="Neuer Abschnitt",exact=True)).to_be_visible()
                self.dialog.get_by_role("button",name="Git-Historie öffnen",exact=True).click()
                expect(self.dialog.locator(".diff-add").filter(has_text="Neuer Abschnitt")).to_be_visible()
                self.page.keyboard.press("Escape")

    def test_feature_status_can_be_changed_without_a_rank_dropdown(self):
        row=self.main.locator('[data-backlog-id="FE-01"]')
        row.get_by_role("button",name="Servicefälle verwalten",exact=True).click()
        status=self.dialog.get_by_role("combobox",name="Status",exact=True)
        self.assertEqual(status.count(),1,"The Feature editor needs a Status field")
        self.assertEqual(self.dialog.get_by_role("combobox",name="Rang nach dem Speichern").count(),0)
        expect(status).to_have_value("")
        status.select_option(label="Review")
        self.dialog.get_by_role("button",name="Abbrechen").click()
        row.get_by_role("button",name="Servicefälle verwalten",exact=True).click()
        expect(status).to_have_value("")
        status.select_option(label="In Progress")
        self.dialog.get_by_role("button",name="Änderungen speichern").click()
        self.page.reload()
        row.get_by_role("button",name="Servicefälle verwalten",exact=True).click()
        self.assertEqual(status.locator("option:checked").inner_text(),"In Progress")
        self.assertGreater(self.dialog.bounding_box()["width"],700)
        self.page.set_viewport_size({"width":320,"height":650})
        self.assertLessEqual(self.dialog.evaluate("x=>x.scrollWidth"),self.dialog.evaluate("x=>x.clientWidth")+1)

    def test_pbi_status_editor_writes_the_same_board_stage_and_preserves_rank(self):
        row=self.main.locator('[data-backlog-id="UC-09"]')
        row.locator('[data-action="backlog-edit"]').first.click()
        status=self.dialog.get_by_role("combobox",name="Status",exact=True)
        self.assertEqual(status.count(),1)
        expect(status.locator("option:checked")).to_have_text("In Development")
        status.select_option(label="Review")
        self.dialog.get_by_role("button",name="Änderungen speichern").click()
        self.main.get_by_role("button",name="Board",exact=True).click()
        expect(self.main.get_by_role("region",name="Review",exact=True).locator('[data-board-card="UC-09"]')).to_be_visible()
