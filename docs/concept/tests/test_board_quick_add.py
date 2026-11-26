"""Author work and collapse the outer Kanban lanes without changing the items."""

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class BoardQuickAddTest(BrowserCase):
    start_route = "#/project/kundenportal/backlog/board"

    def test_default_backlog_and_explicit_view_links(self):
        self.page.goto(self.url + "#/project/kundenportal/overview")
        self.page.get_by_role("navigation", name="Projektbereiche").get_by_role("button", name="Backlog", exact=True).click()
        views = self.main.get_by_role("group", name="Ansicht wählen")
        self.assertEqual(views.get_by_role("button").all_inner_texts(), ["Board", "Liste", "NFRs", "Deliverables"])
        expect(views.get_by_role("button", name="Board")).to_have_attribute("aria-pressed", "true")
        for name, path in [("Liste", "list"), ("NFRs", "nfrs"), ("Deliverables", "deliverables"), ("Board", "board")]:
            views.get_by_role("button", name=name).click()
            self.assertTrue(self.page.url.endswith("/backlog/" + path))
            self.page.reload()
            expect(views.get_by_role("button", name=name)).to_have_attribute("aria-pressed", "true")
        self.page.go_back()
        expect(views.get_by_role("button", name="Deliverables")).to_have_attribute("aria-pressed", "true")

    def test_each_card_can_add_all_companion_kinds_to_its_own_pbi(self):
        card = self.main.locator('[data-board-card="UC-09"]')
        add = card.get_by_role("button", name="Begleititem erfassen", exact=True)
        self.assertEqual(add.count(), 1, "The card needs a contextual companion action")
        for kind in ["Task", "Issue", "Bug", "Frage"]:
            add.click()
            self.dialog.get_by_role("button", name=kind + " erfassen").click()
            expect(self.dialog.get_by_role("combobox", name="Verantwortlich")).to_have_value("")
            self.dialog.get_by_label("Titel", exact=True).fill("Vom Board " + kind)
            self.dialog.locator("button[type=submit]").click()
            expect(add).to_be_focused()
        self.page.reload()
        card.get_by_role("button", name="Gefilterte Servicefälle exportieren").click()
        self.main.get_by_role("button", name="Begleititems", exact=True).click()
        for kind in ["Task", "Issue", "Bug", "Frage"]:
            expect(self.main.get_by_role("row").filter(has_text="Vom Board " + kind)).to_contain_text("Nicht zugewiesen")

    def test_backlog_lane_can_create_a_visible_pbi_from_an_empty_filter_result(self):
        self.main.get_by_label("Backlog durchsuchen").fill("Kein passender Eintrag")
        lane = self.main.get_by_role("region", name="Backlog", exact=True)
        add = lane.get_by_role("button", name="PBI anlegen", exact=True)
        self.assertEqual(add.count(), 1, "A filtered empty Backlog lane still offers creation")
        add.click()
        self.dialog.get_by_label("Titel", exact=True).fill("Eintrag aus Spalte")
        self.dialog.locator("button[type=submit]").click()
        expect(self.main.get_by_role("button", name="Board", exact=True)).to_have_attribute("aria-pressed", "true")
        expect(lane.get_by_role("button", name="Eintrag aus Spalte", exact=True)).to_be_focused()
        self.page.reload()
        expect(lane.get_by_role("button", name="Eintrag aus Spalte")).to_be_visible()

    def test_two_lanes_collapse_independently_and_accept_moved_cards(self):
        backlog = self.main.get_by_role("region", name="Backlog", exact=True)
        done = self.main.get_by_role("region", name="Done", exact=True)
        early = backlog.get_by_role("button", name="Backlog einklappen", exact=False)
        self.assertEqual(early.count(), 1, "Backlog has a keyboard fold control")
        before = backlog.bounding_box()["width"]
        early.press("Enter")
        expect(backlog.get_by_role("button", name="Backlog ausklappen", exact=False)).to_have_attribute("aria-expanded", "false")
        self.assertLess(backlog.bounding_box()["width"], before * .75)
        done.get_by_role("button", name="Done einklappen", exact=False).click()
        self.page.reload()
        for lane, name in [(backlog, "Backlog"), (done, "Done")]:
            expect(lane.get_by_role("button", name=name + " ausklappen", exact=False)).to_have_attribute("aria-expanded", "false")
        self.main.get_by_role("combobox", name="UC-09 verschieben").select_option("Erledigt")
        done.get_by_role("button", name="Done ausklappen", exact=False).click()
        card = done.locator('[data-board-card="UC-09"]')
        expect(card).to_be_visible()
        card.drag_to(backlog)
        backlog.get_by_role("button", name="Backlog ausklappen", exact=False).click()
        expect(backlog.locator('[data-board-card="UC-09"]')).to_be_visible()

    def test_phone_fold_controls_and_separate_project_preferences(self):
        self.page.set_viewport_size({"width":390,"height":844})
        done = self.main.get_by_role("region", name="Done", exact=True)
        toggle = done.get_by_role("button", name="Done einklappen", exact=False)
        self.assertEqual(toggle.count(), 1, "The phone exposes the same fold control")
        toggle.click()
        self.assertLess(done.bounding_box()["height"], 100)
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        self.page.goto(self.url + "#/project/admin-console/backlog/board")
        expect(done.get_by_role("button", name="Done einklappen", exact=False)).to_have_attribute("aria-expanded", "true")
        expect(self.main.get_by_role("button", name="PBI anlegen", exact=True)).to_have_count(1)
        self.page.goto(self.url + self.start_route)
        expect(done.get_by_role("button", name="Done ausklappen", exact=False)).to_have_attribute("aria-expanded", "false")
