"""Edit a map's project foundations and hand only its selected sources downstream."""

from pathlib import Path

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class MapFoundationsTest(BrowserCase):
    start_route = "#/project/kundenportal/storymap/SM-01"

    def setUp(self):
        super().setUp()
        self.page.evaluate("""() => {
          const docs=project().docs;
          docs.push({...getDoc('JOB-12'),id:'JOB-21',title:'Übergabe gemeinsam prüfen'});
          docs.push({...getDoc('PRD-03'),id:'PRD-21',requirement:'REQ-21',title:'Übergabe freigeben'});
          docs.push({...getDoc('RES-14'),id:'RES-21',title:'Erhebung zur Übergabe',body:'Nur aus dem gewählten Interview.'});
          persist();render();
        }""")

    def edit(self):
        self.open_map_context("Grundlagen")
        action = self.main.get_by_role("button", name="Grundlagen bearbeiten", exact=True)
        self.assertEqual(action.count(), 1, "A map must expose editing even when no source is assigned")
        action.click()
        return self.dialog

    def select_reference(self, path=None, file=None):
        self.dialog.get_by_role("button", name="Verweis hinzufügen", exact=True).click()
        picker = self.page.get_by_role("dialog", name="Vault-Verweis auswählen")
        if file:
            picker.locator('input[id="vault-files"]').set_input_files(file)
        if path:
            picker.get_by_role("button", name=path, exact=True).click()
            picker.get_by_role("button", name="Verweis einfügen").click()
            expect(picker).not_to_be_visible()
        else:
            picker.get_by_role("button", name="Abbrechen").click()

    def test_nested_picker_and_outer_cancel_leave_the_map_untouched(self):
        self.page.set_viewport_size({"width":390,"height":800})
        form = self.edit()
        prd = form.get_by_role("combobox", name="PRD", exact=True)
        prd.select_option("PRD-21")
        form.get_by_role("checkbox", name="Übergabe gemeinsam prüfen", exact=False).check()
        self.select_reference()
        expect(prd).to_have_value("PRD-21")
        self.select_reference("RES-21.md")
        self.select_reference("RES-21.md")
        expect(form.get_by_role("button", name="Verweis auf RES-21.md entfernen")).to_have_count(1)
        self.assertLessEqual(form.evaluate("el=>el.scrollWidth"),form.evaluate("el=>el.clientWidth+1"))
        form.get_by_role("button", name="Abbrechen").click()
        self.page.reload()
        self.assertEqual(self.page.evaluate("currentStoryMap().prdId"),"PRD-03")
        self.assertEqual(self.page.evaluate("currentStoryMap().jobIds"),["JOB-12"])
        self.open_map_context("Grundlagen")
        expect(self.main.get_by_role("button", name="Erhebung zur Übergabe", exact=False)).to_have_count(0)

    def test_saved_prd_jobs_and_sources_survive_and_reach_pbi_and_prototype(self):
        form = self.edit()
        form.get_by_role("combobox", name="PRD", exact=True).select_option("PRD-21")
        form.get_by_role("checkbox", name="Offene Fälle verlässlich übergeben",exact=False).uncheck()
        form.get_by_role("checkbox", name="Übergabe gemeinsam prüfen",exact=False).check()
        self.select_reference("RES-21.md")
        self.select_reference("Interview.md",{"name":"Interview.md","mimeType":"text/markdown","buffer":b"Beleg aus der lokalen Datei."})
        form.get_by_role("button",name="Grundlagen speichern").click()
        self.page.reload()
        self.open_map_context("Grundlagen")
        scope=self.main.get_by_role("region",name="Grundlagen",exact=True)
        for label in ["Übergabe freigeben","Übergabe gemeinsam prüfen","Erhebung zur Übergabe","Interview.md"]:
            expect(scope.get_by_role("button",name=label,exact=False)).to_be_visible()
        scope.get_by_role("button",name="Interview.md").click()
        expect(self.page.locator("#vault-preview")).to_contain_text("Beleg aus der lokalen Datei.")
        self.page.keyboard.press("Escape")
        self.main.get_by_role("region",name="Erster nutzbarer Ablauf",exact=True).get_by_role("button",name="Fürs Backlog prüfen").click()
        first=self.main.locator('[data-review-card]').filter(has_text="Meine Fallübersicht sehen")
        first.get_by_role("button",name="PBI aus Story anlegen").click()
        expect(self.dialog.get_by_role("combobox",name="PRD-Anforderung")).to_have_value("PRD-21")
        expect(self.dialog.get_by_role("combobox",name="Job to Be Done")).to_have_value("JOB-21")
        self.page.keyboard.press("Escape")
        self.page.goto(self.url+self.start_route)
        self.open_map_context("Prototypen")
        self.main.get_by_role("button",name="Prototyp anlegen",exact=True).click()
        self.dialog.get_by_label("Titel",exact=True).fill("Interview erproben")
        self.dialog.get_by_label("Beschreibung",exact=True).fill("Übergabe anhand der Erhebung.")
        self.dialog.get_by_role("button",name="Briefing speichern").click()
        with self.page.expect_download() as downloaded:
            self.main.get_by_role("button",name="Briefing exportieren").click()
        content=Path(downloaded.value.path()).read_text(encoding="utf-8")
        self.assertIn("Nur aus dem gewählten Interview.",content)
        self.assertIn("Beleg aus der lokalen Datei.",content)

    def test_empty_map_can_save_remove_and_reject_stale_project(self):
        self.page.evaluate("currentStoryMap().prdId='';currentStoryMap().jobIds=[];persist();render()")
        form=self.edit()
        form.get_by_role("combobox",name="PRD",exact=True).select_option("PRD-03")
        form.get_by_role("checkbox",name="Offene Fälle verlässlich übergeben",exact=False).check()
        self.select_reference("RES-21.md")
        form.get_by_role("button",name="Grundlagen speichern").click()
        form=self.edit()
        form.get_by_role("combobox",name="PRD",exact=True).select_option("")
        form.get_by_role("checkbox",name="Offene Fälle verlässlich übergeben",exact=False).uncheck()
        form.get_by_role("button",name="Verweis auf RES-21.md entfernen").click()
        form.get_by_role("button",name="Grundlagen speichern").click()
        self.page.reload()
        self.open_map_context("Grundlagen")
        scope=self.main.get_by_role("region",name="Grundlagen",exact=True)
        expect(scope.get_by_role("button")).to_have_count(1)
        form=self.edit()
        form.get_by_role("combobox",name="PRD",exact=True).select_option("PRD-21")
        self.page.evaluate("state.active='admin-console'")
        form.get_by_role("button",name="Grundlagen speichern").click()
        self.assertFalse(self.page.evaluate("state.projects.some(p=>p.storyMaps.some(m=>m.prdId==='PRD-21'))"))
