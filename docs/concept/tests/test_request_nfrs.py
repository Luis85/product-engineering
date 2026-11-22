
"""Feature-request NFR coverage uses the source PBI at draft time and its frozen release thereafter."""
import json

from playwright.sync_api import expect

from browser_case import BrowserCase


class RequestNfrTest(BrowserCase):
    start_route = "#/project/kundenportal/requests"

    def visit(self, route):
        self.page.goto(self.url + "#/project/kundenportal/" + route)

    def scoped_fixture(self):
        self.page.evaluate("""() => {
          const p=project();
          p.nfrs.forEach(record=>record.targets=[]);
          Object.assign(p.nfrs[0], {
            title:'Zeit bis zur Übergabe',requirement:'Die Übergabeliste reagiert auf den Filter.',
            acceptance:'95 von 100 Abrufen dauern höchstens 2 Sekunden.',
            targets:[{kind:'item',id:'UC-09'},{kind:'map',id:'SM-01'}]
          });
          Object.assign(p.nfrs[1], {
            title:'Orientierung beim leeren Filter',
            targets:[{kind:'item',id:'UC-12'}]
          });
          persist();
        }""")

    def create_draft(self):
        self.main.get_by_role("button", name="Feature Request erstellen").click()
        self.dialog.locator('[name="uc"]').select_option("UC-09")
        self.dialog.get_by_label("Auftragstitel").fill("Fallliste übergeben")
        self.dialog.locator('button[type="submit"]').click()
        expect(self.main.get_by_role("heading", name="Fallliste übergeben", exact=True)).to_be_visible()

    def export(self, button):
        with self.page.expect_download() as download:
            button.click()
        return json.loads(download.value.path().read_text(encoding="utf-8-sig"))["package"]

    def edit_acceptance(self):
        self.visit("backlog/nfrs")
        self.main.get_by_role("button", name="Zeit bis zur Übergabe", exact=True).click()
        self.dialog.get_by_label("Messbares Abnahmekriterium").fill("99 von 100 Abrufen dauern höchstens 1 Sekunde.")
        self.dialog.get_by_role("button", name="NFR speichern").click()

    def test_draft_reloads_current_nfr_criteria_and_excludes_other_pbis(self):
        self.scoped_fixture()
        self.create_draft()
        expect(self.main.get_by_role("heading", name="Nichtfunktionale Anforderungen", exact=True)).to_be_visible()
        expect(self.main).to_contain_text("95 von 100 Abrufen dauern höchstens 2 Sekunden.")
        expect(self.main).to_contain_text("SM-01")
        expect(self.main).not_to_contain_text("Orientierung beim leeren Filter")
        self.edit_acceptance()
        self.visit("request/FR-025")
        expect(self.main).to_contain_text("99 von 100 Abrufen dauern höchstens 1 Sekunde.")
        expect(self.main).not_to_contain_text("95 von 100 Abrufen dauern höchstens 2 Sekunden.")

    def test_frozen_revision_preserves_nfr_content_sources_and_export_after_edit(self):
        self.scoped_fixture()
        self.create_draft()
        self.main.locator('[data-action="release-request"]').click()
        frozen = self.export(self.main.get_by_role("button", name="JSON exportieren"))
        self.assertIn("nfrs", frozen, "Each newly released package must state its exact NFR scope")
        self.assertEqual([record["id"] for record in frozen["nfrs"]], ["NFR-01"])
        first = frozen["nfrs"][0]
        self.assertEqual(first["acceptance"], "95 von 100 Abrufen dauern höchstens 2 Sekunden.")
        self.assertEqual({(item["kind"], item["id"]) for item in first["sources"]}, {("item","UC-09"), ("map","SM-01")})
        self.assertIn("performance-efficiency", first["categories"])
        self.edit_acceptance()
        self.visit("request/FR-025")
        expect(self.main).to_contain_text("NFR-Arbeitsstand hat sich seit der Freigabe geändert")
        expect(self.main).to_contain_text(first["acceptance"])
        expect(self.main).not_to_contain_text("99 von 100")
        self.assertEqual(self.export(self.main.get_by_role("button", name="JSON exportieren")), frozen)
        self.main.get_by_role("button", name="An Factory übergeben").click()
        self.main.locator('[data-action="simulate-worker"]').click()
        self.main.locator('[data-action="simulate-success"]').click()
        self.main.get_by_role("button", name="Fachliche Review öffnen").click()
        nfrs = self.main.locator('details').filter(has=self.page.locator('summary',has_text='Nichtfunktionale Anforderungen'))
        nfrs.locator('summary').click()
        expect(nfrs).to_contain_text(first["acceptance"])
        expect(nfrs.get_by_role("checkbox")).to_have_count(0)
        self.main.get_by_role("button", name="Änderung anfragen").click()
        self.dialog.get_by_label("Befund und erwartetes Ergebnis").fill("Lieferumfang überarbeiten.")
        self.dialog.get_by_role("button", name="Änderung dokumentieren").click()
        self.main.get_by_role("button", name="Folgerevision vorbereiten").click()
        expect(self.main).to_contain_text("99 von 100 Abrufen")
        self.assertEqual(self.export(self.main.get_by_role("button", name="Paket exportieren")), frozen)

    def test_historical_missing_scope_is_distinguished_from_recorded_empty_scope(self):
        self.scoped_fixture()
        self.page.evaluate("() => {delete getRequest('FR-024').snapshot.nfrs;persist();}")
        self.visit("request/FR-024")
        expect(self.main).to_contain_text("Für diese Revision ist kein NFR-Stand überliefert.")
        self.assertNotIn("nfrs", self.export(self.main.get_by_role("button", name="JSON exportieren")))
        self.page.evaluate("() => {project().nfrs.forEach(record=>record.targets=[]);persist();}")
        self.visit("requests")
        self.create_draft()
        self.main.locator('[data-action="release-request"]').click()
        expect(self.main).to_contain_text("Bei der Freigabe waren diesem PBI keine NFRs zugeordnet.")
        self.assertEqual(self.export(self.main.get_by_role("button", name="JSON exportieren"))["nfrs"], [])

    def test_followup_draft_of_seeded_request_is_not_refrozen_by_reload(self):
        self.scoped_fixture()
        self.visit("review/FR-024")
        self.main.get_by_role("button", name="Änderung anfragen").click()
        self.dialog.get_by_label("Befund und erwartetes Ergebnis").fill("Kriterien präzisieren.")
        self.dialog.get_by_role("button", name="Änderung dokumentieren").click()
        self.main.get_by_role("button", name="Folgerevision vorbereiten").click()
        self.page.reload()
        expect(self.main).to_contain_text("Paketvorschau")
        expect(self.main).not_to_contain_text("Paketstand fixiert")
        expect(self.main).to_contain_text("95 von 100 Abrufen dauern höchstens 2 Sekunden.")

