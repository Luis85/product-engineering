"""Camera gestures change the view; entity drags only change that entity's position."""

from playwright.sync_api import expect

if __package__:
    from .browser_case import BrowserCase
else:
    from browser_case import BrowserCase


class DomainCameraTest(BrowserCase):
    start_route = "#/project/kundenportal/domainmodel"

    def setUp(self):
        super().setUp()
        self.canvas=self.main.locator("[data-domain-canvas]")
        self.port=self.canvas.locator(".domain-canvas-scroll")
        self.stage=self.canvas.locator(".dm-stage")

    def zoom(self):
        return self.stage.evaluate("el=>el.getBoundingClientRect().width/el.offsetWidth")

    def point(self,x,y):
        return self.stage.evaluate("""(el,[x,y])=>{
          const box=el.getBoundingClientRect(),zoom=box.width/el.offsetWidth;
          return [(x-box.left)/zoom,(y-box.top)/zoom];
        }""",[x,y])

    def test_plain_wheel_anchors_under_cursor_and_zoom_controls_are_bounded(self):
        view=self.port.bounding_box();x=view["x"]+view["width"]*.37;y=view["y"]+90
        before=self.point(x,y)
        self.page.mouse.move(x,y)
        self.page.mouse.wheel(0,-220)
        self.page.wait_for_timeout(90)
        self.assertGreater(self.zoom(),1.1,"An ordinary wheel should zoom the diagram")
        after=self.point(x,y)
        self.assertAlmostEqual(before[0],after[0],delta=2);self.assertAlmostEqual(before[1],after[1],delta=2)
        self.page.mouse.wheel(0,-10000);self.page.wait_for_timeout(80)
        maximum=self.zoom();self.assertGreater(maximum,1);self.assertLessEqual(maximum,5)
        expect(self.canvas.get_by_role("button",name="Vergrößern",exact=True)).to_be_disabled()
        self.page.mouse.wheel(0,10000);self.page.wait_for_timeout(80)
        minimum=self.zoom();self.assertGreater(minimum,0);self.assertLess(minimum,.8)
        expect(self.canvas.get_by_role("button",name="Verkleinern",exact=True)).to_be_disabled()
        self.canvas.get_by_role("button",name="Originalgröße",exact=True).click()
        self.assertAlmostEqual(self.zoom(),1,delta=.01)
        self.main.get_by_role("heading",level=1).hover();self.page.mouse.wheel(0,120);self.page.wait_for_timeout(70)
        self.assertAlmostEqual(self.zoom(),1,delta=.01)

    def test_background_pan_and_keyboard_survive_selection_without_moving_entities(self):
        node=self.canvas.get_by_role("button",name="Organisation",exact=True)
        view=self.port.bounding_box(); before=node.bounding_box()
        dots=self.port.evaluate("el=>getComputedStyle(el).backgroundPosition")
        original=self.page.evaluate("JSON.stringify(project().domainLayout || {})")
        x=view["x"]+12;y=view["y"]+9
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+74,y+36,steps=6);self.page.mouse.up()
        panned=node.bounding_box()
        self.assertNotEqual(self.port.evaluate("el=>getComputedStyle(el).backgroundPosition"),dots)
        self.assertAlmostEqual(panned["x"]-before["x"],74,delta=3,msg="Dragging blank space must pan")
        self.assertAlmostEqual(panned["y"]-before["y"],36,delta=3)
        self.port.focus();self.page.keyboard.press("ArrowRight")
        moved=node.bounding_box();self.assertLess(moved["x"],panned["x"]-15)
        node.click()
        self.assertAlmostEqual(node.bounding_box()["x"],moved["x"],delta=2)
        self.assertAlmostEqual(node.bounding_box()["y"],moved["y"],delta=2)
        self.assertEqual(self.page.evaluate("JSON.stringify(project().domainLayout || {})"),original)

    def test_fit_far_apart_entities_and_drag_in_model_coordinates(self):
        action=self.canvas.get_by_role("button",name="Einpassen",exact=True)
        self.assertEqual(action.count(),1,"The graph needs an explicit fit command")
        self.page.evaluate("project().domainLayout={'ENT-03':{x:2300,y:1150}};render()")
        action.click()
        viewport=self.port.bounding_box()
        for node in self.canvas.locator("[data-domain-node]").all():
            r=node.bounding_box()
            self.assertGreaterEqual(r["x"],viewport["x"]-1);self.assertGreaterEqual(r["y"],viewport["y"]-1)
            self.assertLessEqual(r["x"]+r["width"],viewport["x"]+viewport["width"]+1)
            self.assertLessEqual(r["y"]+r["height"],viewport["y"]+viewport["height"]+1)
        self.canvas.get_by_role("button",name="Originalgröße",exact=True).click()
        plus=self.canvas.get_by_role("button",name="Vergrößern",exact=True);plus.click();plus.click()
        z=self.zoom();self.assertGreater(z,1.25)
        node=self.canvas.locator('[data-domain-node="ENT-01"]')
        node.scroll_into_view_if_needed();r=node.bounding_box();before=node.evaluate("e=>e.offsetLeft")
        x=r["x"]+25;y=r["y"]+25
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+58,y+14,steps=7);self.page.mouse.up()
        self.assertAlmostEqual(node.evaluate("e=>e.offsetLeft")-before,58/z,delta=2)
        self.assertAlmostEqual(self.zoom(),z,delta=.01)

    def test_touch_pans_a_phone_canvas_without_horizontal_page_overflow(self):
        self.page.set_viewport_size({"width":390,"height":844})
        self.port.scroll_into_view_if_needed()
        node=self.canvas.locator("[data-domain-node]").first; before=node.bounding_box()
        view=self.port.bounding_box();x=view["x"]+10;y=view["y"]+10
        cdp=self.page.context.new_cdp_session(self.page)
        def touch(kind,positions):
            cdp.send("Input.dispatchTouchEvent",{"type":kind,"touchPoints":[{"x":a,"y":b,"id":1} for a,b in positions]})
        touch("touchStart",[(x,y)]);touch("touchMove",[(x+35,y+14)]);touch("touchMove",[(x+70,y+30)]);touch("touchEnd",[])
        self.assertGreater(node.bounding_box()["x"],before["x"]+50)
        self.assertTrue(self.page.evaluate("document.documentElement.scrollWidth<=innerWidth"))

    def test_zoom_is_remembered_separately_for_each_project(self):
        plus=self.canvas.get_by_role("button",name="Vergrößern",exact=True)
        self.assertEqual(plus.count(),1,"Each project needs its own camera")
        plus.click();plus.click()
        portal_zoom=self.zoom()
        self.page.evaluate("""() => {
          const admin=state.projects.find(p=>p.id==='admin-console');
          admin.docs.push({id:'ENT-01',kind:'Entität',title:'Rolle',body:'Berechtigung',
            owner:'',status:'Entwurf',rev:1,domainAttributes:[],domainRelations:[]});persist();
        }""")
        for project in ["Admin Console","Kundenportal"]:
            self.page.get_by_role("button",name="Projekt wechseln oder anlegen").click()
            self.dialog.get_by_role("button",name=project,exact=True).click()
            self.page.get_by_role("navigation",name="Projektbereiche").get_by_role("button",name="Domainmodel",exact=True).click()
            self.assertAlmostEqual(self.zoom(),1 if project=="Admin Console" else portal_zoom,delta=.01)
