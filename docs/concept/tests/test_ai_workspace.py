"""Project-local Copilot conversations, explicit sources, cancellation and proposals."""

import re

from playwright.sync_api import expect

from browser_case import BrowserCase


class AiWorkspaceTest(BrowserCase):
    def open_chat(self):
        self.page.get_by_role("banner").get_by_role("button", name="KI-Copilot", exact=True).click()
        self.panel = self.page.locator("#inspector")

    def sources(self):
        self.panel.get_by_role("button", name="Quellen wählen", exact=True).click()
        return self.page.get_by_role("dialog", name="Quellen und Projekthinweise", exact=True)

    def test_contextual_review_waits_for_submit_and_uses_the_actual_note(self):
        self.enable_demo_ai()
        self.page.goto(self.url + "#/project/kundenportal/doc/RES-14")
        self.main.get_by_text("Notizaktionen", exact=True).click()
        self.main.get_by_role("button", name="KI-Review", exact=True).click()
        self.panel = self.page.locator("#inspector")
        expect(self.panel.get_by_role("combobox", name="Aufgabe", exact=True)).to_have_value("review")
        expect(self.panel.get_by_role("region", name="Ausgewählte Quellen")).to_contain_text("RES-14")
        self.assertFalse(self.page.evaluate("!!project().aiThreads?.length"))
        expect(self.panel.locator("[data-ai-message]")).to_have_count(0)
        self.panel.get_by_role("button", name="Senden", exact=True).click()
        expect(self.panel.locator('[data-ai-role="assistant"]')).to_have_count(1)
        self.assertEqual(self.page.evaluate("project().aiThreads.length"), 1)
        self.assertIn("doc:RES-14", self.page.evaluate("aiProjectThread().messages.at(-1).sourceKeys"))

    def test_sources_project_instructions_threads_and_unsent_text_survive_reload(self):
        self.enable_demo_ai()
        self.open_chat()
        expect(self.panel.get_by_role("region", name="Ausgewählte Quellen")).to_contain_text("Keine Quellen")
        choices = self.sources()
        choices.get_by_role("checkbox", name=re.compile("JOB-12")).check()
        choices.get_by_role("textbox", name="Projekthinweise", exact=True).fill("Beispiele aus dem Service verwenden.")
        choices.get_by_role("button", name="Auswahl übernehmen").click()
        self.panel.get_by_role("textbox", name="Nachricht", exact=True).fill("Was wissen wir über die Übergabe?")
        self.panel.get_by_role("button", name="Senden", exact=True).click()
        expect(self.panel.locator('[data-ai-role="assistant"]')).to_have_count(1)
        self.panel.get_by_role("button", name="Neues Gespräch", exact=True).click()
        draft = self.panel.get_by_role("textbox", name="Nachricht", exact=True)
        draft.fill("Eine ungesendete Rückfrage")
        self.page.reload()
        self.open_chat()
        expect(draft).to_have_value("Eine ungesendete Rückfrage")
        expect(self.panel.locator("[data-ai-message]")).to_have_count(0)
        select = self.panel.get_by_role("combobox", name="Gespräch", exact=True)
        select.select_option(label="Was wissen wir über die Übergabe?")
        expect(self.panel.get_by_role("log")).to_contain_text("Was wissen wir über die Übergabe?")
        choices = self.sources()
        expect(choices.get_by_role("textbox", name="Projekthinweise", exact=True)).to_have_value("Beispiele aus dem Service verwenden.")
        self.page.keyboard.press("Escape")
        self.page.goto(self.url + "#/project/admin-console/overview")
        self.page.reload()
        self.open_chat()
        expect(self.panel.get_by_role("log")).not_to_contain_text("Übergabe")

    def test_revision_is_a_reviewable_proposal_and_never_directly_changes_the_note(self):
        self.enable_demo_ai()
        self.page.goto(self.url + "#/project/kundenportal/doc/PRD-03")
        self.open_chat()
        original = self.page.evaluate("getDoc('PRD-03').body")
        self.panel.get_by_role("combobox", name="Aufgabe", exact=True).select_option("revise")
        self.panel.get_by_role("textbox", name="Nachricht", exact=True).fill("Ergänze die beobachtbare Erfolgsmessung.")
        self.panel.get_by_role("button", name="Senden", exact=True).click()
        button = self.panel.get_by_role("button", name="Vorschlag prüfen", exact=True)
        expect(button).to_be_visible()
        message_id = button.get_attribute("data-id")
        proposal = self.page.evaluate("id=>aiMessageById(id).proposal", message_id)
        self.assertEqual(proposal["mode"], "revise")
        self.assertEqual(proposal["targetKey"], "doc:PRD-03")
        self.assertEqual(proposal["baseBody"], original)
        self.assertEqual(self.page.evaluate("getDoc('PRD-03').body"), original)

    def test_cancel_retry_and_provider_change_discard_late_answers(self):
        self.enable_demo_ai()
        self.open_chat()
        # A controlled response boundary lets cancellation and stale completions be tested offline.
        self.page.evaluate("""() => {
          window.aiCalls=[];
          aiRunTurn=args=>new Promise((resolve,reject)=>aiCalls.push({args,resolve,reject}));
        }""")
        draft = self.panel.get_by_role("textbox", name="Nachricht", exact=True)
        draft.fill("Bitte auf Rückmeldung warten")
        self.panel.get_by_role("button", name="Senden", exact=True).click()
        self.panel.get_by_role("button", name="Abbrechen", exact=True).click()
        expect(draft).to_have_value("Bitte auf Rückmeldung warten")
        self.assertTrue(self.page.evaluate("aiCalls[0].args.signal.aborted"))
        self.page.evaluate("aiCalls[0].resolve({text:'Veraltete Antwort',sourceKeys:[]})")
        expect(self.panel.get_by_role("log")).not_to_contain_text("Veraltete Antwort")
        self.panel.get_by_role("button", name="Erneut versuchen", exact=True).click()
        self.page.evaluate("aiCalls[1].reject(new Error('offline'))")
        expect(self.panel.get_by_role("alert")).to_be_visible()
        expect(draft).to_have_value("Bitte auf Rückmeldung warten")
        self.panel.get_by_role("button", name="Erneut versuchen", exact=True).click()
        self.page.evaluate("window.dispatchEvent(new CustomEvent('ai-config-changed',{detail:{enabled:false}}))")
        self.assertTrue(self.page.evaluate("aiCalls[2].args.signal.aborted"))
        self.page.evaluate("aiCalls[2].resolve({text:'Späte Antwort',sourceKeys:[]})")
        self.assertFalse(self.page.evaluate("project().aiThreads.some(t=>t.messages.some(m=>m.text==='Späte Antwort'))"))

    def test_unused_composer_tracks_navigation_while_a_sent_turn_stays_scoped(self):
        self.enable_demo_ai()
        self.page.goto(self.url + "#/project/kundenportal/doc/RES-14")
        self.open_chat()
        selected = self.panel.get_by_role("region", name="Ausgewählte Quellen")
        expect(selected).to_contain_text("RES-14")
        self.page.get_by_role("navigation", name="Projektbereiche").get_by_role("button", name="Überblick").click()
        expect(selected).to_contain_text("Keine Quellen")
        self.page.evaluate("""() => {
          aiRunTurn=args=>new Promise(resolve=>window.delayedAiTurn={args,resolve});
        }""")
        self.panel.get_by_role("textbox", name="Nachricht", exact=True).fill("Nur im Kundenportal")
        self.panel.get_by_role("button", name="Senden", exact=True).click()
        self.page.get_by_role("button", name="Projekt wechseln oder anlegen").click()
        self.dialog.locator('[data-action="switch-project"][data-id="admin-console"]').click()
        self.assertTrue(self.page.evaluate("delayedAiTurn.args.signal.aborted"))
        self.page.evaluate("delayedAiTurn.resolve({text:'Alte Antwort',sourceKeys:[]})")
        self.assertFalse(self.page.evaluate("!!project().aiThreads?.length"))

    def test_opening_a_different_contextual_review_cancels_the_previous_turn(self):
        self.enable_demo_ai()
        self.open_chat()
        self.page.evaluate("""() => {
          aiRunTurn=args=>new Promise(resolve=>window.pendingReview={args,resolve});
        }""")
        self.panel.get_by_role("textbox", name="Nachricht").fill("Frage zum gesamten Projekt")
        self.panel.get_by_role("button", name="Senden").click()
        nav = self.page.get_by_role("navigation", name="Projektbereiche")
        nav.get_by_role("button", name="Wissen", exact=True).click()
        self.main.get_by_role("button", name=re.compile("^Interview zur Wochenübergabe")).click()
        self.main.get_by_text("Notizaktionen", exact=True).click()
        self.main.get_by_role("button", name="KI-Review", exact=True).click()
        self.assertTrue(self.page.evaluate("pendingReview.args.signal.aborted"))
        expect(self.panel.get_by_role("combobox", name="Prüfgegenstand")).to_have_value("doc:RES-14")
        expect(self.panel.locator("[data-ai-message]")).to_have_count(0)
