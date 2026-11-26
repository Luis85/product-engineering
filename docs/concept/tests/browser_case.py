"""Isolated Chromium sessions for the standalone HTML clickdummy."""

import os
import re
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


class BrowserCase(unittest.TestCase):
    start_route = "#/project/kundenportal/overview"

    @classmethod
    def setUpClass(cls):
        runtime = sync_playwright().start()
        cls.addClassCleanup(runtime.stop)
        edge = Path(os.environ.get("ProgramFiles(x86)", ".")) / "Microsoft/Edge/Application/msedge.exe"
        executable = os.environ.get("CLICKDUMMY_BROWSER") or (str(edge) if edge.is_file() else None)
        cls.browser = runtime.chromium.launch(executable_path=executable)
        cls.addClassCleanup(cls.browser.close)
        default = Path(__file__).resolve().parents[1] / "Product-Engineering-Clickdummy-Story-Maps.html"
        cls.url = Path(os.environ.get("CLICKDUMMY_HTML", default)).resolve().as_uri()

    def setUp(self):
        context = self.browser.new_context(viewport={"width": 1440, "height": 900})
        self.addCleanup(context.close)
        self.page = context.new_page()
        self.page.set_default_timeout(3000)
        self.page.set_default_navigation_timeout(15000)
        self.page.goto(self.url + self.start_route)
        self.main = self.page.get_by_role("main")
        self.dialog = self.page.locator("#dialog")

    def open_map_context(self, label):
        controls = self.main.get_by_role("group", name="Map-Kontext", exact=True)
        button = controls.get_by_role("button", name=re.compile("^" + re.escape(label) + r" \d+$"))
        if button.get_attribute("aria-expanded") != "true":
            button.click()

    def enable_demo_ai(self):
        original = self.page.url
        project_id = original.split("#/project/", 1)[-1].split("/", 1)[0]
        self.page.goto(self.url + "#/project/" + project_id + "/plugin-settings")
        self.main.get_by_role("checkbox", name="KI-Copilot aktivieren", exact=True).check()
        self.main.get_by_role("combobox", name="Betriebsart", exact=True).select_option("demo")
        self.main.get_by_role("button", name="Einstellungen speichern", exact=True).click()
        self.page.goto(original)

    def open_note_actions(self):
        menu = self.main.locator("details.note-actions")
        if menu.get_attribute("open") is None:
            menu.locator("summary").click()
