"""An offline entity-relationship diagram stays readable and operable in the browser."""

import re
import unittest

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class DomainCanvasTest(BrowserCase):
    start_route = "#/project/kundenportal/domainmodel"

    def surface(self):
        canvas = self.main.locator("[data-domain-canvas]")
        self.assertEqual(canvas.count(), 1, "Domainmodel needs a selectable graphical editor")
        return canvas

    def test_sample_map_exposes_real_entities_verbs_and_endpoint_cardinalities(self):
        canvas = self.surface()
        for name in ["Organisation", "Servicefall", "Übergabe"]:
            expect(canvas.get_by_role("button", name=name, exact=True)).to_be_visible()
        expect(canvas.locator('[data-action="domain-edge"][data-id="REL-01"]')).to_contain_text("umfasst")
        ends = canvas.locator('[data-domain-ends="REL-01"] text').all_text_contents()
        self.assertEqual(ends, ["1", "0..*"])
        entity = canvas.get_by_role("button", name="Servicefall", exact=True)
        entity.focus()
        self.page.keyboard.press("Enter")
        expect(entity).to_have_attribute("aria-pressed", "true")
        relation = canvas.locator('[data-action="domain-edge"][data-id="REL-01"]')
        relation.click()
        expect(relation).to_have_attribute("aria-pressed", "true")
        expect(relation).to_be_focused()
        for width in [1066, 390, 320]:
            self.page.set_viewport_size({"width": width, "height": 844})
            self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)
            self.assertGreaterEqual(entity.bounding_box()["width"], 132)

    def test_pointer_keyboard_and_click_moves_survive_reload(self):
        canvas = self.surface()
        entity = canvas.get_by_role("button", name="Organisation", exact=True)
        entity.click()
        first = entity.bounding_box()
        canvas.get_by_role("button", name=re.compile("nach rechts verschieben")).click()
        right = entity.bounding_box()
        self.assertGreater(right["x"], first["x"])
        entity.focus()
        self.page.keyboard.press("ArrowDown")
        down = entity.bounding_box()
        self.assertGreater(down["y"], right["y"])
        self.page.mouse.move(down["x"] + 22, down["y"] + 22)
        self.page.mouse.down()
        self.page.mouse.move(down["x"] + 90, down["y"] + 50, steps=6)
        self.page.mouse.up()
        self.assertGreater(entity.bounding_box()["x"], down["x"] + 35)
        layout = self.page.evaluate("project().domainLayout['ENT-01']")
        self.page.reload()
        self.surface()
        self.assertEqual(self.page.evaluate("project().domainLayout['ENT-01']"), layout)

    def test_parallel_reversed_and_self_relationships_have_distinct_paths_and_labels(self):
        self.assertTrue(self.page.evaluate("typeof domainCanvas==='function'"), "Missing diagram renderer")
        self.page.evaluate("""() => {
          const entities=['A','B'].map(id=>({id,title:'Objekt '+id,kind:'Entität',domainAttributes:[]}));
          const pairs=[['A','B'],['A','B'],['B','A'],['A','A'],['A','A']];
          const edges=pairs.map(([fromId,toId],i)=>({
            id:'E'+i,fromId,toId,verb:'verbindet '+i,fromCard:'1',toCard:'0..*'
          }));
          document.querySelector('main').innerHTML=domainCanvas(entities,edges,'A');
        }""")
        canvas = self.surface()
        paths = canvas.locator("[data-domain-edge-path]").evaluate_all("nodes=>nodes.map(n=>n.getAttribute('d'))")
        self.assertEqual(len(paths), 5)
        self.assertEqual(len(set(paths)), 5)
        labels = canvas.locator('[data-action="domain-edge"]').all()
        self.assertEqual(len(labels), 5)
        positions = [(round(box["x"]), round(box["y"])) for label in labels if (box := label.bounding_box())]
        self.assertEqual(len(set(positions)), 5)


if __name__ == "__main__":
    unittest.main()
