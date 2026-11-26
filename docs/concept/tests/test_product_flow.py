"""Exercise the planning flow through its visible controls, including browser reloads."""

import re
import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class ProductFlowTest(BrowserCase):
    def create_project(self, name):
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        self.dialog.locator('[data-action="new-project"]').click()
        self.dialog.get_by_label("Produktname").fill(name)
        self.dialog.get_by_label("Kurzbeschreibung").fill("Schichtübergaben planen")
        self.dialog.get_by_label("Git-Repository").fill("produktteam/schichtbuch")
        self.submit_dialog()
        expect(self.main.get_by_role("heading", level=1)).to_have_text(name)

    def submit_dialog(self):
        self.dialog.locator('button[type="submit"]').click()

    def author_document(self, title, body):
        self.dialog.get_by_label("Titel", exact=True).fill(title)
        self.submit_dialog()
        self.main.locator("[data-rich-editor]").fill(body)
        self.main.get_by_role("button", name="Änderungen speichern", exact=True).click()
        expect(self.main.get_by_text(body, exact=True)).to_be_visible()

    def add_story(self, title, description):
        self.main.get_by_role(
            "button", name="Story für „Eintrag lesen“ in „Erste Übergabe“ hinzufügen", exact=True
        ).click()
        self.dialog.get_by_label("Story-Titel").fill(title)
        self.dialog.get_by_label("Bedarf oder erwartetes Ergebnis").fill(description)
        self.submit_dialog()

    def review_card(self, title):
        return self.main.locator("[data-review-card]").filter(
            has=self.page.get_by_role("heading", name=title, exact=True)
        )

    def open_portal_map(self):
        self.page.get_by_role("navigation", name="Projektbereiche").get_by_role(
            "button", name=re.compile("Story Maps")
        ).click()
        self.main.get_by_role("button", name=re.compile("Servicefälle verlässlich übergeben")).click()

    def open_portal_slice(self):
        self.open_portal_map()
        self.main.get_by_role("region", name="Erster nutzbarer Ablauf", exact=True).get_by_role(
            "button", name="Fürs Backlog prüfen"
        ).click()

    def test_new_project_reaches_one_canonical_pbi_from_two_stories(self):
        self.create_project("Schichtbuch")
        first_job = self.main.get_by_role("button", name="Ersten Job beschreiben", exact=True)
        self.assertTrue(first_job.count(), "A fresh project needs an entry to its first job")
        first_job.click()
        self.author_document("Schicht abschließen", "Die nächste Schicht weiß, welche Fälle offen sind.")
        self.main.get_by_role("button", name="Produktvision anlegen").click()
        self.author_document("Eine gemeinsame Übergabe", "Beim Schichtwechsel geht kein Auftrag verloren.")
        self.main.get_by_role("button", name="PRD anlegen").click()
        expect(self.dialog.get_by_role("checkbox", name=re.compile("Schicht abschließen"))).to_be_checked()
        expect(self.dialog.get_by_label("Produktvision").locator("option:checked")).to_have_text("Eine gemeinsame Übergabe")
        self.author_document("Übergabe prüfen", "Alle freigegebenen Einträge erscheinen in der Liste.")

        self.main.get_by_role("button", name="Story Map anlegen").click()
        self.dialog.get_by_label("Name der Story Map").fill("Übergabe im Schichtbuch")
        self.dialog.get_by_label("Zielgruppe").fill("Schichtleitung")
        self.dialog.get_by_label("Nutzerziel").fill("Offene Aufträge gemeinsam übernehmen")
        self.submit_dialog()
        self.main.get_by_role("button", name="Aktivität hinzufügen").click()
        self.dialog.get_by_label("Titel").fill("Übergabe lesen")
        self.submit_dialog()
        self.main.get_by_role("button", name="Ersten Schritt hinzufügen").click()
        self.dialog.get_by_label("Titel").fill("Eintrag lesen")
        self.submit_dialog()
        self.main.get_by_role("button", name="Lieferabschnitt hinzufügen").click()
        self.dialog.get_by_label("Titel").fill("Erste Übergabe")
        self.dialog.get_by_label("Nutzerergebnis").fill("Die Schicht kennt die offenen Aufträge.")
        self.submit_dialog()
        self.add_story("Offene Aufträge lesen", "Ich erkenne offene Aufträge.")
        self.add_story("Offene Aufträge übernehmen", "Meine Kollegin sieht dieselben Aufträge.")
        self.main.get_by_role("button", name="Fürs Backlog prüfen").click()

        first = self.review_card("Offene Aufträge lesen")
        first.get_by_role("button", name="PBI aus Story anlegen").click()
        self.assertEqual(self.dialog.get_by_label("PBI-Titel").input_value(), "Offene Aufträge lesen")
        self.assertEqual(self.dialog.get_by_label("Bedarf und erwartetes Ergebnis").input_value(), "Ich erkenne offene Aufträge.")
        self.assertIn("Übergabe prüfen", self.dialog.get_by_label("PRD-Anforderung").locator("option:checked").inner_text())
        self.assertIn("Schicht abschließen", self.dialog.get_by_label("Job to Be Done").locator("option:checked").inner_text())
        self.assertEqual(self.dialog.get_by_label("Verantwortlich").input_value(), "")
        self.dialog.get_by_label("Neues Epic").fill("Übergaben")
        self.dialog.get_by_label("Neues Feature").fill("Schichtbuch lesen")
        self.submit_dialog()
        expect(first).to_contain_text("Neu angelegt")
        canonical = first.locator('[data-action="open-uc"]')
        pbi_id = canonical.get_attribute("data-id")

        second = self.review_card("Offene Aufträge übernehmen")
        second.get_by_role("button", name="Vorhandenes Item verknüpfen").click()
        self.dialog.get_by_label("Backlog-Item").select_option(pbi_id)
        self.submit_dialog()
        self.page.reload()
        expect(second).to_contain_text("Bestehendes PBI")
        expect(second.locator('[data-action="open-uc"]')).to_have_attribute("data-id", pbi_id)
        expect(self.main.get_by_role("button", name="PBI aus Story anlegen")).to_have_count(0)
        canonical.click()
        self.main.get_by_role("button", name="Bearbeiten", exact=True).click()
        self.assertEqual(self.main.get_by_label("Backlog-Status").locator("option:checked").inner_text(), "Backlog")
        self.assertEqual(self.main.get_by_label("Verantwortlich").input_value(), "")
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        self.main.get_by_role("button", name="Übergabe im Schichtbuch › Erste Übergabe › Offene Aufträge übernehmen").click()
        expect(self.main.locator("article:focus").get_by_role("heading")).to_have_text("Offene Aufträge übernehmen")

        self.page.get_by_role("navigation", name="Projektbereiche").get_by_role("button", name="Backlog", exact=True).click()
        self.main.get_by_role("button", name="Liste", exact=True).click()
        self.main.get_by_role("combobox", name="Ebene", exact=True).select_option("PBI")
        expect(self.main.locator("tr[data-backlog-id]")).to_have_count(1)
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        self.dialog.locator('[data-action="switch-project"][data-id="kundenportal"]').click()
        self.open_portal_slice()
        expect(self.main.get_by_role("heading", name="Meine Fallübersicht sehen")).to_be_visible()
        expect(self.review_card("Offene Aufträge übernehmen")).to_have_count(0)

    def test_slice_cancel_and_deferral_preserve_existing_feature(self):
        self.open_portal_slice()
        card = self.review_card("Meine Fallübersicht sehen")
        card.get_by_role("button", name="PBI aus Story anlegen").click()
        self.assertEqual(self.dialog.get_by_role("combobox", name="Feature", exact=True).input_value(), "FE-01")
        self.dialog.get_by_role("button", name="Abbrechen").click()
        card.get_by_role("button", name="Zurückstellen").click()
        self.page.reload()
        expect(card).to_contain_text("Zurückgestellt")
        expect(card.get_by_role("button", name=re.compile("FE-01"))).to_be_visible()
        expect(card.locator('[data-action="open-uc"]')).to_have_count(0)
        card.get_by_role("button", name="Wieder aufnehmen").click()
        expect(card.get_by_role("button", name="PBI aus Story anlegen")).to_be_visible()

    def test_knowledge_edit_can_be_resumed_and_saved(self):
        nav = self.page.get_by_role("navigation", name="Projektbereiche")
        nav.get_by_role("button", name="Wissen", exact=True).click()
        self.main.get_by_role("button", name=re.compile("^Interview zur Wochenübergabe")).click()
        self.main.get_by_role("button", name="Notiz bearbeiten", exact=True).click()
        self.main.locator("[data-rich-editor]").fill("Die Frühschicht nutzt zwei Übergabewege.")
        nav.get_by_role("button", name="Überblick", exact=True).click()
        expect(self.dialog.get_by_role("heading")).to_have_text("Ungespeicherte Änderungen")
        self.dialog.get_by_role("button", name="Weiter bearbeiten").click()
        self.main.get_by_role("button", name="Änderungen speichern").click()
        self.page.reload()
        expect(self.main.get_by_text("Die Frühschicht nutzt zwei Übergabewege.", exact=True)).to_be_visible()

    def test_story_question_survives_review_and_reload(self):
        self.open_portal_map()
        card = self.main.locator("article").filter(
            has=self.page.get_by_role("heading", name="Meine Fallübersicht sehen", exact=True)
        )
        card.get_by_role("button", name=re.compile("Begleititems")).click()
        self.dialog.get_by_role("button", name="Eintrag erfassen").click()
        self.dialog.locator('[name="kind"]').select_option("Frage")
        self.dialog.get_by_label("Titel", exact=True).fill("Wer prüft die Fallnummer?")
        self.submit_dialog()
        self.dialog.get_by_role("button", name=re.compile("Wer prüft die Fallnummer")).click()
        self.dialog.get_by_role("combobox", name="Status", exact=True).select_option("Erledigt")
        self.submit_dialog()
        self.page.keyboard.press("Escape")
        self.main.get_by_role("region", name="Erster nutzbarer Ablauf", exact=True).get_by_role(
            "button", name="Fürs Backlog prüfen"
        ).click()
        self.review_card("Meine Fallübersicht sehen").get_by_role("button", name="PBI aus Story anlegen").click()
        self.submit_dialog()
        self.page.reload()
        self.main.get_by_role("button", name="Servicefälle verlässlich übergeben", exact=True).click()
        card.get_by_role("button", name=re.compile("Begleititems")).click()
        self.dialog.get_by_role("button", name=re.compile("Wer prüft die Fallnummer")).click()
        self.assertEqual(self.dialog.get_by_role("combobox", name="Status", exact=True).input_value(), "Erledigt")
        self.assertEqual(self.dialog.locator('[name="pbi"]').input_value(), "story")


if __name__ == "__main__":
    unittest.main()
