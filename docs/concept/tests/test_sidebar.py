from playwright.sync_api import expect

from browser_case import BrowserCase


class SidebarTest(BrowserCase):
    def test_wide_workspace_fills_the_space_between_the_rail_and_right_edge(self):
        self.enable_demo_ai()
        for width in (1920, 2560):
            self.page.set_viewport_size({"width":width,"height":1000})
            collapse=self.page.get_by_role("button",name="Seitennavigation einklappen",exact=True)
            if collapse.is_visible():
                collapse.click()
            layout=self.page.locator(".layout").bounding_box()
            sidebar=self.page.locator("#sidebar").bounding_box()
            main=self.main.bounding_box()
            self.assertLessEqual(abs(main["x"]-sidebar["x"]-sidebar["width"]),2)
            self.assertLessEqual(abs(main["x"]+main["width"]-layout["x"]-layout["width"]),2)
            self.assertLessEqual(self.main.evaluate("el=>parseFloat(getComputedStyle(el).paddingLeft)"),32)
        self.page.get_by_role("button",name="KI-Copilot",exact=True).click()
        right_panel=self.page.locator("#inspector").bounding_box()
        main=self.main.bounding_box()
        self.assertLessEqual(abs(main["x"]+main["width"]-right_panel["x"]),2)
        expect(self.page.get_by_role("button",name="Seitennavigation ausklappen")).to_be_visible()

    def test_right_panel_is_exclusively_the_copilot_on_desktop_and_phone(self):
        self.enable_demo_ai()
        for width in (1440,390):
            self.page.set_viewport_size({"width":width,"height":800})
            self.assertEqual(self.page.get_by_role("button",name="Projektkontext",exact=True).count(),0,
                             "Project context has been removed from the app header")
            toggle=self.page.get_by_role("banner").get_by_role("button",name="KI-Copilot",exact=True)
            toggle.click()
            panel=self.page.locator("#inspector")
            expect(panel.get_by_role("heading",name="Projekt-Copilot")).to_be_visible()
            expect(panel.get_by_role("button",name="Projektkontext anzeigen")).to_have_count(0)
            panel.get_by_role("textbox",name="Nachricht").fill("Welche Randfälle sind offen?")
            panel.get_by_role("button",name="Senden",exact=True).click()
            expect(panel.get_by_role("log")).to_contain_text("Welche Randfälle sind offen?")
            expect(panel.locator('[data-ai-role="assistant"]').first).to_be_visible()
            panel.get_by_role("button",name="KI-Copilot schließen",exact=True).click()
            expect(toggle).to_be_focused()
            expect(toggle).to_have_attribute("aria-expanded","false")

    def test_pbi_markdown_export_is_available_on_the_item_without_a_context_panel(self):
        self.page.goto(self.url+"#/project/kundenportal/usecase/UC-09")
        export=self.main.get_by_role("button",name="Markdown exportieren",exact=True)
        self.assertEqual(export.count(),1,"The PBI export needs to stay reachable on the item")
        with self.page.expect_download() as event:
            export.click()
        self.assertEqual(event.value.suggested_filename,"UC-09.md")
        self.assertTrue(event.value.path().is_file())

    def test_compacting_the_sidebar_preserves_an_unsaved_document_and_project_picker(self):
        self.page.goto(self.url + "#/project/kundenportal/doc/PRD-03")
        self.main.get_by_role("button", name="Notiz bearbeiten").click()
        editor = self.main.get_by_role("textbox", name="Inhalt", exact=True)
        editor.fill("Unveröffentlichte Notiz")
        self.page.get_by_role("button", name="Seitennavigation einklappen", exact=True).click()
        expect(editor).to_have_text("Unveröffentlichte Notiz")
        nav = self.page.get_by_role("navigation", name="Projektbereiche")
        expect(nav.get_by_role("button", name="Wissen", exact=True)).to_have_attribute("aria-current", "page")
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        expect(self.dialog.get_by_role("button", name="Admin Console")).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(editor).to_have_text("Unveröffentlichte Notiz")
        self.main.get_by_role("button", name="Änderungen speichern").click()
        self.page.set_viewport_size({"width": 320, "height": 700})
        self.page.get_by_role("button", name="Projektnavigation öffnen").click()
        expect(nav.get_by_text("Wissen", exact=True)).to_be_visible()
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    def test_desktop_rail_remembers_state_and_mobile_drawer_keeps_labels(self):
        nav = self.page.get_by_role("navigation", name="Projektbereiche")
        toggle = self.page.get_by_role("button", name="Seitennavigation einklappen", exact=True)
        self.assertEqual(toggle.count(), 1, "Desktop navigation should offer a collapse control")
        width = self.main.bounding_box()["width"]
        toggle.click()
        expand = self.page.get_by_role("button", name="Seitennavigation ausklappen", exact=True)
        expect(expand).to_be_focused()
        expect(expand).to_have_attribute("aria-expanded", "false")
        self.assertGreater(self.main.bounding_box()["width"], width + 90)
        nav.get_by_role("button", name="Wissen", exact=True).click()
        self.page.reload()
        expect(expand).to_be_visible()
        self.page.set_viewport_size({"width":390,"height":760})
        self.page.get_by_role("button", name="Projektnavigation öffnen").click()
        expect(nav.get_by_text("Wissen", exact=True)).to_be_visible()
        nav.get_by_role("button", name="Story Maps", exact=True).click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Story Maps")
        self.page.set_viewport_size({"width":1360,"height":850})
        expand.click()
        expect(toggle).to_have_attribute("aria-expanded", "true")
