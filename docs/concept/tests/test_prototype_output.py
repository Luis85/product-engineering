"""Local handoff, simulation and HTML round trips for a scoped prototype brief."""

import re
import unittest
from pathlib import Path

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class PrototypeOutputTest(BrowserCase):
    start_route = "#/project/kundenportal/prototypes"

    def create_brief(self, source, materials=()):
        create = self.main.get_by_role("button", name="Prototyp anlegen", exact=True)
        self.assertEqual(create.count(), 1, "The catalog must allow a scoped prototype brief")
        create.click()
        self.dialog.get_by_label("Titel", exact=True).fill("Übergabe ausprobieren")
        self.dialog.get_by_role("combobox", name="Umfang", exact=True).select_option(source)
        self.dialog.get_by_role("textbox", name="Beschreibung", exact=True).fill("Schichtwechsel mit offenen Fällen untersuchen.")
        for kind, name_label, name, content in materials:
            self.dialog.get_by_role("combobox", name=kind, exact=True).select_option("__new__")
            self.dialog.get_by_label(name_label).fill(name)
            self.dialog.get_by_label(kind + "-Inhalt").fill(content)
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Übergabe ausprobieren")
        expect(self.main.locator("iframe")).to_have_count(0)

    def download_text(self, label):
        with self.page.expect_download() as event:
            self.main.get_by_role("button", name=label, exact=True).click()
        return Path(event.value.path()).read_text(encoding="utf-8")

    def test_map_simulation_uses_the_selected_journey_and_marks_old_output(self):
        self.enable_demo_ai()
        self.create_brief("map:SM-01")
        brief = self.download_text("Briefing exportieren")
        for required in ["Erster nutzbarer Ablauf", "Nur offene Servicefälle anzeigen",
                         "Organisation", "Schichtwechsel mit offenen Fällen untersuchen."]:
            self.assertIn(required, brief)
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        frame = self.main.frame_locator("iframe")
        frame.get_by_role("button", name="Meine Fallübersicht sehen", exact=True).click()
        expect(frame.get_by_text("Die Koordinatorin sieht nur Fälle ihrer Organisation.")).to_be_visible()
        frame.get_by_role("button", name="Weiter", exact=True).click()
        expect(frame.get_by_role("heading", name="Offene Fälle filtern", exact=True)).to_be_visible()
        original = self.download_text("HTML exportieren")
        self.assertIn("Übergabe ausprobieren", original)
        self.assertNotIn(".agent-status", original, "Shell controls do not belong in standalone exports")

        self.main.get_by_role("button", name="Briefing bearbeiten").click()
        self.dialog.get_by_role("textbox", name="Beschreibung", exact=True).fill("Zusätzlich die Spätschicht einbeziehen.")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        self.page.reload()
        expect(self.main.get_by_text("Briefing geändert", exact=True)).to_be_visible()
        self.assertEqual(self.download_text("HTML exportieren"), original)
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        self.assertIn("Zusätzlich die Spätschicht einbeziehen.", self.download_text("HTML exportieren"))
        expect(self.main.get_by_text("Klickbar", exact=True)).to_be_visible()

    def test_item_brief_exports_criteria_and_preserves_imported_html(self):
        self.create_brief("item:UC-09")
        brief = self.download_text("Briefing exportieren")
        for required in ["Gefilterte Servicefälle exportieren", "Servicearbeit vereinfachen",
                         "SC-091", "Organisationsgrenze einhalten"]:
            self.assertIn(required, brief)
        html = ('<!doctype html><html lang="de"><meta charset="utf-8"><title>Übergabe</title>'
                '<button onclick="this.textContent=\'Erledigt\'">Fall übernehmen</button></html>\n')
        self.main.get_by_role("button", name="HTML übernehmen", exact=True).click()
        self.dialog.locator('input[type="file"]').set_input_files(
            {"name": "uebergabe.html", "mimeType": "text/html", "buffer": html.encode("utf-8")}
        )
        expect(self.dialog.get_by_role("textbox")).to_have_value(re.compile("Fall übernehmen"))
        self.dialog.get_by_role("button", name="HTML übernehmen", exact=True).click()
        self.page.reload()
        preview = self.main.locator("iframe")
        self.assertEqual(preview.get_attribute("sandbox"), "allow-scripts")
        frame = self.main.frame_locator("iframe")
        frame.get_by_role("button", name="Fall übernehmen").click()
        expect(frame.get_by_role("button", name="Erledigt")).to_be_visible()
        self.assertEqual(self.download_text("HTML exportieren"), html)

    def test_design_documents_travel_with_brief_and_changes_mark_the_preview_stale(self):
        self.enable_demo_ai()
        style = "Primärfarbe #344a57"
        system = "Jede Auswahl hat einen sichtbaren Tastaturfokus."
        self.create_brief("map:SM-01", [
            ("Styleguide", "Name des Styleguides", "Schichtbuch-Farben", style),
            ("Designsystem", "Name des Designsystems", "Schichtbuch-Komponenten", system),
        ])
        brief = self.download_text("Briefing exportieren")
        self.assertIn(style, brief)
        self.assertIn(system, brief)
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        self.assertIn("#344a57", self.download_text("HTML exportieren"))
        self.main.get_by_text("Briefing", exact=True).click()
        self.main.get_by_role("button", name="Schichtbuch-Farben", exact=True).click()
        self.main.get_by_role("button", name="Notiz bearbeiten", exact=True).click()
        self.main.locator("[data-rich-editor]").fill("Akzentfarbe: #173b60")
        self.main.get_by_role("button", name="Änderungen speichern").click()
        self.page.go_back()
        expect(self.main.get_by_text("Briefing geändert", exact=True)).to_be_visible()
        self.assertIn("Akzentfarbe: #173b60", self.download_text("Briefing exportieren"))


if __name__ == "__main__":
    unittest.main()
