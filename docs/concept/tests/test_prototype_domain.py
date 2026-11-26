"""Prototype briefs distinguish scoped domain knowledge from neighboring entities."""

from pathlib import Path

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class PrototypeDomainTest(BrowserCase):
    start_route = "#/project/kundenportal/prototypes"

    def setUp(self):
        super().setUp()
        self.page.evaluate("""() => {
          const model=(id,title,body,extra={})=>({kind:'Entität',id,title,body,rev:1,status:'Entwurf',
            owner:'',domainAttributes:[],domainTargets:[],domainRelations:[],...extra});
          const edge=(id,toId,verb)=>({id,toId,verb,fromCard:'1',toCard:'0..*',description:'Nur nach Freigabe der Leitung.'});
          project().docs.push(
            model('ENT-91','Einsatzgruppe','Eine koordinierende Gruppe für diese Übergabe.',{
              domainAttributes:[{name:'Freigabecode',description:'Kennung auf dem Laufzettel.'}],
              domainTargets:[{kind:'item',id:'UC-09'},{kind:'map',id:'SM-01'},{kind:'prd',id:'PRD-03'}],
              domainRelations:[edge('REL-91','ENT-92','bestätigt')]}),
            model('ENT-92','Übergabestelle','Außerhalb liegende Detaildefinition.',{
              domainRelations:[edge('REL-92','ENT-93','meldet weiter an')]}),
            model('ENT-93','Nebenverwaltung','Nur aus zweiter Nachbarschaft.'));
          project().nfrs.push({id:'NFR-99',title:'Schnelle Freigabe',requirement:'Die Anzeige wird aktualisiert.',
            acceptance:'Innerhalb einer Sekunde.',owner:'',categories:[],targets:[{kind:'item',id:'UC-09'}]});
          state.projects.find(p=>p.id==='admin-console').docs.push(model('ENT-91','Fremde Einsatzgruppe','Nur im anderen Projekt.'));
          persist();render();
        }""")

    def create(self, scope):
        self.page.goto(self.url+self.start_route)
        self.main.get_by_role("button",name="Prototyp anlegen").click()
        self.dialog.get_by_label("Titel",exact=True).fill("Ablauf erproben")
        self.dialog.get_by_role("combobox",name="Umfang").select_option(scope)
        self.dialog.get_by_label("Beschreibung",exact=True).fill("Den Schichtwechsel mit dem Team durchspielen.")
        self.dialog.get_by_role("button",name="Briefing speichern").click()

    def export(self):
        with self.page.expect_download() as download:
            self.main.get_by_role("button",name="Briefing exportieren").click()
        return Path(download.value.path()).read_text(encoding="utf-8")

    def test_scopes_export_directed_relationships_and_only_one_hop_of_context(self):
        for scope in ["item:UC-09", "map:SM-01", "nfr:NFR-99"]:
            with self.subTest(scope=scope):
                self.create(scope)
                context=self.main.get_by_role("region",name="Domainkontext",exact=True)
                self.assertEqual(context.count(),1,"The saved briefing must show its domain context")
                for value in ["Einsatzgruppe","Freigabecode","Übergabestelle","bestätigt","0..*","Nur nach Freigabe der Leitung."]:
                    expect(context).to_contain_text(value)
                expect(context.get_by_role("heading",name="Nachbarn außerhalb des Umfangs")).to_be_visible()
                text=self.export()
                self.assertEqual(text.count("Eine koordinierende Gruppe für diese Übergabe."),1)
                self.assertIn("Kennung auf dem Laufzettel.",text)
                self.assertRegex(text,r"Einsatzgruppe[^\n]*bestätigt[^\n]*Übergabestelle")
                self.assertIn("0..*",text)
                self.assertTrue("UC-09" in context.inner_text() or "SM-01" in context.inner_text() or "PRD-03" in context.inner_text())
                for excluded in ["Außerhalb liegende Detaildefinition.","Nebenverwaltung","meldet weiter an","Nur im anderen Projekt."]:
                    self.assertNotIn(excluded,text)

    def test_relevant_edge_and_assignment_changes_invalidate_old_output(self):
        self.enable_demo_ai()
        self.create("map:SM-01")
        run=self.main.get_by_role("button",name="Agentenlauf simulieren")
        run.click()
        self.page.evaluate("getDoc('ENT-92').body='Geänderter Nachbartext';getDoc('ENT-93').body='Unabhängige Änderung';persist()")
        self.page.reload()
        expect(self.main.get_by_text("Klickbar",exact=True)).to_be_visible()
        self.page.evaluate("getDoc('ENT-91').domainRelations[0].toCard='1..*';persist()")
        self.page.reload()
        expect(self.main.get_by_text("Briefing geändert",exact=True)).to_be_visible()
        run.click()
        self.page.evaluate("getDoc('ENT-91').domainTargets=[];persist()")
        self.page.reload()
        expect(self.main.get_by_text("Briefing geändert",exact=True)).to_be_visible()
        self.assertNotIn("Eine koordinierende Gruppe für diese Übergabe.",self.export())

    def test_old_signatures_remain_current_when_no_entities_apply(self):
        self.enable_demo_ai()
        self.page.evaluate("project().docs.filter(d=>d.kind==='Entität').forEach(d=>d.domainTargets=[]);persist()")
        self.create("map:SM-01")
        self.main.get_by_role("button",name="Agentenlauf simulieren").click()
        for raw in (False,True):
            self.page.evaluate("""raw=>{
              const p=getProto(ui.id),v1=prototypeInputs(p);delete v1.domain;
              p.output.basis=raw?JSON.stringify(v1):prototypeBasis(v1);persist()
            }""",raw)
            self.page.reload()
            expect(self.main.get_by_text("Klickbar",exact=True)).to_be_visible()
            expect(self.main.get_by_role("region",name="Domainkontext",exact=True)).to_have_count(0)
