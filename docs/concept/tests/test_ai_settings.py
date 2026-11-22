"""Global Copilot consent and the isolated chat-completions transport."""

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class AiSettingsTest(BrowserCase):
    start_route = "#/project/kundenportal/plugin-settings"

    def settings(self):
        heading=self.main.get_by_role("heading",name="Plugin-Einstellungen",exact=True)
        self.assertEqual(heading.count(),1,"The plugin needs its own settings page")
        return self.main.get_by_role("checkbox",name="KI-Copilot aktivieren",exact=True)

    def save(self):
        self.main.get_by_role("button",name="Einstellungen speichern",exact=True).click()

    def remote(self, endpoint="https://provider.example/v1/chat/completions", key=""):
        self.settings().check()
        self.main.get_by_role("combobox",name="Betriebsart").select_option("remote")
        self.main.get_by_role("textbox",name="Endpoint",exact=True).fill(endpoint)
        self.main.get_by_role("textbox",name="Modell",exact=True).fill("team-model")
        if key:
            self.main.get_by_label("API-Schlüssel (optional)",exact=True).fill(key)
        self.save()

    def stub(self):
        self.page.evaluate("""() => {
          window.providerCalls=[];
          window.fetch=async(url,options)=>{
            window.providerCalls.push({url,body:JSON.parse(options.body),redirect:options.redirect,
              credentials:options.credentials,key:new Headers(options.headers).get('authorization')});
            return new Response(JSON.stringify({choices:[{message:{content:'Antwort aus dem Test.'}}]}),
              {status:200,headers:{'Content-Type':'application/json'}});
          };
        }""")

    def complete(self):
        return self.page.evaluate("""async()=>{try{return await requestAiCompletion([{role:'user',content:'Bitte prüfen.'}])}
          catch(error){return error.name+': '+error.message}}""")

    def test_old_and_new_projects_share_explicit_consent_with_no_automatic_requests(self):
        toggle=self.settings()
        self.stub()
        self.assertFalse(self.page.evaluate("aiEnabled()"))
        self.assertTrue(self.page.evaluate("Boolean(project().model)"),"Fixture includes a legacy project profile")
        self.assertNotEqual(self.complete(),"Antwort aus dem Test.")
        toggle.check();self.save()
        self.assertEqual(self.page.evaluate("aiSettings().mode"),"demo")
        self.assertNotEqual(self.complete(),"Antwort aus dem Test.")
        self.page.goto(self.url+"#/project/admin-console/plugin-settings")
        expect(self.settings()).to_be_checked()
        self.assertEqual(self.page.evaluate("providerCalls.length"),0)
        self.page.reload()
        self.assertTrue(self.page.evaluate("aiEnabled()"))
        self.settings().uncheck();self.save()
        self.page.goto(self.url+self.start_route)
        expect(self.settings()).not_to_be_checked()

    def test_remote_sends_only_on_demand_and_never_persists_the_key(self):
        self.stub()
        endpoint="http://127.0.0.1:11434/v1/chat/completions?api-version=1"
        self.remote(endpoint,"qa-session-key")
        self.assertEqual(self.page.evaluate("providerCalls.length"),0)
        self.assertEqual(self.complete(),"Antwort aus dem Test.")
        call=self.page.evaluate("providerCalls[0]")
        self.assertEqual(call["url"],endpoint)
        self.assertEqual(call["body"]["model"],"team-model")
        self.assertEqual(call["body"]["messages"],[{"role":"user","content":"Bitte prüfen."}])
        self.assertEqual(call["key"],"Bearer qa-session-key")
        self.assertEqual((call["credentials"],call["redirect"]),("omit","error"))
        self.assertFalse(self.page.evaluate("JSON.stringify(localStorage).includes('qa-session-key')"))
        self.assertEqual(set(self.page.evaluate("aiSettings()")),{"enabled","mode","endpoint","model"})
        self.page.reload();self.stub();self.complete()
        self.assertIsNone(self.page.evaluate("providerCalls[0].key"))

    def test_unsafe_endpoint_errors_preserve_fields_and_do_not_commit(self):
        self.settings();self.stub()
        field=self.main.get_by_role("textbox",name="Endpoint",exact=True)
        for invalid in ["http://not-local.example/v1/chat/completions","https://name:password@provider.example/v1/chat/completions",
                        "https://provider.example/v1/chat/completions?api_key=fake-sensitive","https://provider.example/v1"]:
            self.remote(invalid)
            expect(field).to_have_value(invalid)
            expect(field).to_be_focused()
            expect(self.main.get_by_role("alert")).to_be_visible()
            self.assertFalse(self.page.evaluate("aiEnabled()"))
        self.remote("http://[::1]:11434/v1/chat/completions")
        self.assertTrue(self.page.evaluate("aiEnabled()"))
        self.assertEqual(self.page.evaluate("providerCalls.length"),0)

    def test_switching_destination_and_disabling_abort_and_clear_old_credentials(self):
        self.remote(key="qa-bound-key")
        self.page.evaluate("""() => {
          window.changes=0;window.addEventListener('ai-config-changed',()=>changes++);
          window.fetch=(url,options)=>new Promise((resolve,reject)=>{
            options.signal.addEventListener('abort',()=>reject(new DOMException('abgebrochen','AbortError')),{once:true});
          });
          window.pendingResult=requestAiCompletion([{role:'user',content:'Entwurf'}]).catch(error=>error.name);
        }""")
        self.main.get_by_role("textbox",name="Endpoint",exact=True).fill("https://other.example/v1/chat/completions")
        self.save()
        self.assertEqual(self.page.evaluate("pendingResult"),"AbortError")
        self.assertGreater(self.page.evaluate("changes"),0)
        self.stub();self.complete()
        self.assertIsNone(self.page.evaluate("providerCalls[0].key"))
        self.main.get_by_label("API-Schlüssel (optional)",exact=True).fill("qa-again"); self.save()
        self.settings().uncheck();self.save();self.settings().check();self.save()
        self.stub();self.complete()
        self.assertIsNone(self.page.evaluate("providerCalls[0].key"))

    def test_cors_redirect_invalid_response_timeout_and_user_abort_are_recoverable(self):
        self.remote()
        self.page.evaluate("() => {window.fetch=async()=>{throw new TypeError('Failed to fetch')};}")
        self.assertIn("CORS",self.complete())
        self.page.evaluate("() => {window.fetch=async()=>new Response('do-not-echo-server-secret',{status:401});}")
        result=self.complete()
        self.assertIn("401",result);self.assertNotIn("do-not-echo-server-secret",result)
        self.page.evaluate("() => {window.fetch=async()=>new Response('{}',{status:200});}")
        self.assertIn("Antwort",self.complete())
        name=self.page.evaluate("""async()=>{
          window.fetch=(url,options)=>new Promise((r,j)=>options.signal.addEventListener('abort',()=>j(new DOMException('Abbruch','AbortError'))));
          const controller=new AbortController(),query=requestAiCompletion([{role:'user',content:'Test'}],{signal:controller.signal});
          controller.abort();try{await query}catch(error){return error.name}
        }""")
        self.assertEqual(name,"AbortError")
        self.page.evaluate("() => {const nativeTimeout=window.setTimeout;window.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,delay>=10000?15:delay,...args);}")
        self.assertIn("Zeit",self.complete())

    def test_project_integrations_keep_data_class_and_mcp_separate(self):
        self.settings()
        self.page.goto(self.url+"#/project/kundenportal/settings")
        self.main.get_by_role("button",name="Integrationen",exact=True).click()
        expect(self.main.get_by_role("combobox",name="KI-Modellprofil")).to_have_count(0)
        self.main.get_by_role("combobox",name="Datenklasse").select_option("Vertraulich")
        self.main.get_by_role("button",name="Datenklasse speichern").click()
        self.assertEqual(self.page.evaluate("project().dataClass"),"Vertraulich")
        expect(self.main.get_by_role("button",name="MCP-Lesezugriff simulieren")).to_be_visible()
        self.assertFalse(self.page.evaluate("aiEnabled()"))
