"""Entity knowledge notes retain their identity, authored prose and semantic links."""

from pathlib import Path

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class DomainNotesTest(BrowserCase):
    start_route = "#/project/kundenportal/knowledge"

    def entities(self):
        self.page.evaluate("""() => {
          const shared={kind:'Entität',owner:'',status:'Entwurf',rev:1};
          project().docs.push({...shared,id:'ENT-48',title:'Schichtgruppe',body:'Das Team für die nächste Schicht.',
            domainAttributes:[{name:'Gruppe: "intern"',description:'Lesbare Kennung der Gruppe.'}],
            domainRelations:[{id:'REL-48',toId:'ENT-49',verb:'bearbeitet',fromCard:'1',toCard:'0..*',
              description:'Ein Auftrag kann nach seiner Freigabe bearbeitet werden.'}]});
          project().docs.push({...shared,id:'ENT-49',title:'Schichtauftrag',body:'Ein Auftrag aus dem Portal.',
            domainAttributes:[],domainRelations:[]});persist();render();
        }""")

    def test_knowledge_creation_search_and_file_picker_share_the_same_entity(self):
        tab=self.main.get_by_role("button",name="Entität",exact=True)
        self.assertEqual(tab.count(),1,"Knowledge needs the Entität artifact type")
        tab.click()
        self.main.get_by_role("button",name="Entität anlegen",exact=True).click()
        self.dialog.get_by_label("Titel",exact=True).fill("Einsatzvertrag")
        self.dialog.get_by_role("button",name="Entwurf im Editor öffnen").click()
        self.main.get_by_role("textbox",name="Inhalt",exact=True).fill("Vertrag für einen Einsatz.")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        record_id=self.page.evaluate("ui.id")
        self.assertTrue(record_id.startswith("ENT-"))
        self.main.get_by_role("button",name="Im Domainmodel öffnen",exact=True).click()
        self.assertTrue(self.page.url.endswith("/domainmodel/"+record_id))
        self.assertEqual(self.page.evaluate("project().docs.filter(d=>d.title==='Einsatzvertrag').length"),1)
        self.page.keyboard.press("Control+k")
        self.dialog.get_by_role("searchbox").fill(record_id)
        self.dialog.get_by_role("button",name="Einsatzvertrag",exact=False).click()
        expect(self.main.get_by_role("heading",level=1)).to_have_text("Einsatzvertrag")
        self.main.get_by_role("button",name="Verknüpfungen",exact=True).click()
        self.main.get_by_role("button",name="Verweis hinzufügen",exact=True).click()
        picker=self.page.get_by_role("dialog",name="Vault-Verweis auswählen")
        expect(picker.get_by_role("button",name=record_id+".md",exact=True)).to_be_visible()

    def test_both_ends_name_the_same_relationship_and_renaming_keeps_one_link(self):
        self.entities()
        self.page.goto(self.url+"#/project/kundenportal/doc/ENT-48")
        expect(self.main.get_by_text("Lesbare Kennung der Gruppe.",exact=True)).to_be_visible()
        relation=self.main.get_by_role("region",name="Fachliche Beziehungen")
        expect(relation).to_contain_text("bearbeitet")
        expect(relation).to_contain_text("0..*")
        expect(relation).to_contain_text("Ein Auftrag kann nach seiner Freigabe bearbeitet werden.")
        relation.get_by_role("button",name="Schichtauftrag",exact=True).click()
        expect(relation).to_contain_text("Eingehend")
        self.main.get_by_role("button",name="Notiz bearbeiten",exact=True).click()
        self.main.get_by_label("Titel",exact=True).fill("Bestätigter Schichtauftrag")
        editor=self.main.get_by_role("textbox",name="Inhalt",exact=True)
        expect(editor).not_to_contain_text("bearbeitet")
        self.main.get_by_role("button",name="Änderungen speichern").click()
        self.page.reload()
        relation.get_by_role("button",name="Schichtgruppe",exact=True).click()
        expect(relation.get_by_role("button",name="Bestätigter Schichtauftrag",exact=True)).to_have_count(1)

    def test_markdown_and_git_include_quoted_properties_and_readable_relation(self):
        self.entities()
        self.page.goto(self.url+"#/project/kundenportal/doc/ENT-48")
        with self.page.expect_download() as event:
            self.open_note_actions()
            self.main.get_by_role("button",name="Notiz exportieren").click()
        exported=Path(event.value.path()).read_text(encoding="utf-8")
        header,body=exported.split("\n---\n",1)
        self.assertIn(r'Gruppe: \"intern\"',header)
        self.assertIn('"[[ENT-49]]"',header)
        for value in ("Das Team für die nächste Schicht.","Lesbare Kennung der Gruppe.","bearbeitet","[[ENT-49]]","0..*",
                      "Ein Auftrag kann nach seiner Freigabe bearbeitet werden."):
            self.assertIn(value,body)
        self.main.get_by_role("button",name="Git History",exact=True).click()
        self.main.get_by_role("button",name="Commit erstellen",exact=True).click()
        self.dialog.get_by_label("Commit-Nachricht").fill("Entität mit Beziehung")
        self.dialog.get_by_role("button",name="Commit speichern",exact=True).click()
        self.assertEqual(self.page.evaluate("project().git['ENT-48'][0].contents"),exported)
        self.assertEqual(self.page.evaluate("getDoc('ENT-48').body"),"Das Team für die nächste Schicht.")
