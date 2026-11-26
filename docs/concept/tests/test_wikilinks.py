"""Obsidian note links preserve their Markdown when read, edited and exported."""

import unittest
from pathlib import Path

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class WikilinkTest(BrowserCase):
    start_route = "#/project/kundenportal/doc/RES-14"

    def test_parser_distinguishes_file_references_from_examples_and_external_urls(self):
        body = (
            "[[Ordner/Notiz#Abschnitt|Beleg]] ![[Medien/Karte.png|220]] [[Anhang.pdf]] "
            "[Text](Ordner/Neue%20Notiz.md#Ausblick)\n"
            "[[#Lokal]] \\[[Nur ein Beispiel]] `[[Code]]` ``[[Auch Code]]`` [Web](https://example.org/seite)\n"
            "Text mit `Code über\n[[Zeilen]]` im Absatz.\n"
            "~~~md\n[[Im Block]]\n~~~\n```text\n[[Offener Block]]"
        )
        self.assertTrue(self.page.evaluate("typeof vaultWikilinks==='function'"))
        links = self.page.evaluate("body=>vaultWikilinks(body)", body)
        self.assertEqual(links, [
            {"target": "Ordner/Notiz", "heading": "Abschnitt", "alias": "Beleg", "embed": False},
            {"target": "Medien/Karte.png", "heading": "", "alias": "220", "embed": True},
            {"target": "Anhang.pdf", "heading": "", "alias": "", "embed": False},
            {"target": "Ordner/Neue Notiz.md", "heading": "Ausblick", "alias": "Text", "embed": False},
            {"target": "", "heading": "Lokal", "alias": "", "embed": False},
        ])

    def test_typed_note_is_navigable_and_retains_source_syntax_on_second_edit_and_export(self):
        self.main.get_by_role("button", name="Notiz bearbeiten", exact=True).click()
        editor = self.main.get_by_role("textbox", name="Inhalt", exact=True)
        expect(editor).to_be_editable()
        expect(self.main.locator(".editor-label:visible")).to_have_count(0)
        body = "[[Servicefälle übergeben#Problem|Produktanforderung]] · [[Unbekannte Notiz]] · `[[Beispiel]]`"
        editor.fill(body)
        self.main.get_by_role("button", name="Änderungen speichern", exact=True).click()
        note = self.main.locator(".artifact-prose")
        target = note.get_by_role("button", name="Produktanforderung", exact=True)
        expect(target).to_have_count(1)
        expect(note.locator('[data-vault-missing="Unbekannte Notiz"]')).to_be_visible()
        expect(note.locator("code")).to_have_text("[[Beispiel]]")
        self.main.get_by_role("button", name="Notiz bearbeiten", exact=True).click()
        expect(editor).to_contain_text("[[Servicefälle übergeben#Problem|Produktanforderung]]")
        editor.press("Control+End")
        self.page.keyboard.insert_text(" Ergänzung")
        self.main.get_by_role("button", name="Änderungen speichern", exact=True).click()
        with self.page.expect_download() as downloaded:
            self.open_note_actions()
            self.main.get_by_role("button", name="Notiz exportieren", exact=True).click()
        exported = Path(downloaded.value.path()).read_text(encoding="utf-8")
        self.assertIn(body, exported)
        self.assertIn("Ergänzung", exported)
        target.click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Servicefälle übergeben")

    def test_pbi_plain_text_paste_keeps_markup_literal_and_preserves_web_links(self):
        self.page.goto(self.url + "#/project/kundenportal/usecase/UC-09")
        self.main.get_by_role("button", name="Bearbeiten", exact=True).click()
        editor = self.main.get_by_role("textbox", name="Use-Case", exact=True)
        editor.fill("")
        source = "[[Servicefälle übergeben|<b>Vorgabe</b>]]\n\n[Externe Quelle](https://example.org/hilfe)"
        editor.evaluate("""(element,source)=>{
            element.focus();
            const data=new DataTransfer();
            data.setData('text/plain',source);
            data.setData('text/html','<b>Formatierte Zwischenablage</b>');
            element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
        }""", source)
        self.main.get_by_role("button", name="PBI speichern", exact=True).click()
        self.page.reload()
        note = self.main.locator(".artifact-prose")
        expect(note.get_by_role("button", name="<b>Vorgabe</b>", exact=True)).to_be_visible()
        expect(note.locator("b")).to_have_count(0)
        expect(note.get_by_role("link", name="Externe Quelle")).to_have_attribute("href", "https://example.org/hilfe")


if __name__ == "__main__":
    unittest.main()
