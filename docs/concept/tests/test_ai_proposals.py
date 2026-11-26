from playwright.sync_api import expect
from browser_case import BrowserCase


class AiProposalTest(BrowserCase):
    def enable(self):
        self.page.goto(self.url+"#/project/kundenportal/plugin-settings")
        enabled=self.main.get_by_role("checkbox",name="KI-Copilot aktivieren")
        self.assertEqual(enabled.count(),1,"AI requires explicit plugin-wide activation")
        enabled.check()
        self.main.get_by_role("button",name="Einstellungen speichern").click()

    def propose(self,mode):
        self.enable()
        self.page.goto(self.url+"#/project/kundenportal/doc/"+("JOB-12" if mode=="draft" else "PRD-03"))
        self.page.get_by_role("banner").get_by_role("button",name="KI-Copilot",exact=True).click()
        self.panel=self.page.locator("#inspector")
        self.panel.get_by_role("combobox",name="Aufgabe").select_option(mode)
        if mode=="draft":
            self.panel.get_by_role("combobox",name="Vorlage").select_option("PRD")
        else:
            self.panel.get_by_role("combobox",name="Zielnotiz").select_option("doc:PRD-03")
        self.panel.get_by_role("textbox",name="Nachricht").fill("Bitte Erfolgskriterien für die Übergabe formulieren.")
        self.panel.get_by_role("button",name="Senden",exact=True).click()
        self.panel.get_by_role("button",name="Vorschlag prüfen",exact=True).click()

    def test_draft_is_previewed_editable_applied_once_and_linked_to_its_source(self):
        self.propose("draft")
        before=self.page.evaluate("project().docs.length")
        self.dialog.get_by_label("Titel",exact=True).fill("Prüfbare Übergabe")
        self.dialog.get_by_role("button",name="Abbrechen",exact=True).click()
        self.assertEqual(self.page.evaluate("project().docs.length"),before)
        self.panel.get_by_role("button",name="Vorschlag prüfen",exact=True).click()
        self.dialog.get_by_label("Titel",exact=True).fill("Prüfbare Übergabe")
        self.dialog.get_by_role("button",name="Als Entwurf speichern",exact=True).click()
        self.assertEqual(self.page.evaluate("project().docs.length"),before+1)
        record=self.page.evaluate("project().docs.find(d=>d.title==='Prüfbare Übergabe')")
        self.assertEqual((record["kind"],record["status"],record["owner"]),("PRD","Entwurf",""))
        self.assertIn("JOB-12",record["jobIds"])
        self.assertTrue(record["requirement"].startswith("REQ-"))
        self.assertNotIn("{{REQ}}",record["body"])
        expect(self.panel.get_by_role("button",name="Vorschlag prüfen",exact=True)).to_have_count(0)
        self.page.reload()
        self.assertEqual(self.page.evaluate("project().docs.filter(d=>d.title==='Prüfbare Übergabe').length"),1)

    def test_stale_revision_never_overwrites_a_newer_note(self):
        self.propose("revise")
        self.dialog.get_by_role("button",name="Abbrechen",exact=True).click()
        self.page.evaluate("""() => {const d=getDoc('PRD-03'); d.rev++;d.body='Neuere fachliche Entscheidung';persist();render();}""")
        self.panel.get_by_role("button",name="Vorschlag prüfen",exact=True).click()
        expect(self.dialog.get_by_role("button",name="Änderungen übernehmen",exact=True)).to_be_disabled()
        self.dialog.get_by_role("button",name="Als neue Notiz speichern",exact=True).click()
        self.assertEqual(self.page.evaluate("getDoc('PRD-03').body"),"Neuere fachliche Entscheidung")

    def test_revised_proposal_can_be_edited_and_explicitly_committed_as_the_same_note(self):
        self.propose("revise")
        previous=self.page.evaluate("getDoc('PRD-03').rev")
        self.dialog.get_by_label("Vorgeschlagener Inhalt").fill("## Erfolgskriterium\n\nDie Übergabe ist in zwei Minuten vollständig.")
        self.dialog.get_by_text("Mit der aktuellen Notiz vergleichen",exact=True).click()
        expect(self.dialog.locator(".ai-proposal-diff")).to_contain_text("in zwei Minuten")
        self.dialog.get_by_role("button",name="Änderungen übernehmen",exact=True).click()
        self.assertTrue(self.page.url.endswith("/doc/PRD-03"))
        expect(self.main).to_contain_text("Die Übergabe ist in zwei Minuten vollständig.")
        self.assertEqual(self.page.evaluate("getDoc('PRD-03').rev"),previous+1)
        self.assertEqual(self.page.evaluate("getDoc('PRD-03').status"),"Entwurf")
        self.main.get_by_role("button",name="Commit erstellen",exact=True).click()
        self.dialog.get_by_role("button",name="Commit speichern",exact=True).click()
        expect(self.dialog.get_by_role("region",name="Versionsvergleich")).to_contain_text("in zwei Minuten")

    def test_ai_off_hides_all_generation_entry_points_without_hiding_file_handoff(self):
        self.page.goto(self.url+"#/project/kundenportal/doc/PRD-03")
        self.assertEqual(self.page.get_by_role("banner").get_by_role("button",name="KI-Copilot",exact=True).count(),0)
        self.assertEqual(self.main.locator('[data-action="start-ai"]').count(),0)
        self.page.goto(self.url+"#/project/kundenportal/prototypes")
        self.main.get_by_role("button",name="Prototyp anlegen").click()
        self.dialog.get_by_label("Titel",exact=True).fill("Unabhängiges Briefing")
        self.dialog.get_by_role("combobox",name="Umfang").select_option("map:SM-01")
        self.dialog.get_by_label("Beschreibung",exact=True).fill("Übergabe prototypisieren")
        self.dialog.get_by_role("button",name="Briefing speichern").click()
        expect(self.main.get_by_role("button",name="Briefing exportieren")).to_be_visible()
        expect(self.main.get_by_role("button",name="HTML übernehmen")).to_be_visible()
        expect(self.main.get_by_role("button",name="Agentenlauf simulieren")).to_have_count(0)

    def test_reviews_render_as_readable_markdown_without_loading_embeds(self):
        self.enable()
        self.page.goto(self.url+"#/project/kundenportal/doc/PRD-03")
        self.open_note_actions()
        self.main.get_by_role("button",name="KI-Review",exact=True).click()
        side=self.page.locator("#inspector")
        side.get_by_role("textbox",name="Nachricht").fill("Prüfe die Erfolgskriterien.")
        side.get_by_role("button",name="Senden",exact=True).click()
        answer=side.locator('[data-ai-role="assistant"]').last
        expect(answer.get_by_role("heading",name="PRD-03 · Servicefälle übergeben")).to_be_visible()
        expect(answer.locator("img, iframe, script")).to_have_count(0)
