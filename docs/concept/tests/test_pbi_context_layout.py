from browser_case import BrowserCase


class PbiContextLayoutTest(BrowserCase):
    start_route="#/project/kundenportal/usecase/UC-09"

    def test_related_pbi_actions_share_a_compact_area_at_desktop_width(self):
        sections=[
            self.main.locator('[data-prototype-source="item:UC-09"]'),
            self.main.locator('[data-nfr-source="item:UC-09"]'),
            self.main.locator('[data-entity-scope="item:UC-09"]'),
        ]
        tops=[section.bounding_box()["y"] for section in sections]
        self.assertLess(max(tops)-min(tops),5,"Related actions should not each consume a full desktop row")
        sections[0].get_by_role("button",name="Prototyp anlegen").click()
        self.assertEqual(self.dialog.get_by_role("combobox",name="Umfang").input_value(),"item:UC-09")
        self.page.keyboard.press("Escape")
        self.page.set_viewport_size({"width":320,"height":700})
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
