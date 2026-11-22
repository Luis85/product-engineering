"""Domain navigation, semantic endpoints and existing-project migration."""
from playwright.sync_api import expect
from browser_case import BrowserCase


class DomainViewTest(BrowserCase):
    def test_model_lives_below_knowledge_and_uses_real_project_notes(self):
        nav=self.page.get_by_role("navigation",name="Projektbereiche")
        names=[button.get_attribute("aria-label") for button in nav.get_by_role("button").all()]
        self.assertEqual(names[names.index("Wissen")+1],"Domainmodel")
        nav.get_by_role("button",name="Domainmodel",exact=True).click()
        expect(self.main.get_by_role("heading",level=1)).to_have_text("Domainmodel")
        self.assertEqual(self.page.evaluate("domainEntities().map(n=>n.id)"),["ENT-01","ENT-02","ENT-03"])
        details=self.main.get_by_role("region",name="Auswahl im Domainmodel")
        details.get_by_role("button",name="Notiz öffnen",exact=True).click()
        expect(self.main.get_by_role("heading",level=1)).to_have_text("Organisation")
        self.main.get_by_role("button",name="Notiz bearbeiten").click()
        self.main.get_by_role("textbox",name="Titel",exact=True).fill("Kundenorganisation")
        self.main.get_by_role("button",name="Änderungen speichern").click()
        nav.get_by_role("button",name="Domainmodel",exact=True).click()
        expect(self.main.get_by_role("region",name="Auswahl im Domainmodel")).to_contain_text("Kundenorganisation")
        self.assertEqual(self.page.evaluate("domainEntities().length"),3)

    def test_relationship_can_be_read_and_deep_linked_from_either_entity(self):
        self.page.goto(self.url+"#/project/kundenportal/domainmodel/REL-01")
        details=self.main.get_by_role("region",name="Auswahl im Domainmodel")
        self.assertEqual(details.count(),1,"An ER relationship must have a readable inspector")
        expect(details).to_contain_text("umfasst")
        expect(details).to_contain_text("0..*")
        details.get_by_role("button",name="Servicefall",exact=True).click()
        expect(details.get_by_role("heading",name="Servicefall",exact=True)).to_be_visible()
        self.assertTrue(self.page.url.endswith("/domainmodel/ENT-02"))
        self.page.reload()
        expect(details.get_by_role("heading",name="Servicefall",exact=True)).to_be_visible()
        self.page.set_viewport_size({"width":390,"height":780})
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))

    def test_existing_empty_model_can_opt_into_demo_without_replacing_notes(self):
        self.page.evaluate("""() => {
            project().docs=project().docs.filter(d=>d.kind!=='Entität');
            project().docs.find(d=>d.id==='VIS-01').title='Persönliche Vision';
            persist();
        }""")
        self.page.goto(self.url+"#/project/kundenportal/domainmodel")
        self.page.reload()
        example=self.main.get_by_role("button",name="Beispielmodell laden",exact=True)
        self.assertEqual(example.count(),1,"Existing projects can opt into the example")
        example.click()
        expect(example).to_have_count(0)
        self.assertEqual(self.page.evaluate("getDoc('VIS-01').title"),"Persönliche Vision")
        self.assertEqual(self.page.evaluate("domainEdges().length"),3)
        self.page.goto(self.url+"#/project/admin-console/domainmodel")
        expect(self.main.get_by_role("heading",level=1)).to_have_text("Domainmodel")
        self.assertEqual(self.page.evaluate("domainEntities().length"),0)
        expect(self.main.get_by_role("button",name="Beispielmodell laden",exact=True)).to_have_count(0)
