"""Start research or derive requirements from a job without a backlog dependency."""

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class JobResearchTest(BrowserCase):
    start_route = "#/project/kundenportal/doc/JOB-12"

    def start(self, action):
        button = self.main.get_by_role("button", name=action, exact=True)
        self.assertEqual(button.count(), 1, f"A job needs a visible {action} action")
        button.click()

    def save_draft(self, title, body):
        self.dialog.get_by_label("Titel", exact=True).fill(title)
        self.dialog.get_by_role("button", name="Entwurf im Editor öffnen").click()
        self.main.locator("[data-rich-editor]").fill(body)
        self.main.get_by_role("button", name="Änderungen speichern").click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text(title)

    def test_research_is_a_linked_draft_and_can_return_to_its_job_after_reload(self):
        self.page.evaluate("project().useCases=[]; persist(); render()")
        self.start("Research starten")
        self.save_draft("Beobachtung der Spätschicht", "Drei Fälle wurden einzeln übertragen.")
        self.assertTrue(self.page.evaluate("getDoc(ui.id).kind==='Research' && getDoc(ui.id).status==='Entwurf'"))
        self.page.reload()
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        self.main.locator('[data-action="open-doc"][data-id="JOB-12"]').click()
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        self.start("Research starten")
        self.dialog.get_by_role("button", name="Abbrechen").click()
        self.assertEqual(self.main.get_by_role("button", name="PRD ableiten", exact=True).count(), 1)
        self.main.get_by_role("button", name="Beobachtung der Spätschicht", exact=False).click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Beobachtung der Spätschicht")

    def test_derived_prd_preserves_the_origin_and_accepts_other_project_jobs(self):
        self.page.evaluate("""() => {
          project().docs.push({...getDoc('JOB-12'),id:'JOB-97',title:'Anfragen vorab klären'});
          persist();render();
        }""")
        self.start("PRD ableiten")
        expect(self.dialog.get_by_role("checkbox", name="Offene Fälle verlässlich übergeben", exact=False)).to_be_checked()
        self.assertEqual(self.dialog.get_by_role("combobox", name="Produktvision").input_value(), "VIS-01")
        self.dialog.get_by_role("checkbox", name="Anfragen vorab klären", exact=False).check()
        self.save_draft("Weiterer Lieferumfang", "Die nächste Schicht kennt die offenen Anfragen.")
        self.page.reload()
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        for id in ("VIS-01", "JOB-12", "JOB-97"):
            expect(self.main.locator(f'article [data-action="open-doc"][data-id="{id}"]')).to_be_visible()
        self.main.locator('[data-action="open-doc"][data-id="JOB-12"]').click()
        self.main.get_by_role("button", name="Verknüpfungen", exact=True).click()
        expect(self.main.locator('article [data-action="open-doc"][data-id="PRD-03"]')).to_be_visible()
        expect(self.main.get_by_role("button", name="Weiterer Lieferumfang", exact=False)).to_be_visible()

    def test_cancel_and_stale_project_context_never_create_research(self):
        count = self.page.evaluate("project().docs.length")
        self.start("Research starten")
        self.dialog.get_by_label("Titel", exact=True).fill("Verwerfen")
        self.page.keyboard.press("Escape")
        self.assertEqual(self.page.evaluate("project().docs.length"), count)
        self.start("Research starten")
        self.dialog.get_by_label("Titel", exact=True).fill("Darf nicht übertragen werden")
        self.page.evaluate("state.active='admin-console'")
        self.dialog.get_by_role("button", name="Entwurf im Editor öffnen").click()
        self.assertFalse(self.page.evaluate("state.projects.some(p=>p.docs.some(d=>d.title==='Darf nicht übertragen werden'))"))
