from playwright.sync_api import expect

from browser_case import BrowserCase


class GitHistoryTest(BrowserCase):
    start_route = "#/project/kundenportal/doc/PRD-03"

    def test_selected_commit_and_worktree_have_distinct_comparisons(self):
        self.main.get_by_role("button", name="Git History", exact=True).click()
        history = self.main.get_by_role("region", name="Versionsauswahl", exact=True)
        self.assertEqual(history.count(), 1, "History needs a labelled list of available versions")
        worktree = history.get_by_role("button", name="Arbeitsstand vergleichen")
        comparison = self.main.get_by_role("region", name="Versionsvergleich", exact=True)
        expect(worktree).to_have_attribute("aria-pressed", "true")
        expect(comparison.get_by_text("Keine Unterschiede", exact=True)).to_be_visible()
        revision = history.get_by_role("button", name="Ausgangsstand im Vault erfasst", exact=False)
        revision.click()
        expect(revision).to_have_attribute("aria-pressed", "true")
        expect(comparison.get_by_text("Neue Datei", exact=True)).to_be_visible()
        self.assertGreater(comparison.locator(".diff-add").count(), 0)
        worktree.click()
        expect(worktree).to_be_focused()
        expect(comparison.get_by_text("Keine Unterschiede", exact=True)).to_be_visible()

    def test_commit_dialog_returns_to_timeline_and_fits_a_phone(self):
        self.page.set_viewport_size({"width":390,"height":760})
        self.main.get_by_role("button", name="Bearbeiten", exact=True).click()
        self.main.get_by_label("Titel", exact=True).fill("Geänderte Übergabe")
        self.main.get_by_role("button",name="Änderungen speichern",exact=True).click()
        self.main.get_by_role("button", name="Git History", exact=True).click()
        self.main.get_by_role("button", name="Commit erstellen").click()
        self.dialog.get_by_label("Commit-Nachricht").fill("Titel überarbeitet")
        self.dialog.get_by_role("button", name="Commit speichern").click()
        versions = self.dialog.get_by_role("region", name="Versionsauswahl", exact=True)
        self.assertEqual(versions.count(), 1, "The commit dialog must return to the shared timeline")
        expect(versions.get_by_role("button", name="Titel überarbeitet", exact=False)).to_have_attribute("aria-pressed", "true")
        comparison = self.dialog.get_by_role("region", name="Versionsvergleich")
        expect(comparison.locator(".diff-add").filter(has_text="Geänderte Übergabe")).to_be_visible()
        self.assertLessEqual(self.dialog.evaluate("e=>e.scrollWidth"),self.dialog.evaluate("e=>e.clientWidth+1"))
