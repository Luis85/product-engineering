"""Release headers, narrative columns and touch controls in the map itself."""

import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class SliceLayoutTest(BrowserCase):
    start_route = "#/project/kundenportal/storymap/SM-01"
    first_title = "Erster nutzbarer Ablauf"

    def first_slice(self):
        return self.main.get_by_role("region", name=self.first_title, exact=True)

    def test_desktop_header_spans_the_board_and_actions_do_not_move_story_cells(self):
        self.page.set_viewport_size({"width": 1066, "height": 893})
        lane = self.first_slice()
        header = lane.locator("#story-node-SL-01")
        header.scroll_into_view_if_needed()
        self.assertGreaterEqual(header.bounding_box()["width"], lane.bounding_box()["width"] - 2)
        steps = self.main.locator(".sm-backbone .sm-step").all()
        cells = lane.locator(".sm-cell").all()
        self.assertEqual(len(steps), len(cells))
        for step, cell in zip(steps, cells):
            self.assertAlmostEqual(step.bounding_box()["x"], cell.bounding_box()["x"], delta=1)
        self.assertEqual(cells[2].locator(".sm-card").count(), 0)
        edit = header.get_by_role("button", name="Bearbeiten", exact=True)
        expect(edit).to_be_visible()
        offset = cells[0].bounding_box()["y"] - header.bounding_box()["y"]
        edit.focus()
        self.page.keyboard.press("Enter")
        expect(self.dialog.get_by_role("heading")).to_have_text("Lieferabschnitt bearbeiten")
        self.page.keyboard.press("Escape")
        expect(edit).to_be_focused()
        self.assertAlmostEqual(cells[0].bounding_box()["y"] - header.bounding_box()["y"], offset, delta=1)

    def test_reorder_edit_and_review_from_the_mobile_header(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        lane = self.first_slice()
        header = lane.locator("#story-node-SL-01")
        lower = header.get_by_role("button", name="Tiefer einordnen", exact=True)
        self.assertTrue(lower.is_visible(), "Reordering should be directly reachable on a touch layout")
        self.assertGreaterEqual(lower.bounding_box()["height"], 36)
        lower.click()
        expect(header).to_be_focused()
        self.assertEqual(self.main.locator(".sm-band").nth(1).get_attribute("aria-label"), self.first_title)
        expect(lane.locator(".sm-mobile-step").first).to_contain_text("Arbeit vorbereiten")
        header.get_by_role("button", name="Bearbeiten", exact=True).click()
        self.dialog.get_by_label("Titel", exact=True).fill("Übergabe bereitstellen")
        self.dialog.get_by_role("button", name="Änderungen speichern").click()
        header = self.main.locator("#story-node-SL-01")
        expect(header).to_be_focused()
        header.get_by_role("button", name="Fürs Backlog prüfen", exact=True).click()
        expect(self.main.get_by_role("heading", level=1)).to_have_text("Übergabe bereitstellen")
        self.assertTrue(self.page.url.endswith("/storymap/SM-01/slice/SL-01"))
        self.page.go_back()
        unscheduled = self.main.get_by_role("region", name="Ohne Lieferabschnitt")
        expect(unscheduled.get_by_role("button", name="Fürs Backlog prüfen")).to_have_count(0)
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 390)

    def test_review_remains_reachable_when_the_board_scrolls_horizontally(self):
        self.page.set_viewport_size({"width": 820, "height": 893})
        lane = self.first_slice()
        scroll = self.main.locator(".sm-scroll")
        review = lane.get_by_role("button", name="Fürs Backlog prüfen", exact=True)
        scroll_box = scroll.bounding_box()
        extent = scroll.evaluate("el => el.scrollWidth - el.clientWidth")
        self.assertGreater(extent, 0, "This viewport should exercise the desktop scrollable matrix")
        for offset in [0, extent]:
            scroll.evaluate("(el, left) => { el.scrollLeft = left; }", offset)
            box = review.bounding_box()
            self.assertGreaterEqual(box["x"], scroll_box["x"])
            self.assertLessEqual(box["x"] + box["width"], scroll_box["x"] + scroll_box["width"])


if __name__ == "__main__":
    unittest.main()
