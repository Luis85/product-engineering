import base64
from pathlib import Path
from playwright.sync_api import expect
from browser_case import BrowserCase


class VaultReferenceTest(BrowserCase):
    start_route = "#/project/kundenportal/doc/VIS-01"

    def choose_project_note(self):
        picker = self.page.get_by_role("dialog", name="Vault-Verweis auswählen")
        picker.get_by_role("button", name="JOB-12.md", exact=True).click()
        picker.get_by_role("button", name="Verweis einfügen", exact=True).click()

    def test_insert_at_existing_editor_selection_and_save_native_markdown(self):
        self.main.get_by_role("button", name="Notiz bearbeiten").click()
        editor = self.main.get_by_role("textbox", name="Inhalt", exact=True)
        editor.fill("Vorher Nachher")
        editor.press("Home")
        for _ in range(len("Vorher ")):
            editor.press("ArrowRight")
        insert = self.main.get_by_role("button", name="Vault-Verweis", exact=True)
        self.assertEqual(insert.count(),1,"The editor must offer the vault file picker at the caret")
        insert.click()
        self.choose_project_note()
        expect(editor).to_contain_text("Vorher [[JOB-12.md]]Nachher")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        self.page.reload()
        with self.page.expect_download() as download:
            self.open_note_actions()
            self.main.get_by_role("button", name="Notiz exportieren").click()
        self.assertIn("Vorher [[JOB-12.md]]Nachher", Path(download.value.path()).read_text("utf-8"))
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        section=self.main.get_by_role("region",name="Vault-Verweise")
        section.get_by_role("button",name="Offene Fälle verlässlich übergeben",exact=True).click()
        expect(self.main.get_by_role("heading",level=1)).to_have_text("Offene Fälle verlässlich übergeben")

    def test_picked_references_survive_reload_and_deduplicate(self):
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        section=self.main.get_by_role("region",name="Vault-Verweise")
        self.assertEqual(section.count(),1,"The relations tab must expose vault content")
        for _ in range(2):
            section.get_by_role("button",name="Verweis hinzufügen",exact=True).click()
            self.choose_project_note()
        self.page.reload()
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        expect(section.get_by_role("button",name="Offene Fälle verlässlich übergeben",exact=True)).to_have_count(1)
        with self.page.expect_download() as download:
            self.open_note_actions()
            self.main.get_by_role("button",name="Notiz exportieren").click()
        self.assertEqual(Path(download.value.path()).read_text("utf-8").count("[[JOB-12.md]]"),1)
        section.get_by_role("button",name="Verweis auf JOB-12.md entfernen",exact=True).click()
        expect(section.get_by_role("button",name="Offene Fälle verlässlich übergeben",exact=True)).to_have_count(0)

    def test_selected_image_is_embedded_in_the_saved_note_and_resolved_after_reload(self):
        self.main.get_by_role("button", name="Notiz bearbeiten").click()
        editor = self.main.get_by_role("textbox", name="Inhalt", exact=True)
        editor.fill("Beobachtung: ")
        editor.press("End")
        insert = self.main.get_by_role("button", name="Vault-Verweis", exact=True)
        self.assertEqual(insert.count(), 1, "An image embed must be insertable from the note editor")
        insert.click()
        picker = self.page.get_by_role("dialog", name="Vault-Verweis auswählen")
        image = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c8X8AAAAASUVORK5CYII=")
        picker.locator("#vault-files").set_input_files({"name":"Befund.png","mimeType":"image/png","buffer":image})
        picker.get_by_role("button", name="Befund.png", exact=True).click()
        picker.get_by_role("button", name="Bild einbetten", exact=True).click()
        expect(editor).to_contain_text("![[Befund.png]]")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        self.page.reload()
        img = self.main.locator('img[data-vault-image="Befund.png"]')
        expect(img).to_be_visible()
        self.page.wait_for_function('''() => document.querySelector('img[data-vault-image="Befund.png"]')?.naturalWidth === 1''')
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        expect(self.main.get_by_role("region",name="Vault-Verweise")).to_contain_text("Befund.png")
