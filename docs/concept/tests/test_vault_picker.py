
"""Local vault references: selection, project isolation, deferred reads and safe previews."""
import base64
import tempfile
from pathlib import Path

from playwright.sync_api import expect

from browser_case import BrowserCase


class VaultPicker(BrowserCase):
    def start_picker(self, allow_embed=True):
        self.assertTrue(self.page.evaluate("typeof chooseVaultReference==='function'"),"Vault picker must exist")
        self.page.evaluate("""allow => {
          window.lastPicked=null;
          chooseVaultReference((record,options)=>{
            window.lastPicked={record,options,open:document.getElementById('vault-picker').open};
          },{allowEmbed:allow});
        }""",allow_embed)
        return self.page.locator("#vault-picker")

    def select_path(self,picker,path,embed=False):
        picker.get_by_role("button",name=path,exact=True).click()
        picker.get_by_role("button",name="Bild einbetten" if embed else "Verweis einfügen",exact=True).click()
        expect(picker).not_to_be_visible()
        return self.page.evaluate("lastPicked")

    def test_project_notes_are_searchable_and_callback_runs_after_dialog_closes(self):
        self.main.get_by_role("heading").first.focus()
        picker=self.start_picker()
        expect(picker.get_by_label("Vault durchsuchen")).to_be_focused()
        picker.get_by_label("Vault durchsuchen").fill("Wochenübergabe")
        picked=self.select_path(picker,"RES-14.md")
        self.assertEqual(picked["record"]["id"],"RES-14")
        self.assertEqual(picked["options"]["embed"],False)
        self.assertFalse(picked["open"])
        self.page.evaluate("vaultOpen('RES-14','Fundstelle')")
        expect(self.main.get_by_role("heading",name="Fundstelle")).to_be_focused()
        self.page.evaluate("vaultOpen('UC-09')")
        expect(self.main.get_by_role("heading",name="Gefilterte Servicefälle exportieren",level=1)).to_be_visible()

    def test_directory_indexes_only_visible_metadata_and_retains_only_selected_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            vault=Path(tmp)/"TestVault"
            for name,text in [("Research/Gespräch.md","## Ergebnisse\n\nNur diese Notiz speichern."),
                              ("Archiv/Gespräch.md","Zweite gleichnamige Notiz."),
                              (".obsidian/settings.md","Verborgene Einstellungen."),
                              ("node_modules/vendor.md","Abhängigkeit."),
                              ("Andere.md","Ungewählte Notiz."),
                              ("Ungültig#Pfad.md","Nicht als Wikilink verwendbar.")]:
                file=vault/name
                file.parent.mkdir(parents=True,exist_ok=True)
                file.write_text(text,encoding="utf-8")
            self.page.evaluate("""() => {
              window.readFiles=[];
              for (const method of ['text','arrayBuffer','stream']) {
                const original=File.prototype[method];
                File.prototype[method]=function(...args){ readFiles.push(this.name);return original.apply(this,args); };
              }
            }""")
            picker=self.start_picker()
            picker.locator("#vault-folder").set_input_files(vault)
            expect(picker.get_by_role("button",name="Research/Gespräch.md",exact=True)).to_be_visible()
            expect(picker.get_by_role("button",name="Archiv/Gespräch.md",exact=True)).to_be_visible()
            expect(picker.get_by_role("button",name=".obsidian/settings.md",exact=True)).to_have_count(0)
            expect(picker.get_by_role("button",name="node_modules/vendor.md",exact=True)).to_have_count(0)
            self.assertEqual(self.page.evaluate("readFiles"),[])
            expect(picker.get_by_role("button",name="Ungültig#Pfad.md",exact=True)).to_be_disabled()
            picked=self.select_path(picker,"Research/Gespräch.md")
            self.assertEqual(picked["record"]["kind"],"markdown")
            self.assertIsNone(self.page.evaluate("vaultResolve('Gespräch')"))
            (vault/"Research/Gespräch.md").unlink()
            self.page.reload()
            self.assertEqual(self.page.evaluate("vaultResolve('Research/Gespräch').path"),"Research/Gespräch.md")
            self.assertIsNone(self.page.evaluate("vaultResolve('Andere.md')"))
            self.assertIsNone(self.page.evaluate("vaultResolve('Archiv/Gespräch.md')"))
            self.page.evaluate("vaultOpen('Research/Gespräch.md','Ergebnisse')")
            preview=self.page.locator("#vault-preview")
            expect(preview.get_by_role("heading",name="Ergebnisse")).to_be_focused()
            expect(preview).to_contain_text("Nur diese Notiz speichern.")
            self.assertFalse(self.page.evaluate("JSON.stringify(localStorage).includes('Nur diese Notiz speichern.')"))
            self.page.keyboard.press("Escape")
            self.page.goto(self.url+"#/project/admin-console/overview")
            self.assertIsNone(self.page.evaluate("vaultResolve('Research/Gespräch.md')"))

    def test_raster_image_hydrates_after_reload_and_html_svg_are_download_only(self):
        png=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=")
        picker=self.start_picker()
        picker.locator("#vault-files").set_input_files({"name":"Bleistift.png","mimeType":"image/png","buffer":png})
        image=self.select_path(picker,"Bleistift.png",True)
        self.assertTrue(image["options"]["embed"])
        self.page.reload()
        self.page.evaluate("""async()=>{const img=document.createElement('img');img.id='probe-image';img.dataset.vaultImage='Bleistift.png';
          document.querySelector('main').append(img);await hydrateVaultImages(document.querySelector('main'));}""")
        self.page.wait_for_function("document.querySelector('#probe-image').naturalWidth===1")
        for name,mime,body in [("Ansicht.svg","image/svg+xml",'<svg xmlns="http://www.w3.org/2000/svg"><script>window.vaultRan=1</script></svg>'),
                               ("Prototyp.html","text/html","<script>window.vaultRan=1</script>")]:
            picker=self.start_picker()
            picker.locator("#vault-files").set_input_files({"name":name,"mimeType":mime,"buffer":body.encode()})
            picked=self.select_path(picker,name)
            self.assertEqual(picked["record"]["kind"],"file")
            self.page.evaluate("p=>vaultOpen(p)",name)
            preview=self.page.locator("#vault-preview")
            expect(preview).to_be_visible()
            expect(preview.locator("iframe,object,embed,svg:not(.icon),script")).to_have_count(0)
            expect(preview.get_by_role("link",name="Datei herunterladen")).to_be_visible()
            self.assertIsNone(self.page.evaluate("window.vaultRan"))
            self.page.keyboard.press("Escape")

    def test_selected_markdown_is_read_only_and_escapes_raw_html(self):
        picker=self.start_picker(False)
        picker.locator("#vault-files").set_input_files({"name":"Notiz.md","mimeType":"text/markdown",
            "buffer":b'## Beispiel\n\n<img src=x onerror="window.vaultRan=1"> **Text**'})
        self.select_path(picker,"Notiz.md")
        self.page.evaluate("vaultOpen('Notiz.md')")
        preview=self.page.locator("#vault-preview")
        expect(preview.get_by_role("heading",name="Beispiel")).to_be_visible()
        expect(preview).to_contain_text('<img src=x')
        expect(preview.locator("[contenteditable=true],img[onerror]")).to_have_count(0)
        self.assertIsNone(self.page.evaluate("window.vaultRan"))



    def test_same_name_as_project_note_requires_an_unambiguous_file_path(self):
        picker=self.start_picker()
        picker.locator("#vault-files").set_input_files({"name":"RES-14.md","mimeType":"text/markdown","buffer":b'Different local source'})
        expect(picker.get_by_role("button",name="Verweis einfügen")).to_be_disabled()
        expect(picker.get_by_role("status")).to_contain_text("bereits")
        self.assertEqual(self.page.evaluate("vaultResolve('RES-14').kind"),"doc")
        self.page.keyboard.press("Escape")
        self.assertIsNone(self.page.evaluate("lastPicked"))
