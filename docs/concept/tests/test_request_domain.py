
"""Domain evidence follows the current PBI until release and remains revision-bound afterwards."""
import json

from playwright.sync_api import expect

from browser_case import BrowserCase


class RequestDomainTest(BrowserCase):
    start_route = "#/project/kundenportal/requests"
    historical = "Für diese Revision ist kein Domainkontext überliefert."
    recorded_empty = "Bei der Freigabe waren diesem PBI keine Entitäten zugeordnet."
    drift = "Der Domainkontext im Projekt hat sich seit der Freigabe geändert."
    definition = "Eine Organisation ist der vertragliche Mandant für Servicefälle."
    revised = "Eine Organisation bezeichnet künftig einen Abrechnungsverbund."

    def go(self, route):
        self.page.goto(self.url + "#/project/kundenportal/" + route)

    def prepare_scope(self):
        self.page.evaluate("""definition => {
          const p=project();
          domainEntities().forEach(note=>note.domainTargets=[]);
          Object.assign(getDoc('ENT-01'),{
            body:definition,domainTargets:[{kind:'item',id:'UC-09'},{kind:'prd',id:'PRD-03'}]
          });
          p.docs.push({id:'ENT-99',kind:'Entität',title:'Nur anderer Umfang',body:'Diese Definition gehört zu einem anderen PBI.',
            rev:1,status:'Entwurf',domainAttributes:[],domainRelations:[],domainTargets:[{kind:'item',id:'UC-12'}]});
          projectNfrs().forEach(record=>record.targets=[]);
          projectNfrs()[0].targets=[{kind:'item',id:'UC-09'}];
          persist();
        }""", self.definition)

    def create(self):
        self.main.get_by_role("button", name="Feature Request erstellen").click()
        self.dialog.locator('[name="uc"]').select_option("UC-09")
        self.dialog.get_by_label("Auftragstitel").fill("Domainkontext zur Fallübergabe")
        self.dialog.locator('button[type="submit"]').click()

    def package(self, label="JSON exportieren"):
        with self.page.expect_download() as download:
            self.main.get_by_role("button", name=label).click()
        return json.loads(download.value.path().read_text(encoding="utf-8-sig"))["package"]

    def archive_entity(self):
        self.go("domainmodel/ENT-01")
        self.main.locator('[data-action="domain-archive-entity"]').click()
        self.page.locator("#domain-confirm").get_by_role("button",name="Archivieren",exact=True).click()

    def open_evidence(self, root):
        fold=root.locator("details").filter(has=self.page.locator('summary',has_text='Domainkontext'))
        fold.locator("summary").first.click()
        return fold

    def test_draft_uses_current_primary_entities_and_one_hop_only(self):
        self.prepare_scope()
        self.create()
        panel=self.main.get_by_role("region",name="Domainkontext",exact=True)
        expect(panel).to_contain_text(self.definition)
        expect(panel).to_contain_text("Kundenkennung")
        expect(panel).to_contain_text("Organisation")
        expect(panel).to_contain_text("umfasst")
        expect(panel).to_contain_text("0..*")
        expect(panel).not_to_contain_text("Nur anderer Umfang")
        self.go("domainmodel/ENT-01")
        self.main.locator('[data-action="domain-edit-entity"]').click()
        self.dialog.locator('[name="body"]').fill(self.revised)
        self.dialog.get_by_role("button",name="Änderungen speichern").click()
        self.go("request/FR-025")
        expect(panel).to_contain_text(self.revised)
        expect(panel).not_to_contain_text(self.definition)

    def test_release_export_and_review_keep_exact_entities_after_archive(self):
        self.prepare_scope()
        self.create()
        self.main.locator('[data-action="release-request"]').click()
        package=self.package()
        self.assertIn("domain",package)
        scope=package["domain"]
        self.assertEqual([note["id"] for note in scope["entities"]],["ENT-01"])
        note=scope["entities"][0]
        self.assertEqual(note["definition"],self.definition)
        self.assertIn({"name":"Kundenkennung","description":"Eindeutige Kennung des Kunden im Portal."},note["attributes"])
        self.assertEqual({(src["kind"],src["id"]) for src in note["sources"]},{("item","UC-09"),("prd","PRD-03")})
        self.assertEqual({other["id"] for other in scope["contextEntities"]},{"ENT-02","ENT-03"})
        self.assertEqual({edge["id"] for edge in scope["relationships"]},{"REL-01","REL-03"})
        edge=next(e for e in scope["relationships"] if e["id"]=="REL-01")
        self.assertEqual((edge["fromTitle"],edge["verb"],edge["toTitle"],edge["fromCard"],edge["toCard"]),
                         ("Organisation","umfasst","Servicefall","1","0..*"))
        self.assertEqual(edge["description"],"Ein Servicefall gehört genau einer Organisation.")
        self.assertEqual([n["id"] for n in package["nfrs"]],["NFR-01"])
        self.page.evaluate("() => {project().domainLayout={'ENT-01':{x:200,y:300}};persist();render()}")
        expect(self.main).not_to_contain_text(self.drift)
        self.archive_entity()
        self.go("request/FR-025")
        expect(self.main).to_contain_text(self.drift)
        self.assertEqual(self.package(),package)
        self.main.locator('[data-action="request-tab"][data-id="Nachweise"]').click()
        evidence=self.open_evidence(self.main)
        expect(evidence).to_contain_text(self.definition)
        expect(evidence.get_by_role("checkbox")).to_have_count(0)
        self.main.locator('[data-action="dispatch"]').click()
        self.main.locator('[data-action="simulate-worker"]').click()
        self.main.locator('[data-action="simulate-success"]').click()
        self.main.get_by_role("button",name="Fachliche Review öffnen").click()
        expect(self.open_evidence(self.main)).to_contain_text(self.definition)
        self.main.get_by_role("button",name="Änderung anfragen").click()
        self.dialog.locator('[name="reason"]').fill("Umfang für die Folgeversion überarbeiten.")
        self.dialog.get_by_role("button",name="Änderung dokumentieren").click()
        self.main.get_by_role("button",name="Folgerevision vorbereiten").click()
        expect(self.main).not_to_contain_text(self.definition)
        self.assertEqual(self.package("Paket exportieren"),package)

    def test_missing_history_is_distinct_from_a_release_with_no_entities(self):
        self.prepare_scope()
        self.page.evaluate("() => {delete getRequest('FR-024').snapshot.domain;persist()}")
        self.go("request/FR-024")
        expect(self.main).to_contain_text(self.historical)
        self.assertNotIn("domain",self.package())
        self.page.evaluate("() => {domainEntities().forEach(note=>note.domainTargets=[]);persist()}")
        self.go("requests")
        self.create()
        self.main.locator('[data-action="release-request"]').click()
        expect(self.main).to_contain_text(self.recorded_empty)
        self.assertEqual(self.package()["domain"],{"entities":[],"contextEntities":[],"relationships":[]})

