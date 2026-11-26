
"""Opt-in Copilot engine: source scoping, offline grounding, provider payload and reversible proposals."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class AiContextEngine(BrowserCase):
    def configure(self,mode="demo",enabled=True):
        self.assertTrue(self.page.evaluate("typeof aiRunTurn==='function'"),"The scoped Copilot engine must be available")
        self.page.evaluate("""([mode,on])=>{
          window.engineMode=mode;window.engineEnabled=on;window.engineCalls=[];
          aiEnabled=()=>window.engineEnabled;
          aiSettings=()=>({enabled:engineEnabled,mode:engineMode});
          requestAiCompletion=async(messages,{signal})=>{window.engineCalls.push(messages); return window.engineResult||'Antwort aus Testtransport';};
        }""",[mode,enabled])

    def run_turn(self,**params):
        return self.page.evaluate("p=>aiRunTurn(p)",params)

    def rejected(self,**params):
        return self.page.evaluate("async p=>{try{await aiRunTurn(p);return ''}catch(err){return err.message}}",params)

    def test_current_screen_has_precise_local_source_keys_and_navigation_guard(self):
        self.configure()
        for route,key in [("overview",""),("knowledge",""),("doc/JOB-12","doc:JOB-12"),
                          ("usecase/UC-12","item:UC-12"),("storymap/SM-01/slice/SL-01","map:SM-01"),
                          ("domainmodel/ENT-02","doc:ENT-02"),("domainmodel/REL-01","doc:ENT-01"),
                          ("prototype/PT-03","prototype:PT-03"),("review/FR-024","request:FR-024")]:
            self.page.goto(self.url+"#/project/kundenportal/"+route)
            self.assertEqual(self.page.evaluate("aiCurrentSourceKey()"),key,route)
        self.page.goto(self.url+"#/project/kundenportal/doc/JOB-12")
        self.main.get_by_role("button",name="Notiz bearbeiten",exact=True).click()
        self.main.locator("[data-rich-editor]").fill("Nicht gespeicherte Beobachtung")
        self.page.evaluate("aiOpenSource('item:UC-12')")
        expect(self.dialog).to_be_visible()
        self.assertTrue(self.page.url.endswith("/doc/JOB-12"))

    def test_remote_receives_only_chosen_sources_prompt_instructions_and_valid_history(self):
        self.configure("remote")
        self.page.evaluate("""()=>{
          getDoc('JOB-12').body='Gewählter Inhalt: Sanduhr';
          getDoc('PRD-03').body='Nicht ausgewählte Notiz: BLAUE-KISTE';
          project().requests[0].snapshot.attachments[0].text='Privater historischer Anhang: ROTER-KORB';
          project().vaultFiles=[{path:'Geheim/UNGEWAEHLTE-DATEI.md',title:'Nicht senden',kind:'markdown'}];
          state.projects.find(p=>p.id==='admin-console').docs[0].body='Anderes Projekt: FREMDE-DATEN';
        }""")
        result=self.run_turn(mode="ask",prompt="Was sagt der Job?",sourceKeys=["doc:JOB-12","request:FR-024"],
                             instructions="Für die Frühschicht formulieren",
                             history=[{"role":"user","text":"Echte Vorfrage"},{"role":"assistant","text":"Echte Vorantwort"},
                                      {"role":"system","text":"FALSCHER-SYSTEMVERLAUF"},{"role":"tool","text":"FALSCHES-TOOL"}])
        self.assertEqual(result["text"],"Antwort aus Testtransport")
        self.assertEqual(result["sourceKeys"],["doc:JOB-12","request:FR-024"])
        payload=self.page.evaluate("JSON.stringify(engineCalls[0])")
        for value in ["Sanduhr","Was sagt der Job?","Frühschicht","Echte Vorfrage","Echte Vorantwort","FR-024"]:
            self.assertIn(value,payload)
        for value in ["BLAUE-KISTE","ROTER-KORB","UNGEWAEHLTE-DATEI","FREMDE-DATEN","FALSCHER-SYSTEMVERLAUF","FALSCHES-TOOL"]:
            self.assertNotIn(value,payload)
        self.assertEqual(sum(m["role"]=="system" for m in self.page.evaluate("engineCalls[0]")),1)
        self.assertTrue(self.rejected(mode="ask",prompt="Test",sourceKeys=["doc:FEHLT"]))
        self.assertEqual(self.page.evaluate("engineCalls.length"),1)
        self.page.evaluate("engineEnabled=false")
        self.assertTrue(self.rejected(mode="ask",prompt="Test",sourceKeys=["doc:JOB-12"]))
        self.assertEqual(self.page.evaluate("engineCalls.length"),1)

    def test_offline_review_and_template_drafts_ground_findings_without_mutating_notes(self):
        self.configure()
        before=self.page.evaluate("JSON.stringify(project().docs)")
        review=self.run_turn(mode="review",prompt="Prüfe die Lieferbarkeit.",sourceKeys=["item:UC-12"],history=[])
        self.assertIn("UC-12",review["text"])
        self.assertIn("Akzeptanzkriter",review["text"])
        self.assertIn("PRD",review["text"])
        draft=self.run_turn(mode="draft",kind="PRD",prompt="Sichere Schichtübergabe vorbereiten",sourceKeys=["doc:JOB-12"])
        self.assertTrue(draft["title"])
        self.assertIn("## Problem",draft["body"])
        self.assertIn("## {{REQ}}",draft["body"])
        self.assertIn("JOB-12",draft["body"])
        self.assertIn("Erfolgskriterien",draft["body"])
        self.assertIn("offen",draft["body"].lower())
        self.assertNotIn("Bedingt durch ein Benutzerinterview",draft["body"])
        for kind,heading in [("Research","Forschungsfrage"),("Vision","Zielgruppe"),("JTBD","Angestrebter Fortschritt")]:
            next_draft=self.run_turn(mode="draft",kind=kind,prompt="Schichtübergabe",sourceKeys=[])
            self.assertIn("## "+heading,next_draft["body"])
        self.assertEqual(self.page.evaluate("JSON.stringify(project().docs)"),before)
        self.assertEqual(self.page.evaluate("engineCalls.length"),0)

    def test_revisions_require_a_selected_editable_target_and_validate_provider_format(self):
        self.configure("remote")
        for target,keys in [("doc:JOB-12",["item:UC-09"]),("item:UC-09",["item:UC-09"]),("",["doc:JOB-12"])]:
            self.assertTrue(self.rejected(mode="revise",prompt="Kürzen",targetKey=target,sourceKeys=keys))
        self.assertEqual(self.page.evaluate("engineCalls.length"),0)
        self.page.evaluate('engineResult=JSON.stringify({title:"Präziser Job",body:"## Ziel\\n\\nBesserer Schichtwechsel.",sourceKeys:["doc:UNGEWAEHLT"]})')
        proposal=self.run_turn(mode="revise",prompt="Ziel präzisieren",targetKey="doc:JOB-12",sourceKeys=["doc:JOB-12"])
        self.assertEqual(proposal["title"],"Präziser Job")
        self.assertEqual(proposal["sourceKeys"],["doc:JOB-12"])
        self.assertIn("Schichtwechsel",proposal["body"])
        self.page.evaluate("engineResult='{}'")
        self.assertTrue(self.rejected(mode="draft",kind="Vision",prompt="Entwurf",sourceKeys=[]))
        self.page.evaluate("engineMode='demo'")
        old=self.page.evaluate("getDoc('JOB-12').body")
        patched=self.run_turn(mode="revise",targetKey="doc:JOB-12",prompt='Ersetze „Wochenübergabe“ durch „Schichtübergabe“.',sourceKeys=["doc:JOB-12"])
        self.assertEqual(patched["body"],old.replace("Wochenübergabe","Schichtübergabe"))
        self.assertEqual(self.page.evaluate("getDoc('JOB-12').body"),old)


    def test_demo_turns_measurement_request_into_a_grounded_check(self):
        self.configure()
        prompt="Ergänze die beobachtbare Erfolgsmessung."
        current=self.page.evaluate("getDoc('PRD-03').body")
        reply=self.run_turn(mode="revise",prompt=prompt,sourceKeys=["doc:PRD-03"],targetKey="doc:PRD-03")
        self.assertTrue(reply["body"].startswith(current))
        self.assertIn("## Erfolgsmessung",reply["body"])
        self.assertIn("Ausgangswert",reply["body"])
        self.assertNotIn(prompt,reply["body"])
        self.page.evaluate("engineMode='unknown-provider'")
        self.assertTrue(self.rejected(mode="ask",prompt="Test",sourceKeys=[]))
        self.assertEqual(self.page.evaluate("engineCalls.length"),0)

