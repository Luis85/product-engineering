"""Scope resolution and canonical model-note assignments."""
from browser_case import BrowserCase


class DomainScopeTest(BrowserCase):
    def fixture(self):
        self.page.evaluate("""() => {
          const p=project();
          const make=(id,targets,relations=[])=>({id,kind:'Entität',title:id,body:'Definition '+id,
            status:'Freigegeben',rev:1,domainTargets:targets,domainAttributes:[{name:'Kennung',description:'Stabil'}],domainRelations:relations});
          const target=(kind,id)=>({kind,id});
          const edge=(id,toId)=>({id,toId,verb:'bearbeitet',fromCard:'1',toCard:'0..*',description:'Nur im Projekt'});
          p.docs=p.docs.filter(d=>d.kind!=='Entität');
          p.docs.push(make('A',[target('prd','PRD-03'),target('item','UC-09')],[edge('R1','B'),edge('R2','A')]),
                      make('B',[],[edge('R3','C')]),make('C',[]),make('D',[target('map','SM-01')]),
                      make('S',[target('item','UC-14')]),make('X',[target('map','SM-X')],[edge('R4','A')]));
          p.storyMaps.push({...p.storyMaps[0],id:'SM-X',cards:[],prdId:'',foundationRefs:[]});
          p.nfrs[0].targets=[target('item','UC-09')];
        }""")

    def scope(self, kind, source_id):
        return self.page.evaluate('''([kind,id])=>typeof domainForScope==='function'
            ? domainForScope(kind,id) : {entities:[],relationships:[],contextEntities:[]}''',[kind,source_id])

    def test_one_hop_graph_preserves_provenance_and_cardinalities_without_sibling_leakage(self):
        self.fixture()
        scope=self.scope("item","UC-09")
        self.assertEqual([n["id"] for n in scope["entities"]],["A","D"])
        self.assertEqual({s["id"] for s in scope["entities"][0]["sources"]},{"PRD-03","UC-09"})
        self.assertEqual({r["id"] for r in scope["relationships"]},{"R1","R2","R4"})
        self.assertEqual({n["id"] for n in scope["contextEntities"]},{"B","X"})
        self.assertNotIn("Definition X",str(scope))
        first=next(r for r in scope["relationships"] if r["id"]=="R1")
        self.assertEqual((first["fromId"],first["verb"],first["toId"],first["fromCard"],first["toCard"]),
                         ("A","bearbeitet","B","1","0..*"))
        self.assertEqual({d["id"] for d in self.scope("map","SM-01")["entities"]},{"A","D","S"})
        self.assertEqual({d["id"] for d in self.scope("prd","PRD-03")["entities"]},{"A"})
        self.assertEqual(self.scope("nfr","NFR-01"),scope)
        self.assertEqual(self.scope("item","missing")["entities"],[])
        self.page.evaluate("getDoc('X').domainArchived=true")
        self.assertNotIn("R4",[r["id"] for r in self.scope("item","UC-09")["relationships"]])

    def test_repeated_assignments_are_noops_and_invalid_changes_are_atomic(self):
        self.fixture()
        result=self.page.evaluate("""() => {
          if(typeof setEntityTargets!=='function')return null;
          const a=getDoc('A'),b=getDoc('B'),first={kind:'prd',id:'PRD-03'},second={kind:'map',id:'SM-01'};
          const changed=setEntityTargets(a,[first,second,first]);
          const again=setEntityTargets(a,[second,first]);
          const titleRevision=a.rev;
          const both=setTargetEntities('map','SM-01',['A','B','D']);
          const before=JSON.stringify([a,b]);
          const invalid=setTargetEntities('map','SM-01',['BAD']);
          const foreign=setEntityTargets(a,[{...first,projectId:'admin-console'}]);
          const badKind=setEntityTargets(a,[{kind:'prd',id:'VIS-01'}]);
          const unchanged=before===JSON.stringify([a,b]);
          const direct=entitiesLinkedToTarget('map','SM-01').map(d=>d.id);
          const exported=itemMarkdown(a);
          return {changed,again,titleRevision,both,invalid,foreign,badKind,unchanged,direct,exported};
        }""")
        self.assertIsNotNone(result,"A single validated assignment must support both editing directions")
        self.assertTrue(result["changed"] and result["again"] and result["both"] and result["unchanged"])
        self.assertEqual(result["titleRevision"],2)
        self.assertFalse(result["invalid"] or result["foreign"] or result["badKind"])
        self.assertEqual(set(result["direct"]),{"A","B","D"})
        self.assertIn("prd:PRD-03",result["exported"])
        self.assertIn("map:SM-01",result["exported"])
        self.assertIn("[[PRD-03]]",result["exported"])
