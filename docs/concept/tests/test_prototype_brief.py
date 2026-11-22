"""The prototype brief and its reusable project design documents."""
from browser_case import BrowserCase


class PrototypeBriefTest(BrowserCase):
    start_route = "#/project/kundenportal/prototypes"

    def new(self):
        create = self.main.locator('[data-action="new-proto"]')
        create.click()
        self.assertEqual(self.dialog.get_by_label("Umfang", exact=True).count(), 1,
                         "The brief must accept either a backlog item or a whole Story Map")

    def fill_brief(self, source, title):
        self.dialog.get_by_label("Umfang", exact=True).select_option(source)
        self.dialog.get_by_label("Titel", exact=True).fill(title)
        self.dialog.get_by_label("Beschreibung", exact=True).fill("Übergabe prüfen und bestätigen.")

    def test_select_any_backlog_type_or_a_whole_map(self):
        self.new()
        select = self.dialog.get_by_label("Umfang", exact=True)
        for value in ["item:EP-01", "item:FE-01", "item:UC-09", "item:TASK-01",
                      "item:ISS-01", "item:BUG-01", "map:SM-01"]:
            self.assertEqual(select.locator(f'option[value="{value}"]').count(), 1, value)
        self.fill_brief("item:FE-01", "Übergabe simulieren")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        self.page.reload()
        self.assertEqual(self.main.get_by_role("heading", level=1).inner_text(), "Übergabe simulieren")
        self.main.get_by_role("button", name="Briefing bearbeiten").click()
        self.assertEqual(self.dialog.get_by_label("Umfang").input_value(), "item:FE-01")
        self.assertEqual(self.dialog.get_by_label("Beschreibung").input_value(), "Übergabe prüfen und bestätigen.")
        self.dialog.get_by_label("Umfang").select_option("map:SM-01")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        self.main.get_by_role("button", name="Briefing bearbeiten").click()
        self.assertEqual(self.dialog.get_by_label("Umfang").input_value(), "map:SM-01")

    def test_add_reusable_design_documents_without_leaving_the_brief(self):
        self.new()
        self.fill_brief("map:SM-01", "Übergabe mit Gestaltung")
        self.dialog.get_by_label("Styleguide", exact=True).select_option("__new__")
        self.dialog.get_by_label("Name des Styleguides").fill("Gestaltung im Portal")
        self.dialog.get_by_label("Styleguide-Inhalt").fill("Primärfarbe #245b61. Gut lesbare Schrift.")
        self.dialog.get_by_label("Designsystem", exact=True).select_option("__new__")
        self.dialog.get_by_label("Name des Designsystems").fill("Portal-Komponenten")
        self.dialog.get_by_label("Designsystem-Inhalt").fill("Schaltflächen zeigen einen sichtbaren Fokus.")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        self.page.reload()
        self.page.goto(self.url + self.start_route)
        self.new()
        self.assertEqual(self.dialog.get_by_label("Styleguide", exact=True).get_by_role(
            "option", name="Gestaltung im Portal", exact=True).count(), 1)
        self.assertEqual(self.dialog.get_by_label("Designsystem", exact=True).get_by_role(
            "option", name="Portal-Komponenten", exact=True).count(), 1)
        self.dialog.get_by_role("button", name="Abbrechen").click()
        self.page.goto(self.url + "#/project/kundenportal/knowledge")
        self.assertTrue(self.main.get_by_role("button", name="Gestaltung im Portal").is_visible())
        self.assertTrue(self.main.get_by_role("button", name="Portal-Komponenten").is_visible())

    def test_cancel_brief_discards_new_materials_and_keeps_legacy_preview(self):
        self.new()
        self.fill_brief("item:UC-09", "Nicht speichern")
        self.dialog.get_by_label("Styleguide", exact=True).select_option("__new__")
        self.dialog.get_by_label("Name des Styleguides").fill("Verworfen")
        self.dialog.get_by_label("Styleguide-Inhalt").fill("Dieser Text ist ein Entwurf.")
        self.dialog.get_by_role("button", name="Abbrechen").click()
        self.new()
        self.assertEqual(self.dialog.get_by_label("Styleguide", exact=True).get_by_role(
            "option", name="Verworfen", exact=True).count(), 0)
        self.dialog.get_by_role("button", name="Abbrechen").click()
        self.main.get_by_role("button", name="CSV-Export in der Fallübersicht", exact=True).click()
        self.assertTrue(self.main.get_by_role("button", name="CSV exportieren", exact=True).is_visible())
