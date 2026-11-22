
"""Keyboard and responsive behavior of the contextual PBI companion chooser."""
import re

from playwright.sync_api import expect

from browser_case import BrowserCase


class CompanionChooser(BrowserCase):
    start_route = "#/project/kundenportal/backlog/board"

    def open_chooser(self,pbi):
        trigger=self.main.locator(f'[data-board-card="{pbi}"]').get_by_role("button",name="Begleititem erfassen",exact=True)
        trigger.click()
        return trigger

    def test_each_choice_explains_its_purpose_and_keyboard_opens_unassigned_form(self):
        trigger=self.open_chooser("UC-09")
        expect(self.dialog).to_contain_text("Gefilterte Servicefälle exportieren")
        expect(self.dialog).to_contain_text("UC-09")
        for index,(kind,purpose) in enumerate([("Task","Arbeitsschritt"),("Issue","Hindernis"),("Frage","Antwort"),("Bug","erwarteten Verhalten")]):
            choice=self.dialog.get_by_role("button",name=f"{kind} erfassen",exact=True)
            if index: self.page.keyboard.press("Tab")
            expect(choice).to_be_focused()
            expect(choice).to_have_accessible_description(re.compile(purpose,re.I))
        self.page.keyboard.press("Enter")
        expect(self.dialog.get_by_role("heading")).to_have_text("Bug erfassen · UC-09")
        expect(self.dialog.get_by_label("Titel",exact=True)).to_be_focused()
        expect(self.dialog.get_by_label("Verantwortlich")).to_have_value("")
        self.page.keyboard.press("Escape")
        expect(trigger).to_be_focused()

    def test_choices_remain_distinct_and_fit_a_narrow_viewport(self):
        self.page.set_viewport_size({"width":320,"height":640})
        trigger=self.open_chooser("UC-12")
        expect(self.dialog).to_contain_text("Leere Trefferliste erklären")
        choices=[self.dialog.get_by_role("button",name=k+" erfassen",exact=True) for k in ["Task","Issue","Frage","Bug"]]
        paths=[choice.locator("svg").first.inner_html() for choice in choices]
        self.assertEqual(len(set(paths)),4,"The types must use their own established glyphs")
        for choice in choices:
            rect=choice.bounding_box()
            self.assertGreaterEqual(rect["height"],44)
        self.assertTrue(self.dialog.evaluate("el=>el.scrollWidth<=el.clientWidth+1"))
        choices[2].click()
        expect(self.dialog.get_by_role("heading")).to_have_text("Frage erfassen · UC-12")
        self.dialog.get_by_label("Titel",exact=True).fill("Welche Erklärung hilft bei null Treffern?")
        self.dialog.locator('button[type="submit"]').click()
        expect(trigger).to_be_focused()
        self.assertTrue(self.page.evaluate("project().work.some(x=>x.type==='Frage'&&x.parent==='UC-12'&&!x.owner)"))

