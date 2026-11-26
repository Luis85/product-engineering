
"""Actors are project knowledge notes, distinct from both users and Story Map activities."""
from playwright.sync_api import expect

from browser_case import BrowserCase


class ActorNotesTest(BrowserCase):
    start_route = "#/project/kundenportal/knowledge"

    def visit(self, project, route):
        self.page.goto(f"{self.url}#/project/{project}/{route}")

    def create(self, name, subtype, body, project="kundenportal", filtered=False):
        self.visit(project, "knowledge")
        if filtered:
            self.main.get_by_role("button",name="Akteur",exact=True).click()
            self.main.get_by_role("button",name="Akteur anlegen",exact=True).click()
        else:
            self.main.get_by_role("button",name="Notiz anlegen",exact=True).click()
            opts=self.dialog.locator('[name="kind"] option[value="Akteur"]')
            self.assertEqual(opts.count(),1,"Akteur must be a normal Wissen template")
            self.dialog.locator('[name="kind"]').select_option("Akteur")
        selector=self.dialog.get_by_role("combobox",name="Akteurstyp",exact=True)
        expect(selector).to_be_visible()
        expect(self.dialog.locator('[name="owner"]')).to_have_value("")
        self.dialog.locator('[name="title"]').fill(name)
        selector.select_option(label=subtype)
        self.dialog.locator('button[type="submit"]').click()
        self.main.locator("[data-rich-editor]").fill(body)
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        expect(self.main.get_by_role("heading",name=name,exact=True)).to_be_visible()
        return self.page.url.split("/")[-1]

    def test_human_and_system_can_be_created_filtered_and_searched_as_notes(self):
        team_before=self.page.evaluate("JSON.stringify(project().team)")
        human=self.create("Schichtleitung","Mensch","Verantwortet die vollständige Fallübergabe.")
        self.assertTrue(human.startswith("AKT-"))
        system=self.create("Statusdienst","System","Meldet den aktuellen Fallstatus.",filtered=True)
        self.visit("kundenportal","knowledge")
        self.main.get_by_role("button",name="Akteur",exact=True).click()
        selector=self.main.get_by_role("combobox",name="Akteurstyp",exact=True)
        selector.select_option(label="System")
        expect(self.main.locator(f'[data-action="open-doc"][data-id="{system}"]')).to_be_visible()
        expect(self.main.locator(f'[data-action="open-doc"][data-id="{human}"]')).to_have_count(0)
        selector.select_option(label="Alle Akteurstypen")
        self.main.get_by_label("Wissen durchsuchen").fill("Mensch")
        expect(self.main.locator(f'[data-action="open-doc"][data-id="{human}"]')).to_be_visible()
        expect(self.main.locator(f'[data-action="open-doc"][data-id="{system}"]')).to_have_count(0)
        self.assertEqual(self.page.evaluate("JSON.stringify(project().team)"),team_before)
        record=self.page.evaluate("id=>getDoc(id)",system)
        self.assertEqual((record["kind"],record["actorType"],record["owner"]),("Akteur","system",""))

    def test_rename_and_type_edit_retain_id_and_change_only_actor_export_and_git(self):
        before=self.page.evaluate("itemMarkdown(getDoc('VIS-01'))")
        identifier=self.create("Erfassung","Mensch","Die Rolle erfasst Änderungen.")
        self.main.get_by_role("button",name="Git History",exact=True).click()
        self.main.locator('[data-action="git-commit"]').click()
        self.dialog.get_by_role("button",name="Commit speichern",exact=True).click()
        self.page.keyboard.press("Escape")
        self.assertIn("pe-actor-type: human",self.page.evaluate("id=>gitHead(id).contents",identifier))
        self.main.get_by_role("button",name="Bearbeiten",exact=True).click()
        self.main.get_by_role("combobox",name="Akteurstyp",exact=True).select_option(label="System")
        self.main.locator('[name="title"]').fill("Eingangsschnittstelle")
        self.main.locator("[data-rich-editor]").fill("Erfasst Änderungen aus dem Partnerportal.")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        expect(self.main.locator(".artifact-meta")).to_contain_text("System")
        self.assertEqual(self.page.url.split("/")[-1],identifier)
        with self.page.expect_download() as download:
            self.open_note_actions()
            self.main.get_by_role("button",name="Notiz exportieren",exact=True).click()
        md=download.value.path().read_text(encoding="utf-8-sig")
        self.assertIn(f"pe-id: {identifier}",md)
        self.assertIn("pe-actor-type: system",md)
        self.assertIn("Partnerportal",md)
        self.assertEqual(self.page.evaluate("itemMarkdown(getDoc('VIS-01'))"),before)
        self.page.reload()
        self.assertEqual(self.page.evaluate("id=>getDoc(id).actorType",identifier),"system")
        self.assertTrue(self.page.evaluate("id=>workingChanges(getDoc(id))",identifier))

    def test_actor_references_follow_the_note_in_map_foundations_and_stay_in_project(self):
        identifier=self.create("Portalvertretung","Mensch","Übernimmt eingehende Fälle.")
        self.visit("kundenportal","storymap/SM-01")
        self.open_map_context("Grundlagen")
        self.main.get_by_role("button",name="Grundlagen bearbeiten").click()
        self.dialog.get_by_role("button",name="Verweis hinzufügen").click()
        picker=self.page.locator("#vault-picker")
        picker.get_by_label("Vault durchsuchen").fill("Portalvertretung")
        picker.get_by_role("button",name=identifier+".md",exact=True).click()
        picker.get_by_role("button",name="Verweis einfügen",exact=True).click()
        self.dialog.locator('button[type="submit"]').click()
        refs=self.main.get_by_role("region",name="Grundlagen",exact=True)
        expect(refs).to_contain_text("Portalvertretung")
        self.visit("admin-console","knowledge")
        self.assertIsNone(self.page.evaluate("id=>getDoc(id)",identifier))
        self.assertIsNone(self.page.evaluate("id=>vaultResolve(id+'.md')",identifier))
        self.page.set_viewport_size({"width":320,"height":690})
        own=self.create("Rollenabgleich","System","Synchronisiert freigegebene Rollen.","admin-console")
        self.assertEqual(own,identifier)
        expect(self.main.locator(".artifact-meta")).to_contain_text("System")
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        self.visit("kundenportal","doc/"+identifier)
        expect(self.main.get_by_role("heading",name="Portalvertretung",exact=True)).to_be_visible()

