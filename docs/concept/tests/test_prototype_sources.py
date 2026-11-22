from playwright.sync_api import expect

from browser_case import BrowserCase


class PrototypeSourceTest(BrowserCase):
    def route(self, path):
        self.page.goto(self.url + "#/project/kundenportal/" + path)

    def relations(self, source_id):
        if source_id.startswith("SM-"):
            self.open_map_context("Prototypen")
        return self.page.get_by_role("region", name=f"Prototypen für {source_id}", exact=True)

    def create_from(self, scope, title):
        _, source_id = scope.split(":")
        self.relations(source_id).get_by_role("button", name="Prototyp anlegen", exact=True).click()
        brief = self.page.get_by_role("dialog", name="Prototyp anlegen", exact=True)
        expect(brief.get_by_role("combobox", name="Umfang")).to_have_value(scope)
        brief.get_by_label("Titel", exact=True).fill(title)
        brief.get_by_label("Beschreibung", exact=True).fill("Den zugehörigen Ablauf ausprobieren.")
        brief.get_by_role("button", name="Briefing speichern").click()

    def test_pbi_lists_legacy_and_new_prototypes_and_scope_can_change(self):
        self.route("usecase/UC-09")
        sources = self.relations("UC-09")
        self.assertEqual(sources.count(), 1, "A PBI must expose its prototypes in context")
        expect(sources.get_by_role("button", name="CSV-Export in der Fallübersicht")).to_be_visible()
        self.create_from("item:UC-09", "Übergabe prüfen")
        self.main.get_by_role("button", name="UC-09 · Gefilterte Servicefälle exportieren").click()
        sources.get_by_role("button", name="Übergabe prüfen").click()
        self.main.get_by_role("button", name="Briefing bearbeiten").click()
        self.dialog.get_by_role("combobox", name="Umfang").select_option("map:SM-01")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        self.route("usecase/UC-09")
        expect(sources.get_by_role("button", name="Übergabe prüfen")).to_have_count(0)
        self.route("storymap/SM-01")
        self.page.reload()
        expect(self.relations("SM-01").get_by_role("button", name="Übergabe prüfen")).to_be_visible()

    def test_map_can_launch_cancel_and_return_from_a_prototype(self):
        self.route("storymap/SM-01")
        relations = self.relations("SM-01")
        self.assertEqual(relations.count(), 1, "A whole map must offer a scoped prototype entry")
        relations.get_by_role("button", name="Prototyp anlegen").click()
        expect(self.dialog.get_by_role("combobox", name="Umfang")).to_have_value("map:SM-01")
        self.page.keyboard.press("Escape")
        expect(relations.get_by_role("button", name="Prototyp anlegen")).to_be_focused()
        self.create_from("map:SM-01", "Map als Prototyp")
        self.main.get_by_role("button", name="SM-01 · Servicefälle verlässlich übergeben").click()
        expect(relations.get_by_role("button", name="Map als Prototyp")).to_be_visible()

    def test_group_editor_keeps_its_draft_while_creating_a_prototype(self):
        self.route("backlog/list")
        self.main.get_by_role("button", name="Servicefälle verwalten", exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill("Titel noch nicht gespeichert")
        self.assertEqual(self.relations("FE-01").count(), 1, "Group editors need a scope action")
        self.create_from("item:FE-01", "Feature-Prototyp")
        expect(self.dialog.get_by_label("Titel", exact=True)).to_have_value("Titel noch nicht gespeichert")
        self.relations("FE-01").get_by_role("button", name="Feature-Prototyp").click()
        self.page.get_by_role("button", name="Weiter bearbeiten", exact=True).click()
        expect(self.dialog.get_by_label("Titel", exact=True)).to_have_value("Titel noch nicht gespeichert")
        self.dialog.get_by_role("button", name="Änderungen speichern").click()
        self.main.get_by_role("button", name="Titel noch nicht gespeichert", exact=True).click()
        self.relations("FE-01").get_by_role("button", name="Feature-Prototyp").click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Feature-Prototyp")

    def test_list_board_and_child_items_offer_a_preselected_scope(self):
        self.route("backlog/list")
        self.main.get_by_role("button", name="Gefilterte Servicefälle exportieren aufklappen").click()
        for item_id in ("EP-01", "FE-01", "UC-09", "TASK-01", "ISS-01", "BUG-01"):
            row = self.main.locator(f'[data-backlog-id="{item_id}"]')
            create = row.get_by_role("button", name=f"Prototyp für {item_id} anlegen")
            self.assertEqual(create.count(), 1, item_id)
            create.click()
            expect(self.dialog.get_by_role("combobox", name="Umfang")).to_have_value("item:" + item_id)
            self.dialog.get_by_role("button", name="Abbrechen").click()
        self.main.get_by_role("button", name="Board", exact=True).click()
        card = self.main.locator('[data-board-card="UC-09"]')
        card.get_by_role("button", name="Prototyp für UC-09 anlegen").click()
        expect(self.dialog.get_by_role("combobox", name="Umfang")).to_have_value("item:UC-09")

    def test_legacy_and_generated_previews_use_the_browser_frame(self):
        self.enable_demo_ai()
        self.route("prototype/PT-03")
        frame = self.main.get_by_role("region", name="Browser-Vorschau", exact=True)
        self.assertEqual(frame.count(), 1, "Sample HTML needs the same local browser frame as generated HTML")
        expect(frame.get_by_text("PT-03-rev2.html", exact=True)).to_be_visible()
        frame.get_by_role("combobox", name="Status").select_option("Ohne Treffer")
        expect(frame.get_by_role("button", name="CSV exportieren")).to_be_disabled()
        self.route("storymap/SM-01")
        self.create_from("map:SM-01", "Browserrahmen")
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        expect(frame.get_by_text("PT-04.html", exact=True)).to_be_visible()
        expect(frame.locator("iframe")).to_have_attribute("sandbox", "allow-scripts")
        self.page.set_viewport_size({"width":320,"height":780})
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    def test_imported_html_survives_an_accidental_simulation(self):
        self.enable_demo_ai()
        self.route("prototypes")
        self.main.get_by_role("button", name="Prototyp anlegen").click()
        self.dialog.get_by_role("combobox", name="Umfang").select_option("item:UC-09")
        self.dialog.get_by_label("Titel", exact=True).fill("Agentenergebnis")
        self.dialog.get_by_label("Beschreibung", exact=True).fill("Übergabe")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        self.main.get_by_role("button", name="HTML übernehmen").click()
        self.dialog.get_by_label("HTML-Quelltext").fill("<h1>Ergebnis des Agenten</h1>")
        self.dialog.get_by_role("button", name="HTML übernehmen").click()
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        expect(self.dialog.get_by_role("heading", name="Übernommenes HTML ersetzen?")).to_be_visible()
        self.dialog.get_by_role("button", name="Abbrechen").click()
        expect(self.main.frame_locator("iframe").get_by_role("heading", level=1)).to_have_text("Ergebnis des Agenten")
