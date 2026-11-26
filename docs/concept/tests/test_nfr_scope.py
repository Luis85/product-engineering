"""Contracts shared by the prototype brief and released request."""
from browser_case import BrowserCase


class NfrScopeTest(BrowserCase):
    def scope(self, kind, source_id):
        return self.page.evaluate(
            "([kind,id]) => typeof nfrsForScope === 'function' ? nfrsForScope(kind,id) : []",
            [kind, source_id],
        )

    def test_scope_uses_matching_origins_and_avoids_sibling_and_other_map_leakage(self):
        self.page.evaluate("""() => {
            const projectData=project();
            const ref=(kind,id)=>({kind,id});
            const record=(id,targets)=>({id,title:id,requirement:'Clear text',
                acceptance:'95% in 1 s',categories:['security'],targets});
            const original=projectData.storyMaps[0];
            const other={...original,id:'SM-OTHER',title:'Andere Map',cards:[]};
            const samePbi={...original,id:'SM-SHARED',title:'Zweiter Lösungsweg',
                cards:[{id:'CARD-X',links:[{projectId:projectData.id,itemId:'UC-09'}]}]};
            projectData.storyMaps.push(other,samePbi);
            projectData.nfrs=[
                record('direct',[ref('item','UC-09'),ref('map',original.id),ref('item','UC-09')]),
                record('feature',[ref('item','FE-01')]),
                record('child',[ref('item','TASK-01')]),
                record('sibling',[ref('item','UC-14')]),
                record('other-map',[ref('map',other.id)]),
                record('second-map',[ref('map',samePbi.id)]),
                record('dangling',[ref('item','REMOVED')]), record('old',undefined)];
        }""")
        result = self.scope("item", "UC-09")
        self.assertEqual({row["id"] for row in result}, {"direct","feature","child","second-map"})
        direct = next(row for row in result if row["id"] == "direct")
        self.assertEqual({(ref["kind"],ref["id"]) for ref in direct["sources"]},
                         {("item","UC-09"),("map","SM-01")})
        self.assertEqual(len(direct["sources"]), 2)
        self.assertEqual(direct["acceptance"], "95% in 1 s")
        self.assertEqual({row["id"] for row in self.scope("map","SM-01")},
                         {"direct","feature","child","sibling"})
        self.assertEqual(self.scope("item","REMOVED"), [])
        self.assertEqual([row["id"] for row in self.scope("nfr","old")], ["old"])

    def test_invalid_batch_keeps_all_current_links_and_repeating_an_assignment_is_safe(self):
        result = self.page.evaluate("""() => {
            if (typeof setTargetNfrs!=='function') return null;
            const first=projectNfrs()[0],second=projectNfrs()[1];
            const map={kind:'map',id:'SM-01'};
            const a=replaceNfrTargets(first,[map,map]);
            const b=setTargetNfrs('item','UC-09',[first.id,second.id,first.id]);
            const before=JSON.stringify(projectNfrs());
            const rejected=setTargetNfrs('item','UC-09',[first.id,'missing']);
            const bad=replaceNfrTargets(first,[{kind:'map',id:'missing'}]);
            const unchanged=before===JSON.stringify(projectNfrs());
            const direct=directNfrs('item','UC-09').map(row=>row.id);
            setTargetNfrs('item','UC-09',[second.id]);
            return {a,b,rejected,bad,unchanged,direct,retained:first.targets};
        }""")
        self.assertIsNotNone(result, "Link editing needs a single project-scoped relation model")
        self.assertTrue(result["a"] and result["b"] and result["unchanged"])
        self.assertFalse(result["rejected"] or result["bad"])
        self.assertEqual(result["direct"], ["NFR-01","NFR-02"])
        self.assertEqual(result["retained"], [{"kind":"map","id":"SM-01"}])

    def test_switching_project_cannot_write_to_a_requirement_from_the_previous_project(self):
        result = self.page.evaluate("""() => {
            const foreign=state.projects.find(p=>p.id!==project().id);
            const record={id:'NFR-300',title:'Andere Anforderungen',targets:[]};
            (foreign.nfrs||=[]).push(record);
            const ok=replaceNfrTargets(record,[{kind:'item',id:'UC-09'}]);
            return [ok,record.targets];
        }""")
        self.assertEqual(result,[False,[]])
