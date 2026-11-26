
"""NFR catalog routing, standards mappings, project persistence and keyboard editing."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class NfrCatalog(BrowserCase):
    start_route = "#/project/kundenportal/backlog"

    def test_a_requirement_shows_which_standard_each_category_belongs_to(self):
        self.page.goto(self.url + "#/project/kundenportal/backlog/nfrs")
        entry = self.main.get_by_role("listitem").filter(has_text="Organisationsgrenze im Export")
        expect(entry.get_by_text("ISO/IEC 25010", exact=True)).to_be_visible()
        expect(entry.get_by_text("ISO/IEC 27001 · Anhang A", exact=True)).to_be_visible()
        expect(entry.get_by_text("Informationssicherheit", exact=True)).to_be_visible()
        expect(entry.get_by_text("Technische Maßnahmen", exact=True)).to_be_visible()

    def test_catalog_deep_link_and_back_preserve_the_board(self):
        self.main.get_by_role("button", name="Board", exact=True).click()
        stages = self.main.locator(".kanban-lane").all_text_contents()
        self.assertEqual(len(stages), 6)
        self.main.get_by_role("button", name="NFRs", exact=True).click()
        self.assertTrue(self.page.url.endswith("/backlog/nfrs"))
        expect(self.main.get_by_role("heading", name="Nichtfunktionale Anforderungen")).to_be_visible()
        expect(self.main.get_by_role("button", name="NFRs importieren")).to_be_visible()
        self.main.get_by_role("button", name="Board", exact=True).click()
        self.assertEqual(self.main.locator(".kanban-lane").all_text_contents(), stages)
        self.page.go_back()
        expect(self.main.get_by_role("button", name="NFRs", exact=True)).to_have_attribute("aria-pressed", "true")
        self.page.reload()
        expect(self.main.get_by_role("heading", name="Nichtfunktionale Anforderungen")).to_be_visible()

    def test_requirement_can_map_to_both_standards_and_persist_without_owner(self):
        self.page.goto(self.url + "#/project/admin-console/backlog/nfrs")
        self.main.get_by_role("button", name="NFR anlegen").click()
        expect(self.dialog.get_by_role("group", name="ISO/IEC 25010:2023").get_by_role("checkbox")).to_have_count(9)
        expect(self.dialog.get_by_role("group", name="ISO/IEC 27001:2022").get_by_role("checkbox")).to_have_count(4)
        self.dialog.get_by_label("Titel", exact=True).fill("Antwortzeit beim Rollenwechsel")
        self.dialog.get_by_label("Anforderung", exact=True).fill("Nach einer Rollenänderung sind neue Rechte zeitnah wirksam.")
        self.dialog.get_by_role("button", name="NFR speichern").click()
        expect(self.dialog.get_by_label("Messbares Abnahmekriterium")).to_be_focused()
        self.dialog.get_by_label("Messbares Abnahmekriterium").fill("In 20 von 20 Tests gelten die neuen Rechte nach spätestens 10 Sekunden.")
        self.dialog.get_by_role("checkbox", name="Leistungseffizienz").check()
        self.dialog.get_by_role("checkbox", name="Informationssicherheit").check()
        self.dialog.get_by_role("checkbox", name="Technische Maßnahmen").check()
        self.dialog.get_by_role("button", name="NFR speichern").click()
        entry = self.main.get_by_role("button", name="Antwortzeit beim Rollenwechsel", exact=True)
        expect(entry).to_be_visible()
        self.page.reload()
        entry.click()
        expect(self.dialog.get_by_label("Verantwortlich")).to_have_value("")
        expect(self.dialog.get_by_role("checkbox", name="Technische Maßnahmen")).to_be_checked()
        self.dialog.get_by_role("checkbox", name="Leistungseffizienz").uncheck()
        self.dialog.get_by_role("button", name="NFR speichern").click()
        self.main.get_by_label("Norm oder Kategorie").select_option("performance-efficiency")
        expect(entry).to_have_count(0)
        self.main.get_by_label("Norm oder Kategorie").select_option("technological")
        expect(entry).to_be_visible()
        self.page.goto(self.url + "#/project/kundenportal/backlog/nfrs")
        expect(entry).to_have_count(0)

    def test_older_saved_project_opens_its_own_empty_catalog(self):
        self.page.evaluate("""() => {
          const key='product-engineering-clickdummy-v1', stored=JSON.parse(localStorage.getItem(key));
          for (const project of stored.projects) delete project.nfrs;
          localStorage.setItem(key,JSON.stringify(stored));
        }""")
        self.page.goto(self.url + "#/project/kundenportal/backlog/nfrs")
        self.page.reload()
        expect(self.main.get_by_text("In diesem Projekt sind noch keine NFRs erfasst.")).to_be_visible()
        self.page.set_viewport_size({"width":360,"height":720})
        self.main.get_by_role("button", name="NFR anlegen").click()
        expect(self.dialog.get_by_label("Titel", exact=True)).to_be_focused()
        self.assertLessEqual(self.dialog.evaluate("el=>el.scrollWidth"),self.dialog.evaluate("el=>el.clientWidth+1"))
        self.page.keyboard.press("Escape")
        expect(self.main.get_by_role("button", name="NFR anlegen")).to_be_focused()

