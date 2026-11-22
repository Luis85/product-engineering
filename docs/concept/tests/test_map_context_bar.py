"""The Story Map opens on the journey, with four independently reachable context areas."""

import re

from playwright.sync_api import expect

from browser_case import BrowserCase


class MapContextBarTest(BrowserCase):
    start_route = "#/project/kundenportal/storymap/SM-01"

    def context(self):
        controls = self.main.get_by_role("group", name="Map-Kontext", exact=True)
        self.assertEqual(controls.count(), 1, "The map needs a single compact context row")
        return controls

    def trigger(self, label):
        return self.context().get_by_role("button", name=re.compile("^" + label + r"\s+\d+"))

    def test_desktop_and_mobile_open_on_the_map_with_counts_and_no_stacked_panels(self):
        for width, height, first_slice_limit in [(1252, 816, 505), (390, 844, 850), (320, 760, 930)]:
            self.page.set_viewport_size({"width": width, "height": height})
            with self.subTest(width=width):
                controls = self.context()
                expect(controls.get_by_role("button")).to_have_count(4)
                rows = {round(button.bounding_box()["y"]) for button in controls.get_by_role("button").all()}
                self.assertEqual(len(rows), 1, "All four contexts should be visible together in a single row")
                for name in ["Grundlagen", "Prototypen", "NFRs", "Entitäten"]:
                    expect(self.trigger(name)).to_have_attribute("aria-expanded", "false")
                expect(self.main.get_by_role("button", name="Grundlagen bearbeiten")).to_have_count(0)
                expect(self.main.get_by_role("button", name="Prototyp anlegen")).to_have_count(0)
                self.assertLess(self.main.locator("#story-node-SL-01").bounding_box()["y"], first_slice_limit)
                self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)

    def test_keyboard_switches_only_one_area_and_restores_the_opening_control(self):
        foundations = self.trigger("Grundlagen")
        foundations.focus()
        self.page.keyboard.press("Enter")
        expect(self.main.get_by_role("region", name="Grundlagen", exact=True)).to_contain_text("PRD-03")
        self.trigger("Prototypen").click()
        expect(foundations).to_have_attribute("aria-expanded", "false")
        expect(self.main.get_by_role("button", name="Grundlagen bearbeiten")).to_have_count(0)
        create = self.main.get_by_role("button", name="Prototyp anlegen", exact=True)
        create.click()
        expect(self.dialog.get_by_role("combobox", name="Umfang")).to_have_value("map:SM-01")
        self.page.keyboard.press("Escape")
        expect(create).to_be_focused()
        self.page.keyboard.press("Escape")
        expect(self.trigger("Prototypen")).to_be_focused()
        expect(self.trigger("Prototypen")).to_have_attribute("aria-expanded", "false")

    def test_empty_map_allows_each_assignment_and_updates_its_count_without_losing_focus(self):
        self.page.goto(self.url + "#/project/kundenportal/storymaps")
        self.main.get_by_role("button", name="Story Map erstellen", exact=True).click()
        self.dialog.get_by_label("Name der Story Map").fill("Neue Übergabe")
        self.dialog.get_by_label("Zielgruppe").fill("Service")
        self.dialog.get_by_label("Nutzerziel").fill("Aufträge weitergeben")
        self.dialog.get_by_role("button", name="Story Map erstellen", exact=True).click()
        for name in ["Grundlagen", "Prototypen", "NFRs", "Entitäten"]:
            expect(self.trigger(name)).to_have_accessible_name(re.compile(r"\b0$"))
        self.trigger("Grundlagen").click()
        self.main.get_by_role("button", name="Grundlagen bearbeiten").click()
        self.dialog.get_by_role("combobox", name="PRD", exact=True).select_option("PRD-03")
        self.dialog.get_by_role("button", name="Grundlagen speichern").click()
        expect(self.trigger("Grundlagen")).to_have_accessible_name(re.compile(r"\b1$"))
        expect(self.main.get_by_role("button", name="Grundlagen bearbeiten")).to_be_focused()
        for name, action in [("NFRs", "NFRs zuordnen"), ("Entitäten", "Entitäten zuordnen")]:
            self.trigger(name).click()
            assign = self.main.get_by_role("button", name=action, exact=True)
            assign.click()
            child = self.page.get_by_role("dialog", name=action, exact=True)
            child.get_by_role("checkbox").first.check()
            child.get_by_role("button", name="Zuordnung speichern").click()
            expect(assign).to_be_focused()
            expect(self.trigger(name)).to_have_accessible_name(re.compile(r"\b1$"))
            expect(self.trigger(name)).to_have_attribute("aria-expanded", "true")
