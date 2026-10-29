import test from 'node:test';
import {adoptUserNodes,calculateNodePosition} from '@xyflow/system';
import {flowNodeGeometry} from '../src/lib/layout.mjs';
import assert from 'node:assert/strict';
import {localGenerate,validateGraph,SAMPLE_TEXT} from '../shared/diagram.mjs';
import {arrange,nodeSize} from '../src/lib/layout.mjs';
import {diagramSVG} from '../src/lib/export.mjs';
test('local order text preserves both branches and a two-step positive path',()=>{const g=localGenerate(SAMPLE_TEXT);assert.equal(g.nodes.length,5);assert.equal(g.edges.length,4);const decision=g.nodes.find(n=>n.kind==='decision');const outgoing=g.edges.filter(e=>e.source===decision.id);assert.deepEqual(new Set(outgoing.map(e=>e.label)),new Set(['Yes','No']));const pack=g.nodes.find(n=>n.label.includes('Pack'));const ship=g.nodes.find(n=>n.label.includes('Ship'));assert.ok(g.edges.some(e=>e.source===pack.id&&e.target===ship.id));});
test('mind map uses the first line as the root and preserves distinct ideas',()=>{const g=localGenerate('Weekend project\nDesign: Sketch the screens\nBuild: Make a small version\nShare: Ask for feedback','mindmap');assert.equal(g.nodes.length,4);assert.ok(g.edges.every(e=>e.source==='root'));assert.equal(g.nodes[1].description,'Sketch the screens');});
test('invalid model and imported data cannot create dangling connections or duplicate IDs',()=>{assert.throws(()=>validateGraph({nodes:[{id:'a',label:'One'},{id:'a',label:'Two'}],edges:[]}));assert.throws(()=>validateGraph({nodes:[{id:'a',label:'One'}],edges:[{source:'a',target:'missing'}]}));assert.throws(()=>validateGraph({nodes:[{id:'a',label:'One',kind:'script'}],edges:[]}));});
test('long descriptions receive real space and arranged node boxes do not overlap',()=>{const g=localGenerate(SAMPLE_TEXT);g.nodes[0].description='This is a longer description of the step that must wrap into several visible lines without clipping its content.';const a=arrange(g,'horizontal',true);for(let i=0;i<a.nodes.length;i++)for(let j=i+1;j<a.nodes.length;j++){const n=a.nodes[i],m=a.nodes[j],s=nodeSize(n),t=nodeSize(m);assert.ok(n.x+s.width<=m.x||m.x+t.width<=n.x||n.y+s.height<=m.y||m.y+t.height<=n.y);}assert.ok(nodeSize(g.nodes[0]).height>90);});
test('SVG export preserves edited labels and vector primitives while escaping markup',()=>{const g=arrange(localGenerate(SAMPLE_TEXT));g.nodes[0].label='Order <script> & "review"';const doc={...g,title:'My <flow>',theme:'sage',layout:'horizontal',details:true};const svg=diagramSVG(doc);assert.ok(svg.includes('Order &lt;script&gt; &amp;'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('<text'));assert.ok(svg.includes('marker-end'));assert.ok(svg.includes('My &lt;flow&gt;'));});
test('card bounds stay initialized through selection, edits and repeated drag updates',()=>{
 const nodeLookup=new Map(),parentLookup=new Map(),warnings=[];
 let node={id:'drag-test',type:'diagram',position:{x:50,y:50},data:{label:'Review request'}};
 for(const label of ['Review request','Review carefully','A longer label with supporting details']){
  const data={label,kind:'process',description:'Some details that change the height.'};
  node={...node,selected:!node.selected,data,...flowNodeGeometry(data,true)};
  const initialized=adoptUserNodes([node],nodeLookup,parentLookup).nodesInitialized;
  assert.equal(initialized,true);
  const next=calculateNodePosition({nodeId:node.id,nextPosition:{x:node.position.x+20,y:node.position.y+30},nodeLookup,nodeOrigin:[0,0],onError:(code)=>warnings.push(code)});
  assert.deepEqual(next.position,{x:node.position.x+20,y:node.position.y+30});
  node={...node,position:next.position};
 }
 assert.deepEqual(warnings,[]);
});
