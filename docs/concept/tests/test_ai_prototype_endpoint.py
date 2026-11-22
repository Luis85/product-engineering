from playwright.sync_api import expect
from browser_case import BrowserCase


class AiPrototypeEndpointTest(BrowserCase):
    def test_explicit_generation_previews_the_payload_and_saves_returned_html(self):
        self.page.goto(self.url+"#/project/kundenportal/plugin-settings")
        enabled=self.main.get_by_role("checkbox",name="KI-Copilot aktivieren")
        self.assertEqual(enabled.count(),1,"Generation must go through plugin settings")
        enabled.check()
        self.main.get_by_role("combobox",name="Betriebsart").select_option("remote")
        endpoint="https://agent.example.invalid/v1/chat/completions"
        self.main.get_by_label("Endpoint",exact=True).fill(endpoint)
        self.main.get_by_label("Modell",exact=True).fill("test-agent")
        self.main.get_by_role("button",name="Einstellungen speichern").click()
        calls=[]
        def reply(route):
            calls.append(route.request.post_data_json)
            route.fulfill(json={"choices":[{"message":{"content":"<!doctype html><h1>Geprüfter Prototyp</h1>"}}]})
        self.page.route(endpoint,reply)
        self.page.goto(self.url+"#/project/kundenportal/prototypes")
        self.main.get_by_role("button",name="Prototyp anlegen").click()
        self.dialog.get_by_label("Titel",exact=True).fill("Übergabe ausprobieren")
        self.dialog.get_by_role("combobox",name="Umfang").select_option("item:UC-09")
        self.dialog.get_by_label("Beschreibung",exact=True).fill("Den Exportablauf durchspielen.")
        self.dialog.get_by_role("button",name="Briefing speichern").click()
        self.main.get_by_role("button",name="HTML mit KI erstellen",exact=True).click()
        expect(self.dialog).to_contain_text("agent.example.invalid")
        self.assertEqual(calls,[])
        self.dialog.get_by_role("button",name="Generierung starten",exact=True).click()
        expect(self.main.frame_locator("iframe").get_by_role("heading")).to_have_text("Geprüfter Prototyp")
        self.assertEqual(len(calls),1)
        self.assertIn("Den Exportablauf durchspielen.",str(calls[0]["messages"]))
        self.assertIn("UC-09",str(calls[0]["messages"]))
        self.page.reload()
        expect(self.main.frame_locator("iframe").get_by_role("heading")).to_have_text("Geprüfter Prototyp")
