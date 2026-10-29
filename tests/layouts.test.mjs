import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYOUTS,arrange,nodeSize,edgePoints,reconcileConnectionRoutes} from '../src/lib/layout.mjs';
import {connectionGeometry,moveConnectionSection} from '../src/lib/connections.mjs';
import {localGenerate,validateGraph,SAMPLE_TEXT} from '../shared/diagram.mjs';
import {diagramSVG} from '../src/lib/export.mjs';

function noOverlaps(graph){
 for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
  const a=graph.nodes[i],b=graph.nodes[j],s=nodeSize(a),t=nodeSize(b);
  assert.ok(a.x+s.width<=b.x||b.x+t.width<=a.x||a.y+s.height<=b.y||b.y+t.height<=a.y,`${a.id} overlaps ${b.id}`);
 }
}
const crowded={title:'Many ideas',kind:'mindmap',nodes:Array.from({length:40},(_,i)=>({id:'n'+i,label:'Idea '+i,description:i%4===0?'A long supporting description with enough detail to wrap across multiple lines. '.repeat(3):'',kind:i===0?'topic':'process'})),edges:Array.from({length:39},(_,i)=>({id:'e'+i,source:'n'+Math.floor(i/3),target:'n'+(i+1),label:''}))};
const cycle={title:'Cycle',nodes:[{id:'a',label:'Start'},{id:'b',label:'Continue'},{id:'c',label:'Review'}],edges:[{source:'a',target:'b'},{source:'b',target:'c'},{source:'c',target:'a'}]};

test('all ten layouts preserve content and connections, with finite non-overlapping cards',()=>{
 assert.equal(Object.keys(LAYOUTS).length,10);
 for(const layout of Object.keys(LAYOUTS))for(const original of [localGenerate(SAMPLE_TEXT),crowded,cycle,{...crowded,nodes:crowded.nodes.slice(0,8),edges:[]}]){
  const output=arrange(original,layout,true);
  assert.equal(output.nodes.length,original.nodes.length);assert.equal(output.edges.length,original.edges.length);
  assert.deepEqual(output.nodes.map(n=>n.id),original.nodes.map(n=>n.id));
  assert.deepEqual(output.edges.map(e=>[e.source,e.target,e.label]),original.edges.map(e=>[e.source,e.target,e.label]));
  for(const n of output.nodes){assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));assert.ok(n.x>=0&&n.y>=0);}
  noOverlaps(output);
 }
});

test('presets provide distinct arrangements and tapered widths survive save/import/export',()=>{
 const graph=localGenerate(SAMPLE_TEXT),signatures=new Set();
 for(const id of Object.keys(LAYOUTS)){const g=arrange(graph,id);signatures.add(JSON.stringify(g.nodes.map(n=>[n.x,n.y,n.width])));}
 assert.ok(signatures.size>=9);
 const pyramid=arrange(graph,'pyramid'),funnel=arrange(graph,'funnel');
 assert.ok(pyramid.nodes[0].width<pyramid.nodes.at(-1).width);assert.ok(funnel.nodes[0].width>funnel.nodes.at(-1).width);
 const restored=validateGraph(JSON.parse(JSON.stringify(pyramid)));
 assert.equal(restored.nodes.at(-1).width,pyramid.nodes.at(-1).width);
 assert.ok(diagramSVG({...restored,layout:'pyramid',theme:'sage'}).includes('width="510"'));
 assert.ok(arrange(pyramid,'horizontal').nodes.every(n=>n.width===undefined));
});

test('radial and card layouts use the nearest pair of compatible ports, including reversed directions',()=>{
 const a={id:'a',label:'Root',x:500,y:500},edge={source:'a',target:'b'};
 for(const [x,y,direction,reverse,sourceHandle,targetHandle]of [[900,500,'horizontal',false,'port-right','port-left'],[0,500,'horizontal',true,'port-left','port-right'],[500,900,'vertical',false,'port-bottom','port-top'],[500,0,'vertical',true,'port-top','port-bottom']]){
  const ports=edgePoints(edge,[a,{id:'b',label:'Child',x,y}],'radial',true);
  assert.equal(ports.direction,direction);assert.equal(ports.reverse,reverse);assert.equal(ports.sourceHandle,sourceHandle);assert.equal(ports.targetHandle,targetHandle);
  const geometry=connectionGeometry({...ports,layout:ports.direction});
  assert.deepEqual(geometry.points[0],{x:ports.sx,y:ports.sy});assert.deepEqual(geometry.points.at(-1),{x:ports.tx,y:ports.ty});
  const route=moveConnectionSection(geometry.route,'sourceLead',10,reverse);
  assert.equal(route.sourceLead,Math.max(8,geometry.route.sourceLead+(reverse?-10:10)));
 }
});

test('manual bends reset only when adaptive connections change orientation',()=>{
 const before=[{id:'a',label:'A',x:0,y:0},{id:'b',label:'B',x:500,y:0}],edges=[{id:'e',source:'a',target:'b',route:{center:100,sourceLead:20,targetLead:20}}];
 assert.ok(reconcileConnectionRoutes(edges,before,[before[0],{...before[1],x:600}],'radial')[0].route);
 assert.equal(reconcileConnectionRoutes(edges,before,[before[0],{...before[1],x:0,y:500}],'radial')[0].route,undefined);
 assert.ok(reconcileConnectionRoutes(edges,before,[before[0],{...before[1],x:0,y:500}],'horizontal')[0].route);
});
