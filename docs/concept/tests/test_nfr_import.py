"""A local CSV intake must preview classifications and write only confirmed rows."""

import re
import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


HEADERS = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien"


class NfrImportTest(BrowserCase):
    start_route = "#/project/kundenportal/backlog/nfrs"

    def start_import(self):
        control = self.main.get_by_role("button", name="NFRs importieren", exact=True)
        self.assertEqual(control.count(), 1, "The NFR area must expose the local import workflow")
        control.click()
        return self.dialog.get_by_role("textbox", name="CSV-Daten", exact=True)

    def preview(self):
        self.dialog.get_by_role("button", name="Vorschau prüfen", exact=True).click()
        return self.dialog.get_by_role("region", name="Importvorschau")

    def commit(self):
        self.dialog.get_by_role("button", name=re.compile(r"^\d+ NFR importieren$")).click()

    def test_local_file_supports_quoted_multiline_fields_both_standards_and_reimport(self):
        csv = ('\ufeff' + HEADERS + '\r\nIndex;'
               '"Die Suche liefert ""Treffer""; auch mobil.";'
               '"Unter 100 ms\r\nbei 10 000 Datensätzen";Kim;performance-efficiency|27001:technological')
        self.start_import()
        self.dialog.locator('input[type="file"]').set_input_files(
            {"name": "anforderungen.csv", "mimeType": "text/csv", "buffer": csv.encode("utf-8")}
        )
        expect(self.dialog.get_by_role("textbox")).to_have_value(re.compile("10 000 Datensätzen"))
        preview = self.preview()
        expect(preview).to_contain_text("25010")
        expect(preview).to_contain_text("27001")
        expect(preview).to_contain_text('Die Suche liefert "Treffer"; auch mobil.')
        self.commit()
        self.page.reload()
        expect(self.main.get_by_text("Index", exact=True).first).to_be_visible()
        text = self.start_import()
        text.fill(csv)
        duplicate = self.preview()
        expect(duplicate).to_contain_text("bereits vorhanden")
        expect(self.dialog.get_by_role("button", name="0 NFR importieren")).to_be_disabled()

    def test_invalid_classification_blocks_whole_batch_and_editing_invalidates_preview(self):
        text = self.start_import()
        csv = HEADERS.replace(";", ",") + '\nTempo,Schnelle Suche,Unter 1 s,,reliability\nSchutz,Sicher,Prüfung,,25010:unbekannt'
        text.fill(csv)
        preview = self.preview()
        expect(preview).to_contain_text("Zeile 3")
        expect(preview).to_contain_text("25010:unbekannt")
        expect(self.dialog.get_by_role("button", name=re.compile(r"^\d+ NFR importieren$"))).to_be_disabled()
        text.fill(csv.replace("25010:unbekannt", "27001:physical"))
        self.preview()
        expect(self.dialog.get_by_role("button", name="2 NFR importieren")).to_be_enabled()
        text.fill(csv)
        expect(self.dialog.get_by_role("button", name=re.compile(r"^\d+ NFR importieren$"))).to_have_count(0)
        self.dialog.get_by_role("button", name="Abbrechen", exact=True).click()
        self.page.reload()
        expect(self.main.get_by_text("Tempo", exact=True)).to_have_count(0)

    def test_conflicting_rows_and_malformed_csv_report_exact_source_lines(self):
        text = self.start_import()
        csv = HEADERS + '\nSichtbarkeit;"Mehrzeiliger\nText";Messbar;;security\nSichtbarkeit;Anderer Text;Messbar;;security'
        text.fill(csv)
        preview = self.preview()
        expect(preview).to_contain_text("Zeile 4")
        expect(self.dialog.get_by_role("button", name=re.compile(r"^\d+ NFR importieren$"))).to_be_disabled()
        text.fill(HEADERS + '\nSichtbarkeit;"Offene Anführungszeichen\nnoch offen')
        expect(self.preview()).to_contain_text("Zeile 2")
        expect(self.dialog.get_by_role("button", name=re.compile(r"^\d+ NFR importieren$"))).to_be_disabled()


if __name__ == "__main__":
    unittest.main()
