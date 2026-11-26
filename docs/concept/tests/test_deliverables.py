
"""Project-local Deliverables track outcomes and link to real, reusable knowledge notes."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class DeliverablesTest(BrowserCase):
    start_route = "#/project/admin-console/backlog/board"

    def catalog(self):
        self.main.get_by_role("button",name="Deliverables",exact=True).click()
        expect(self.main.get_by_role("heading",name="Deliverables",exact=True)).to_be_visible()

    def create(self,title="Betriebshandbuch",kind="Betriebskonzept"):
        self.main.get_by_role("button",name="Deliverable anlegen",exact=True).click()
        expect(self.dialog.locator('[name="owner"]')).to_have_value("")
        self.dialog.get_by_label("Titel",exact=True).fill(title)
        self.dialog.get_by_label("Erwartetes Ergebnis",exact=True).fill("Der Bereitschaftsdienst kann den Ablauf nachvollziehen.")
        self.dialog.get_by_role("combobox",name="Dokumentvorlage",exact=True).select_option(kind)
        self.dialog.get_by_label("Fällig am",exact=True).fill("2027-04-30")
        self.dialog.get_by_role("button",name="Deliverable speichern").click()
        record=self.main.locator("[data-deliverable-id]").filter(has_text=title)
        expect(record).to_be_visible()
        return record

    def test_fourth_tab_is_deep_linked_and_old_projects_start_empty(self):
        self.page.evaluate("""()=>{const key='product-engineering-clickdummy-v1',data=JSON.parse(localStorage.getItem(key));
          data.projects.forEach(p=>delete p.deliverables);localStorage.setItem(key,JSON.stringify(data));}""")
        self.page.reload()
        self.catalog()
        self.assertTrue(self.page.url.endswith("/backlog/deliverables"))
        expect(self.main.get_by_text("In diesem Projekt sind noch keine Deliverables geplant.",exact=True)).to_be_visible()
        self.assertEqual(self.main.locator(".backlog-switch button").all_text_contents(),["Board","Liste","NFRs","Deliverables"])
        self.main.get_by_role("button",name="Board",exact=True).click()
        self.page.go_back()
        expect(self.main.get_by_role("button",name="Deliverables",exact=True)).to_have_attribute("aria-pressed","true")
        self.page.reload()
        expect(self.main.get_by_role("button",name="Deliverable anlegen")).to_be_visible()

    def test_linked_document_can_be_created_from_template_and_returns_to_the_same_deliverable(self):
        self.catalog()
        row=self.create()
        identifier=row.get_attribute("data-deliverable-id")
        self.assertTrue(identifier.startswith("DEL-"))
        row.get_by_role("button",name="Notiz anlegen",exact=True).click()
        expect(self.dialog.locator('[name="kind"]')).to_have_value("Betriebskonzept")
        self.dialog.get_by_label("Titel",exact=True).fill("Dienstbereitschaft für das Portal")
        self.dialog.locator("button[type=submit]").click()
        doc_id=self.page.url.split("/")[-1]
        self.assertTrue(doc_id.startswith("OPS-"))
        self.main.locator("[data-rich-editor]").fill("## Bereitschaft\n\nDer Dienst prüft die Störung.")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        self.main.get_by_role("button",name=f"{identifier} · Betriebshandbuch",exact=True).click()
        expect(self.dialog.get_by_label("Titel",exact=True)).to_have_value("Betriebshandbuch")
        self.page.keyboard.press("Escape")
        self.page.reload()
        expect(row.get_by_role("button",name="Dienstbereitschaft für das Portal",exact=True)).to_be_visible()
        expect(row.get_by_role("button",name="Notiz anlegen",exact=True)).to_have_count(0)
        self.assertEqual(self.page.evaluate("project().deliverables[0].docId"),doc_id)

    def test_attach_existing_note_filter_edit_and_complete_without_changing_approval(self):
        self.catalog()
        row=self.create("Vision verabschieden","Vision")
        row.get_by_role("button",name="Notiz verknüpfen",exact=True).click()
        self.dialog.locator('[name="docId"]').select_option("VIS-01")
        self.dialog.get_by_role("button",name="Deliverable speichern",exact=True).click()
        expect(row.get_by_role("button",name="Produktvision Admin Console")).to_be_visible()
        before=self.page.evaluate("JSON.stringify(getDoc('VIS-01'))")
        row.get_by_role("combobox").select_option("Erledigt")
        self.main.get_by_label("Status filtern",exact=True).select_option("Geplant")
        expect(row).to_have_count(0)
        self.main.get_by_label("Status filtern",exact=True).select_option("Erledigt")
        expect(row).to_be_visible()
        self.main.get_by_label("Vorlage filtern",exact=True).select_option("Betriebskonzept")
        expect(row).to_have_count(0)
        self.main.get_by_role("button",name="Filter zurücksetzen",exact=True).click()
        self.main.get_by_label("Deliverables durchsuchen").fill("Vision verabschieden")
        row.get_by_role("button",name="Vision verabschieden",exact=True).click()
        self.dialog.get_by_label("Titel",exact=True).fill("Strategie-Ziel prüfen")
        self.dialog.get_by_role("combobox",name="Verantwortlich",exact=True).select_option(index=1)
        self.dialog.get_by_role("button",name="Deliverable speichern").click()
        self.assertEqual(self.page.evaluate("JSON.stringify(getDoc('VIS-01'))"),before)
        self.assertEqual(self.page.evaluate("project().deliverables[0].status"),"Erledigt")
        self.page.goto(self.url+"#/project/kundenportal/backlog/deliverables")
        expect(self.main.get_by_role("button",name="Strategie-Ziel prüfen",exact=True)).to_have_count(0)

    def test_mobile_create_and_cancel_keep_form_state_and_do_not_create_a_note(self):
        self.page.set_viewport_size({"width":320,"height":700})
        self.catalog();row=self.create()
        notes=self.page.evaluate("project().docs.length")
        row.get_by_role("button",name="Notiz anlegen",exact=True).click()
        self.page.keyboard.press("Escape")
        self.assertEqual(self.page.evaluate("project().docs.length"),notes)
        self.assertEqual(self.page.evaluate("project().deliverables[0].docId"),"")
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        self.page.reload()
        expect(row.get_by_role("combobox")).to_have_value("Geplant")



    def test_four_backlog_tab_labels_fit_on_small_screens_from_every_view(self):
        self.page.set_viewport_size({"width":320,"height":640})
        for route in ["board","list","nfrs","deliverables"]:
            self.page.goto(self.url+"#/project/kundenportal/backlog/"+route)
            expect(self.main.get_by_role("button",name="Deliverables",exact=True)).to_be_visible()
            self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"),route)
