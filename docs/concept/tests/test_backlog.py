"""Browser regressions for the standalone prototype (python -m unittest discover)."""
from browser_case import BrowserCase


class BacklogTest(BrowserCase):
    start_route = "#/project/kundenportal/backlog/list"

    def open_creation(self, kind):
        self.main.get_by_role("button", name="Neuer Eintrag", exact=True).click()
        self.dialog.locator('[data-action="new-' + kind + '"]').click()

    def board(self):
        self.main.get_by_role("button", name="Board", exact=True).click()

    def test_creation_label_and_default_owner(self):
        self.main.get_by_role("button", name="Neuer Eintrag", exact=True).click()
        self.assertEqual(self.dialog.locator('[data-action="new-pbi"]').inner_text(), "PBI anlegen")
        self.dialog.locator('[data-action="new-pbi"]').click()
        self.assertEqual(self.dialog.get_by_role("heading").inner_text(), "PBI anlegen")

    def test_create_an_unassigned_pbi_then_assign_and_clear_it(self):
        self.open_creation("pbi")
        who = self.dialog.get_by_label("Verantwortlich")
        self.assertEqual(who.input_value(), "")
        self.assertEqual(who.locator("option:checked").inner_text(), "Nicht zugewiesen")
        self.dialog.get_by_label("Titel").fill("Eintrag ohne Zuweisung")
        self.dialog.locator('[type="submit"]').click()
        uri = self.page.url
        for owner in ["Jonas Berg", ""]:
            self.page.reload()
            self.main.get_by_role("button", name="Bearbeiten", exact=True).click()
            self.main.get_by_label("Verantwortlich").select_option(owner)
            self.main.get_by_role("button", name="PBI speichern").click()
            self.page.goto(uri.split("#")[0] + "#/project/kundenportal/backlog/list")
            row = self.main.get_by_role("row").filter(has_text="Eintrag ohne Zuweisung")
            self.assertEqual(row.locator('[data-column="Verantwortlich"]').inner_text().strip(), owner or "Nicht zugewiesen")
            row.get_by_role("button", name="Eintrag ohne Zuweisung", exact=True).click()

    def test_optional_owner_for_epic_and_feature(self):
        for kind in ["epic", "feature"]:
            with self.subTest(kind=kind):
                self.page.goto(self.url + "#/project/kundenportal/backlog/list")
                self.page.reload()
                self.open_creation(kind)
                owner = self.dialog.locator('[name="owner"]')
                self.assertEqual(owner.count(), 1, "Backlog creation needs an optional owner")
                self.assertEqual(owner.input_value(), "")
                name = kind + " mit Zuständigkeit"
                self.dialog.get_by_label("Titel").fill(name)
                owner.select_option("Lea Vogt")
                self.dialog.locator('[type="submit"]').click()
                row = self.main.get_by_role("row").filter(has_text=name)
                self.assertEqual(row.locator('[data-column="Verantwortlich"]').inner_text().strip(), "Lea Vogt")
                row.get_by_role("button", name=name, exact=True).click()
                self.dialog.get_by_label("Verantwortlich").select_option("")
                self.dialog.locator('[type="submit"]').click()
                self.page.reload()
                self.assertIn("Nicht zugewiesen", row.locator('[data-column="Verantwortlich"]').inner_text())

    def test_board_has_six_lanes_and_persists_keyboard_and_drag_moves(self):
        self.board()
        board = self.main.locator(".backlog-board")
        names = ["Backlog", "Open", "In Progress", "Review", "In Development", "Done"]
        lanes = board.get_by_role("region")
        self.assertEqual(lanes.count(), 6, "All six workflow stages must remain visible")
        self.assertEqual([lane.get_attribute("aria-label") for lane in lanes.all()], names)
        card = board.locator('[data-board-card="UC-09"]')
        self.assertEqual(card.locator("xpath=ancestor::section[1]").get_attribute("aria-label"), "In Development")
        card.get_by_role("combobox").select_option(label="Review")
        self.assertTrue(board.get_by_role("region", name="Review", exact=True).get_by_text("UC-09", exact=True).is_visible())
        self.page.reload()
        self.board()
        card.drag_to(board.get_by_role("region", name="Done", exact=True))
        self.assertTrue(board.get_by_role("region", name="Done", exact=True).get_by_text("UC-09", exact=True).is_visible())
        self.main.get_by_role("button", name="Gefilterte Servicefälle exportieren", exact=True).click()
        self.main.get_by_role("button", name="Bearbeiten", exact=True).click()
        self.assertEqual(self.main.get_by_label("Backlog-Status").locator("option:checked").inner_text(), "Done")

    def test_new_pbi_starts_in_backlog(self):
        self.open_creation("pbi")
        self.dialog.get_by_label("Titel").fill("Neue Arbeit")
        self.dialog.locator('[type="submit"]').click()
        self.page.goto(self.url + "#/project/kundenportal/backlog")
        self.board()
        backlog = self.main.locator('.backlog-board section[aria-label="Backlog"]')
        self.assertEqual(backlog.count(), 1, "New work starts in a Backlog column")
        self.assertTrue(backlog.get_by_role("button", name="Neue Arbeit", exact=True).is_visible())

    def test_board_selection_survives_reload_and_browser_back(self):
        self.board()
        self.page.reload()
        self.assertEqual(self.main.get_by_role("button", name="Board", exact=True).get_attribute("aria-pressed"), "true")
        self.main.get_by_role("button", name="Gefilterte Servicefälle exportieren", exact=True).click()
        self.page.go_back()
        self.assertEqual(self.main.get_by_role("button", name="Board", exact=True).get_attribute("aria-pressed"), "true")

    def test_toolbar_keeps_views_and_create_together_and_filters_across_views(self):
        views = self.main.get_by_role("region", name="Backlog-Ansichten", exact=True)
        self.assertEqual(views.count(), 1, "Views and their primary action share a named area")
        self.assertTrue(views.get_by_role("button", name="Neuer Eintrag").is_visible())
        self.main.get_by_label("Backlog durchsuchen").fill("UC-09")
        self.board()
        self.assertEqual(self.main.get_by_label("Backlog durchsuchen").input_value(), "UC-09")
        self.assertEqual(self.main.get_by_label("Ebene", exact=True).count(), 0)
        self.assertEqual(self.main.get_by_role("button", name="Rückgängig").count(), 0)
        self.assertEqual(self.main.locator("[data-board-card]").count(), 1)
        self.main.get_by_role("button", name="Filter zurücksetzen").click()
        self.assertEqual(self.main.locator("[data-board-card]").count(), 3)
        for width in (390, 320):
            self.page.set_viewport_size({"width": width, "height": 844})
            for view in ("Liste", "Board"):
                views.get_by_role("button", name=view, exact=True).click()
                self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
                                f"{view} toolbar overflows at {width}px")


