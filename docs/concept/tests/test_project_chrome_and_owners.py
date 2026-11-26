from playwright.sync_api import expect

from browser_case import BrowserCase


class ProjectChromeAndOwnersTest(BrowserCase):
    def test_navigation_shows_project_context_without_a_demo_tour_or_account(self):
        self.assertEqual(self.page.get_by_role("button",name="Demo-Ablauf",exact=True).count(),0)
        self.assertEqual(self.page.locator("#topbar .avatar").count(),0)
        expect(self.page.get_by_role("button",name="Projekt wechseln oder anlegen")).to_be_visible()
        self.page.set_viewport_size({"width":390,"height":780})
        self.page.get_by_role("button",name="Projektnavigation öffnen").click()
        expect(self.page.get_by_role("navigation",name="Projektbereiche")).to_be_visible()
        self.assertEqual(self.page.get_by_role("button",name="Demo-Ablauf",exact=True).count(),0)

    def test_new_knowledge_notes_default_to_unassigned_and_keep_an_explicit_assignment(self):
        for person,title in [("","Entwurf ohne Zuständigkeit"),("Lea Vogt","Zugewiesene Recherche")]:
            self.page.goto(self.url+"#/project/kundenportal/knowledge")
            self.main.get_by_role("button",name="Notiz anlegen",exact=True).click()
            owner=self.dialog.get_by_role("combobox",name="Verantwortlich",exact=True)
            expect(owner).to_have_value("")
            expect(owner.locator("option:checked")).to_have_text("Nicht zugewiesen")
            if person:
                owner.select_option(person)
            self.dialog.get_by_label("Titel",exact=True).fill(title)
            self.dialog.get_by_role("button",name="Entwurf im Editor öffnen").click()
            self.main.get_by_role("textbox",name="Inhalt",exact=True).fill("Beobachtung aus dem Pilotprojekt.")
            self.main.get_by_role("button",name="Änderungen speichern").click()
            self.page.reload()
            expect(self.main.locator(".artifact-meta")).to_contain_text(person or "Nicht zugewiesen")
