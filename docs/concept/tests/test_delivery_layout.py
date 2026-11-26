"""A phone can read every map source in the draft prototype briefing."""

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class DeliveryLayoutTest(BrowserCase):
    start_route="#/project/kundenportal/prototypes"

    def test_project_mcp_toggle_preserves_keyboard_focus(self):
        self.page.goto(self.url+"#/project/kundenportal/settings")
        self.main.get_by_role("button",name="Integrationen",exact=True).click()
        enable=self.main.get_by_role("button",name="MCP-Lesezugriff simulieren",exact=True)
        enable.press("Space")
        disable=self.main.get_by_role("button",name="MCP-Zugriff abschalten",exact=True)
        expect(disable).to_be_focused()
        disable.press("Space")
        expect(enable).to_be_focused()

    def test_mobile_map_sources_use_separate_readable_rows_in_the_brief(self):
        self.page.set_viewport_size({"width":390,"height":844})
        self.main.get_by_role("button",name="Prototyp anlegen",exact=True).click()
        self.dialog.get_by_label("Titel",exact=True).fill("Schichtwechsel prüfen")
        self.dialog.get_by_role("combobox",name="Umfang").select_option("map:SM-01")
        self.dialog.get_by_label("Beschreibung",exact=True).fill("Die verknüpften Grundlagen durchgehen.")
        self.dialog.get_by_role("button",name="Briefing speichern").click()
        brief=self.main.locator(".agent-brief")
        expect(brief).to_be_visible()
        expect(self.main.get_by_text("Briefing",exact=True)).to_have_count(1)
        links=brief.locator(".linked-items [data-action='open-doc']")
        self.assertGreaterEqual(links.count(),2)
        first,second=links.nth(0).bounding_box(),links.nth(1).bounding_box()
        self.assertGreaterEqual(second["y"],first["y"]+first["height"]-1,"Linked notes must not compete for half a value column")
        links.nth(1).focus()
        links.nth(1).press("Enter")
        expect(self.main.get_by_role("heading",level=1)).to_have_text("Offene Fälle verlässlich übergeben")
