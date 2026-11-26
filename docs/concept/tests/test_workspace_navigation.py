"""Navigation should keep users at the record or control they were working with."""

from playwright.sync_api import expect

from browser_case import BrowserCase


class WorkspaceNavigationTest(BrowserCase):
    def test_priority_table_gives_the_item_title_the_mobile_row_width(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        table = self.main.get_by_role("region", name="Priorisierte Use-Cases", exact=True)
        row = table.locator("tbody tr").first
        cells = row.locator("td")
        self.assertGreaterEqual(cells.first.bounding_box()["width"], row.bounding_box()["width"] - 32)
        self.assertEqual([c.get_attribute("data-overview-label") for c in cells.all()[1:]],
                         ["Priorität", "Backlog", "Lieferstand"])
        row.get_by_role("button").first.click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Gefilterte Servicefälle exportieren")

    def test_keyboard_back_restores_library_and_slice_controls_at_their_reading_position(self):
        self.page.set_viewport_size({"width": 390, "height": 760})
        for route, selector in [("knowledge", ".library-entry:nth-last-child(1)"),
                                ("storymap/SM-01", '#story-node-SL-02 [data-action="sm-review"]')]:
            with self.subTest(route=route):
                self.page.goto(self.url + "#/project/kundenportal/" + route)
                control = self.main.locator(selector).last
                control.focus()
                control.scroll_into_view_if_needed()
                before = self.page.evaluate("scrollY")
                self.assertGreater(before, 100)
                control.press("Enter")
                expect(self.main.get_by_role("heading", level=1)).to_be_focused()
                self.page.go_back()
                expect(control).to_be_focused()
                self.assertAlmostEqual(self.page.evaluate("scrollY"), before, delta=24)

    def test_skip_link_moves_focus_to_the_page_heading(self):
        self.page.keyboard.press("Tab")
        skip = self.page.get_by_role("link", name="Zum Arbeitsbereich")
        expect(skip).to_be_focused()
        skip.press("Enter")
        expect(self.main.get_by_role("heading", level=1)).to_be_focused()

    def test_scrolled_copilot_keeps_cancel_in_view_while_waiting_for_the_next_reply(self):
        self.page.set_viewport_size({"width": 1338, "height": 700})
        self.enable_demo_ai()
        self.page.goto(self.url + "#/project/kundenportal/doc/PRD-03")
        self.page.get_by_role("banner").get_by_role("button", name="KI-Copilot", exact=True).click()
        panel = self.page.locator("#inspector")
        prompt = panel.get_by_role("textbox", name="Nachricht", exact=True)
        send = panel.get_by_role("button", name="Senden", exact=True)
        for count, question in enumerate(["Wie soll die Übergabe erfolgen?", "Welche Ergebnisse sind zu erwarten?"], 1):
            prompt.fill(question)
            send.click()
            expect(panel.locator('[data-ai-role="assistant"]')).to_have_count(count)
        # Keep one request pending long enough to inspect and use its cancellation control.
        self.page.evaluate("() => { aiRunTurn=()=>new Promise(()=>{}); }")
        prompt.fill("Eine weitere Rückfrage")
        send.scroll_into_view_if_needed()
        self.assertGreater(panel.locator(".inspector-inner").evaluate("el=>el.scrollTop"), 40)
        send.click()
        cancel = panel.get_by_role("button", name="Abbrechen", exact=True)
        self.assertLessEqual(cancel.bounding_box()["y"] + cancel.bounding_box()["height"], 701)
        cancel.click()
        expect(prompt).to_have_value("Eine weitere Rückfrage")
