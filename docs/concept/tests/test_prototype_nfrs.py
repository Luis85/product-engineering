"""The prototype handoff includes precisely the quality requirements in its source scope."""

from pathlib import Path

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class PrototypeNfrTest(BrowserCase):
    start_route = "#/project/kundenportal/prototypes"

    def setUp(self):
        super().setUp()
        self.page.evaluate("""() => {
          const record=(id,title,acceptance,targets)=>({id,title,requirement:'Projektbezogene Qualitätsvorgabe',
            acceptance,owner:'',categories:['performance-efficiency'],targets});
          project().nfrs=[
            record('NFR-91','Antwortzeit beim Wechsel','95 % der Wechsel in zwei Sekunden.',
              [{kind:'item',id:'UC-09'},{kind:'map',id:'SM-01'}]),
            record('NFR-92','Bedienbare Übergabe','Jeder Schritt ist per Tastatur erreichbar.',
              [{kind:'map',id:'SM-01'}]),
            record('NFR-93','Andere Aufgabe','Diese Vorgabe ist nicht zugeordnet.',[])
          ];
          state.projects.find(p=>p.id==='admin-console').nfrs=[
            record('NFR-91','Fremdes Projekt','Vertrauliche Fremdprojekt-Vorgabe.',[{kind:'map',id:'SM-01'}])
          ];
          persist(); render();
        }""")

    def create(self, source):
        self.page.goto(self.url + self.start_route)
        self.main.get_by_role("button", name="Prototyp anlegen").click()
        self.dialog.get_by_label("Titel", exact=True).fill("Übergabe erproben")
        self.dialog.get_by_role("combobox", name="Umfang").select_option(source)
        self.dialog.get_by_label("Beschreibung", exact=True).fill("Zwei Schichten bearbeiten offene Fälle.")
        self.dialog.get_by_role("button", name="Briefing speichern").click()
        return self.main.locator("details.agent-brief")

    def markdown(self):
        with self.page.expect_download() as download:
            self.main.get_by_role("button", name="Briefing exportieren").click()
        return Path(download.value.path()).read_text(encoding="utf-8")

    def test_map_and_item_briefs_show_their_unique_requirements_and_export_criteria(self):
        for source in ("map:SM-01", "item:UC-09"):
            with self.subTest(source=source):
                brief = self.create(source)
                expect(brief.get_by_text("95 % der Wechsel in zwei Sekunden.", exact=True)).to_have_count(1)
                expect(brief.get_by_text("Jeder Schritt ist per Tastatur erreichbar.", exact=True)).to_be_visible()
                export = self.markdown()
                self.assertEqual(export.count("95 % der Wechsel in zwei Sekunden."), 1)
                self.assertIn("Jeder Schritt ist per Tastatur erreichbar.", export)
                self.assertNotIn("Diese Vorgabe ist nicht zugeordnet.", export)
                self.assertNotIn("Vertrauliche Fremdprojekt-Vorgabe.", export)

    def test_only_relevant_changes_invalidate_the_existing_output(self):
        self.enable_demo_ai()
        self.create("item:UC-09")
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        self.page.evaluate("project().nfrs[2].acceptance='Unabhängige Änderung'; persist()")
        self.page.reload()
        expect(self.main.get_by_text("Klickbar", exact=True)).to_be_visible()
        self.page.evaluate("project().nfrs[0].acceptance='99 % innerhalb einer Sekunde.'; persist()")
        self.page.reload()
        expect(self.main.get_by_text("Briefing geändert", exact=True)).to_be_visible()
        self.assertIn("99 % innerhalb einer Sekunde.", self.markdown())
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        self.page.evaluate("project().nfrs[1].targets=[]; persist()")
        self.page.reload()
        expect(self.main.get_by_text("Briefing geändert", exact=True)).to_be_visible()
        self.assertNotIn("Jeder Schritt ist per Tastatur erreichbar.", self.markdown())

    def test_an_nfr_can_be_the_brief_source_itself(self):
        brief = self.create("nfr:NFR-91")
        expect(brief.get_by_text("95 % der Wechsel in zwei Sekunden.", exact=True)).to_be_visible()
        self.assertEqual(self.markdown().count("95 % der Wechsel in zwei Sekunden."), 1)

    def test_preexisting_signatures_stay_current_if_no_requirement_applies(self):
        self.enable_demo_ai()
        self.page.evaluate("project().nfrs.forEach(n=>n.targets=[]);persist()")
        self.create("map:SM-01")
        self.main.get_by_role("button", name="Agentenlauf simulieren").click()
        for raw in (True, False):
            self.page.evaluate("""raw => {
              const p=getProto(ui.id), input=prototypeInputs(p), old={};
              for (const key of ['project','title','description','source','parentItems','relatedItems','documents','styleGuide','designSystem']) old[key]=input[key];
              p.output.basis=raw?JSON.stringify(old):prototypeBasis(old);persist();
            }""", raw)
            self.page.reload()
            expect(self.main.get_by_text("Klickbar", exact=True)).to_be_visible()
