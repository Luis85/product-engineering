
"""Normalized note-based entity and relationship edits through the Domainmodel forms."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class DomainEditing(BrowserCase):
    start_route = "#/project/admin-console/domainmodel"

    def command(self, key, id=""):
        self.assertTrue(self.page.evaluate("typeof domainFormAction==='function'"), "The domain editing commands must be available")
        self.page.evaluate("([key,id])=>domainFormAction(key,id)",[key,id])

    def save(self):
        self.dialog.locator('button[type="submit"]').click()

    def entity(self, name, body=""):
        self.command("domain-new-entity")
        self.dialog.locator('[name="title"]').fill(name)
        self.dialog.locator('[name="body"]').fill(body)
        self.save()
        return self.page.evaluate("name=>project().docs.find(d=>d.kind==='Entität'&&d.title===name).id",name)

    def relation(self, source, target, verb, description=""):
        self.command("domain-new-relation",source)
        self.dialog.locator('[name="verb"]').fill(verb)
        self.dialog.locator('[name="toId"]').select_option(target)
        self.dialog.locator('[name="description"]').fill(description)
        self.dialog.locator('[name="fromCard"]').select_option("1")
        self.dialog.locator('[name="toCard"]').select_option("0..*")
        self.save()
        return self.page.evaluate("([id,verb])=>getDoc(id).domainRelations.find(e=>e.verb===verb).id",[source,verb])

    def test_entities_remain_real_notes_with_editable_attributes_and_stable_identity(self):
        self.command("domain-new-entity")
        self.dialog.locator('[name="title"]').fill("Kundenorganisation")
        body="## Definition\n\nEin vertraglicher Kunde.\n\n## Herkunft\n\n[[JOB-12]] bleibt erhalten."
        self.dialog.locator('[name="body"]').fill(body)
        self.dialog.get_by_role("button",name="Attribut hinzufügen").click()
        self.dialog.get_by_label("Attributname",exact=True).fill("Kundennummer")
        self.dialog.get_by_label("Bedeutung",exact=True).fill("Eindeutige Kennung")
        self.save()
        entity=self.page.evaluate("project().docs.find(d=>d.title==='Kundenorganisation')")
        self.assertEqual((entity["kind"],entity["body"],entity["rev"]),("Entität",body,1))
        self.assertEqual(entity["domainAttributes"],[{"name":"Kundennummer","description":"Eindeutige Kennung"}])
        self.assertEqual(entity["owner"],"")
        self.assertTrue(self.page.url.endswith("/domainmodel/"+entity["id"]))
        self.command("domain-edit-entity",entity["id"])
        self.save()
        self.assertEqual(self.page.evaluate("id=>getDoc(id).rev",entity["id"]),1)
        self.command("domain-edit-entity",entity["id"])
        self.dialog.locator('[name="title"]').fill("Organisation")
        self.dialog.get_by_role("button",name="Attribut entfernen").click()
        self.save()
        revised=self.page.evaluate("id=>getDoc(id)",entity["id"])
        self.assertEqual((revised["rev"],revised["body"],revised["domainAttributes"]),(2,body,[]))

    def test_direction_cardinalities_duplicates_and_reparenting_are_canonical(self):
        a=self.entity("Auftrag")
        b=self.entity("Kunde")
        eid=self.relation(a,b,"gehört zu","Im Vertrag hinterlegt")
        self.command("domain-new-relation",a)
        self.dialog.locator('[name="toId"]').select_option(b)
        self.dialog.locator('[name="verb"]').fill(" Gehört   zu ")
        self.save()
        expect(self.dialog.get_by_role("alert")).to_contain_text("bereits")
        self.page.keyboard.press("Escape")
        other=self.relation(a,b,"wird betreut durch")
        reverse=self.relation(b,a,"gehört zu")
        self_link=self.relation(a,a,"ersetzt")
        self.assertEqual(len({eid,other,reverse,self_link}),4)
        self.command("domain-edit-relation",eid)
        expect(self.dialog.locator('[name="description"]')).to_have_value("Im Vertrag hinterlegt")
        self.dialog.locator('[name="fromId"]').select_option(b)
        self.dialog.locator('[name="verb"]').fill("kennt")
        self.dialog.locator('[name="fromCard"]').select_option("0..1")
        self.dialog.locator('[name="toCard"]').select_option("1..*")
        self.save()
        old=self.page.evaluate("id=>getDoc(id).domainRelations",a)
        current=self.page.evaluate("id=>getDoc(id).domainRelations",b)
        self.assertFalse(any(link["id"]==eid for link in old))
        link=next(link for link in current if link["id"]==eid)
        self.assertEqual((link["verb"],link["fromCard"],link["toCard"],link["toId"]),("kennt","0..1","1..*",b))
        self.assertTrue(self.page.url.endswith("/domainmodel/"+b))

    def test_archive_restore_and_confirmed_removal_keep_the_authoritative_notes(self):
        a=self.entity("Vorgang"); b=self.entity("Kontakt")
        edge=self.relation(a,b,"betrifft")
        self.command("domain-edit-entity",b)
        self.dialog.locator('[name="body"]').fill("Ein ungespeicherter Entwurf")
        self.dialog.get_by_role("button",name="Entität archivieren").click()
        confirm=self.page.locator("#domain-confirm")
        confirm.get_by_role("button",name="Abbrechen",exact=True).click()
        expect(self.dialog.locator('[name="body"]')).to_have_value("Ein ungespeicherter Entwurf")
        self.dialog.get_by_role("button",name="Entität archivieren").click()
        confirm.get_by_role("button",name="Archivieren",exact=True).click()
        self.assertTrue(self.page.evaluate("id=>getDoc(id).domainArchived",b))
        self.assertFalse(self.page.evaluate("id=>domainEdges().some(edge=>edge.id===id)",edge))
        self.assertEqual(len(self.page.evaluate("id=>getDoc(id).domainRelations",a)),1)
        self.command("domain-restore-entity",b)
        self.assertFalse(self.page.evaluate("id=>!!getDoc(id).domainArchived",b))
        self.assertTrue(self.page.evaluate("id=>domainEdges().some(edge=>edge.id===id)",edge))
        self.command("domain-remove-relation",edge)
        confirm.get_by_role("button",name="Abbrechen",exact=True).click()
        self.assertEqual(len(self.page.evaluate("id=>getDoc(id).domainRelations",a)),1)
        self.command("domain-remove-relation",edge)
        confirm.get_by_role("button",name="Beziehung entfernen",exact=True).click()
        self.page.reload()
        self.assertEqual(self.page.evaluate("id=>getDoc(id).domainRelations",a),[])
        self.assertEqual(self.page.evaluate("id=>getDoc(id).title",b),"Kontakt")
        recreated=self.relation(a,b,"wird erneut geprüft durch")
        self.assertNotEqual(recreated,edge,"A removed relationship ID must not be reassigned to a new relationship")

    def test_relation_rejects_a_project_change_and_an_unknown_endpoint(self):
        a=self.entity("Dokument"); b=self.entity("Abschnitt")
        self.command("domain-new-relation",a)
        self.dialog.locator('[name="toId"]').select_option(b)
        self.dialog.locator('[name="verb"]').fill("enthält")
        self.page.evaluate("""() => {
          const sel=document.querySelector('#dialog [name=toId]');sel.add(new Option('Extern','ENT-missing'));
          sel.value='ENT-missing';}""")
        self.save()
        expect(self.dialog.get_by_role("alert")).to_be_visible()
        self.assertEqual(self.page.evaluate("id=>getDoc(id).domainRelations",a),[])
        self.dialog.locator('[name="toId"]').select_option(b)
        self.page.evaluate("state.active='kundenportal'")
        self.save()
        expect(self.dialog.get_by_role("alert")).to_contain_text("Projekt")
        self.assertEqual(self.page.evaluate("id=>state.projects.find(p=>p.id==='admin-console').docs.find(d=>d.id===id).domainRelations",a),[])

