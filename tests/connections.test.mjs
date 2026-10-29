import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionGeometry,moveConnectionSection,nearestConnectionSection,reconnectDiagramEdge} from '../src/lib/connections.mjs';
import {localGenerate,validateGraph,SAMPLE_TEXT} from '../shared/diagram.mjs';
import {arrange,edgePoints} from '../src/lib/layout.mjs';
import {diagramSVG} from '../src/lib/export.mjs';

const orthogonal=points=>points.slice(1).every((p,i)=>p.x===points[i].x||p.y===points[i].y);
test('dragging each section preserves orthogonal lines and attached endpoints in both layouts',()=>{
 for(const layout of ['horizontal','vertical'])for(const backwards of [false,true]){
  const ends={sx:300,sy:250,tx:backwards?50:600,ty:backwards?50:450,layout};
  const initial=connectionGeometry(ends);
  for(const part of ['sourceLead','center','targetLead']){
   const route=moveConnectionSection(initial.route,part,55);
   const moved=connectionGeometry({...ends,route});
   assert.equal(orthogonal(moved.points),true);assert.deepEqual(moved.points[0],{x:ends.sx,y:ends.sy});assert.deepEqual(moved.points.at(-1),{x:ends.tx,y:ends.ty});
   assert.notEqual(moved.path,initial.path);
  }
 }
 const straight=connectionGeometry({sx:0,sy:0,tx:250,ty:0});
 assert.equal(nearestConnectionSection(straight.sections,{x:100,y:0}).part,'center');
 const bent=connectionGeometry({sx:0,sy:0,tx:250,ty:0,route:moveConnectionSection(straight.route,'center',80)});
 assert.equal(bent.labelY,80);assert.ok(bent.path.includes('80'));assert.ok(orthogonal(bent.points));
});

test('node movement keeps manual bends, with leads attached to the moved endpoints',()=>{
 const route={center:400,sourceLead:30,targetLead:40};
 const moved=connectionGeometry({sx:170,sy:190,tx:700,ty:500,route});
 assert.deepEqual(moved.points[0],{x:170,y:190});assert.deepEqual(moved.points[1],{x:200,y:190});assert.deepEqual(moved.points.at(-2),{x:660,y:500});assert.equal(moved.labelY,400);
 assert.equal(moveConnectionSection(route,'sourceLead',-1000).sourceLead,8);
 assert.equal(moveConnectionSection(route,'center',200000).center,99999);
});

test('saved and imported bends survive validation; invalid bends are rejected; auto arrange resets them',()=>{
 const graph=arrange(localGenerate(SAMPLE_TEXT));graph.edges[0].route={center:300,sourceLead:20,targetLead:30};
 const restored=validateGraph(JSON.parse(JSON.stringify(graph)));
 assert.deepEqual(restored.edges[0].route,graph.edges[0].route);
 assert.equal(arrange(restored).edges[0].route,undefined);
 for(const route of [{center:Infinity,sourceLead:20,targetLead:20},{center:0,sourceLead:-1,targetLead:20},{center:'300',sourceLead:20,targetLead:20},{center:0,sourceLead:20}]){
  assert.throws(()=>validateGraph({...graph,edges:[{...graph.edges[0],route}]}),/Invalid connection bend/);
 }
});

test('reconnecting preserves the label and stable identity, resets old bends, and prevents invalid connections',()=>{
 const edges=[{id:'e1',source:'a',target:'b',label:'Yes',route:{center:250,sourceLead:20,targetLead:20}},{id:'e2',source:'a',target:'c',label:'No'}];
 const changed=reconnectDiagramEdge(edges,'e1',{source:'b',target:'c'});
 assert.deepEqual(changed[0],{id:'e1',source:'b',target:'c',label:'Yes'});assert.equal(changed.length,2);assert.ok(edges[0].route);
 assert.throws(()=>reconnectDiagramEdge(edges,'e1',{source:'a',target:'a'}),/different steps/);
 assert.throws(()=>reconnectDiagramEdge(edges,'e1',{source:'a',target:'c'}),/already/);
 assert.deepEqual(reconnectDiagramEdge(edges,'e1',{source:'a',target:'b'}),edges);
});

test('SVG and PNG source rendering use the edited route and include bends outside the node bounds',()=>{
 const graph=arrange(localGenerate(SAMPLE_TEXT));
 graph.edges[0].route={center:-800,sourceLead:35,targetLead:45};
 const doc={...graph,theme:'sage',layout:'horizontal',details:true};
 const expected=connectionGeometry({...edgePoints(graph.edges[0],graph.nodes,'horizontal',true),route:graph.edges[0].route});
 const svg=diagramSVG(doc);
 assert.ok(svg.includes(`d="${expected.path}"`));
 assert.ok(Number(svg.match(/height="(\d+)"/)[1])>1000);
 assert.ok(svg.includes('translate(14,924)'));
});
