import dagre from '@dagrejs/dagre';
export const LAYOUTS={
 horizontal:{name:'Landscape',description:'A left-to-right flow with branches.',direction:'horizontal'},
 vertical:{name:'Portrait',description:'A top-to-bottom flow with branches.',direction:'vertical'},
 timeline:{name:'Timeline',description:'An ordered sequence in one row.',direction:'horizontal'},
 stack:{name:'Step list',description:'An ordered sequence in one column.',direction:'vertical'},
 grid:{name:'Card grid',description:'A compact board of evenly spaced ideas.',direction:'horizontal',adaptive:true},
 outline:{name:'Outline',description:'An indented hierarchy of connected ideas.',direction:'vertical'},
 radial:{name:'Mind map',description:'A central idea with branches on surrounding rings.',direction:'horizontal',adaptive:true},
 circle:{name:'Circle',description:'Ideas arranged around a ring. Existing links are preserved.',direction:'horizontal',adaptive:true},
 pyramid:{name:'Pyramid',description:'Widening layers from top to bottom.',direction:'vertical'},
 funnel:{name:'Funnel',description:'Tapering stages from top to bottom.',direction:'vertical'},
};
export const layoutDirection=id=>LAYOUTS[id]?.direction||'horizontal';
export const THEMES = {
  sage: {name:'Botanical',bg:'#ffffff',fill:'#e9f3ec',stroke:'#2d6b4f',text:'#234b38',accent:'#347856',decisionFill:'#fcf0dc',decisionStroke:'#946728',edge:'#718277',colors:['#2d6b4f','#76986d','#c49450']},
  ink: {name:'Ink & paper',bg:'#fffefa',fill:'#f2f0e9',stroke:'#55524b',text:'#292824',accent:'#33312c',decisionFill:'#e8e4dc',decisionStroke:'#55524b',edge:'#827e74',colors:['#33312c','#827e74','#b4afa1']},
  clay: {name:'Soft terracotta',bg:'#fffcfa',fill:'#f9e9e2',stroke:'#9b5343',text:'#623b32',accent:'#9b5343',decisionFill:'#faefd9',decisionStroke:'#9c7533',edge:'#aa887c',colors:['#b56c57','#d9ad8f','#899978']},
  blue: {name:'Blueprint',bg:'#fbfdff',fill:'#e7f0fa',stroke:'#38669d',text:'#284f7d',accent:'#38669d',decisionFill:'#f0ebf9',decisionStroke:'#775b9f',edge:'#718fae',colors:['#38669d','#7396bb','#8c79a6']}
};
export function wrapText(text,max=25){
  const paragraphs=String(text||'').split('\n'); const lines=[];
  for(const paragraph of paragraphs){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));continue;}if(line && (line+' '+word).length>max){lines.push(line);line=word;}else line=line?line+' '+word:word;}if(line)lines.push(line);}
  return lines.length?lines:[''];
}
export function nodeSize(n,details=true){
  const isDecision=n.kind==='decision';const w=Number.isFinite(n.width)?Math.max(210,Math.min(600,n.width)):isDecision?214:210;
  const labelLines=wrapText(n.label,isDecision?20:24).length;
  const detailLines=details&&n.description?wrapText(n.description,isDecision?23:28).length:0;
  return {width:w,height:Math.max(isDecision?112:76,34+labelLines*20+(detailLines?12+detailLines*17:0)+(isDecision?22:0))};
}
export function flowNodeGeometry(n,details=true){
  // Custom SVG cards have explicit sizes. Retain them across controlled updates,
  // including selection and label changes, so dragging always has initialized bounds.
  const size=nodeSize(n,details);
  return {...size,measured:{...size}};
}
export function arrange(graph,layout='horizontal',details=true){
  const nodes=graph.nodes.map(({width,...n})=>n),edges=graph.edges.map(({route,...e})=>e);
  const clean={...graph,nodes,edges};if(!nodes.length)return clean;
  if(!LAYOUTS[layout])layout='horizontal';
  if(layout==='horizontal'||layout==='vertical'){
   const g=new dagre.graphlib.Graph({multigraph:true});g.setGraph({rankdir:layoutDirection(layout)==='vertical'?'TB':'LR',nodesep:48,ranksep:60,marginx:50,marginy:50});g.setDefaultEdgeLabel(()=>({}));
   for(const n of nodes)g.setNode(n.id,nodeSize(n,details));for(const [i,e]of edges.entries())g.setEdge(e.source,e.target,{weight:e.label==='No'?1:2},String(i));dagre.layout(g);
   return {...clean,nodes:nodes.map(n=>{const p=g.node(n.id);return {...n,x:Math.round(p.x-p.width/2),y:Math.round(p.y-p.height/2)};})};
  }
  const {ordered,depth}=graphOrder(nodes,edges),positions=new Map();
  const sizes=new Map(nodes.map(n=>[n.id,nodeSize(n,details)]));
  const maxWidth=Math.max(...[...sizes.values()].map(s=>s.width)),maxHeight=Math.max(...[...sizes.values()].map(s=>s.height));
  if(['timeline','stack','outline','pyramid','funnel'].includes(layout)){
   let cursor=50;
   ordered.forEach((n,i)=>{
    const width=['pyramid','funnel'].includes(layout)?Math.round(210+300*(layout==='pyramid'?i:ordered.length-1-i)/Math.max(1,ordered.length-1)):undefined;
    const size=nodeSize({...n,...(width?{width}:{})},details);
    const x=layout==='timeline'?cursor:layout==='outline'?50+(depth.get(n.id)||0)*75:50+(Math.max(maxWidth,layout==='pyramid'||layout==='funnel'?510:maxWidth)-size.width)/2;
    const y=layout==='timeline'?50+(maxHeight-size.height)/2:cursor;
    positions.set(n.id,{x,y,...(width?{width}:{})});cursor+=(layout==='timeline'?size.width:size.height)+60;
   });
  }else if(layout==='grid'){
   const columns=Math.min(4,Math.ceil(Math.sqrt(nodes.length)));
   ordered.forEach((n,i)=>{const size=sizes.get(n.id);positions.set(n.id,{x:50+(i%columns)*(maxWidth+100)+(maxWidth-size.width)/2,y:50+Math.floor(i/columns)*(maxHeight+100)+(maxHeight-size.height)/2});});
  }else{
   const diameter=Math.hypot(maxWidth,maxHeight),spacing=diameter+70;
   const rings=new Map();
   if(layout==='circle')rings.set(1,ordered);
   else for(const n of ordered){const d=depth.get(n.id)||0;if(!rings.has(d))rings.set(d,[]);rings.get(d).push(n);}
   let priorRadius=0;
   for(const [level,items]of [...rings].sort((a,b)=>a[0]-b[0])){
    const radius=level===0&&items.length===1?0:Math.max(priorRadius+spacing,items.length>1?spacing/(2*Math.sin(Math.PI/items.length)):spacing);
    items.forEach((n,i)=>{const angle=-Math.PI/2+i*Math.PI*2/items.length,size=sizes.get(n.id);positions.set(n.id,{x:radius*Math.cos(angle)-size.width/2,y:radius*Math.sin(angle)-size.height/2});});
    priorRadius=radius;
   }
  }
  const placed=nodes.map(n=>({...n,...positions.get(n.id)}));
  const minX=Math.min(...placed.map(n=>n.x)),minY=Math.min(...placed.map(n=>n.y));
  return {...clean,nodes:placed.map(n=>({...n,x:Math.round(n.x-minX+50),y:Math.round(n.y-minY+50)}))};
}
function graphOrder(nodes,edges){
 const lookup=new Map(nodes.map(n=>[n.id,n])),incoming=new Set(edges.map(e=>e.target)),children=new Map();
 for(const e of edges){if(!children.has(e.source))children.set(e.source,[]);children.get(e.source).push(e.target);}
 const roots=nodes.filter(n=>!incoming.has(n.id)),ordered=[],depth=new Map(),seen=new Set();
 function visit(root){const queue=[[root.id,0]];for(let i=0;i<queue.length;i++){const [id,d]=queue[i];if(seen.has(id)||!lookup.has(id))continue;seen.add(id);depth.set(id,d);ordered.push(lookup.get(id));for(const child of children.get(id)||[])if(!seen.has(child))queue.push([child,d+1]);}}
 for(const root of roots.length?roots:[nodes[0]])visit(root);for(const n of nodes)if(!seen.has(n.id))visit(n);
 return {ordered,depth};
}
export function bounds(nodes,details=true){if(!nodes.length)return {x:0,y:0,width:800,height:480};const xs=nodes.map(n=>n.x||0),ys=nodes.map(n=>n.y||0);const x=Math.min(...xs),y=Math.min(...ys);return {x,y,width:Math.max(...nodes.map(n=>(n.x||0)+nodeSize(n,details).width))-x,height:Math.max(...nodes.map(n=>(n.y||0)+nodeSize(n,details).height))-y};}
export function edgePoints(edge,nodes,layout,details){
 const a=nodes.find(n=>n.id===edge.source),b=nodes.find(n=>n.id===edge.target);if(!a||!b)return null;
 const sa=nodeSize(a,details),sb=nodeSize(b,details),adaptive=Boolean(LAYOUTS[layout]?.adaptive);
 const dx=b.x+sb.width/2-a.x-sa.width/2,dy=b.y+sb.height/2-a.y-sa.height/2;
 const direction=adaptive?(Math.abs(dx)/(sa.width+sb.width)>=Math.abs(dy)/(sa.height+sb.height)?'horizontal':'vertical'):layoutDirection(layout);
 const vertical=direction==='vertical',reverse=adaptive&&(vertical?dy<0:dx<0);
 const sourceSide=vertical?(reverse?'top':'bottom'):(reverse?'left':'right'),targetSide=vertical?(reverse?'bottom':'top'):(reverse?'right':'left');
 return {...(vertical?{sx:a.x+sa.width/2,sy:a.y+(reverse?0:sa.height),tx:b.x+sb.width/2,ty:b.y+(reverse?sb.height:0)}:{sx:a.x+(reverse?0:sa.width),sy:a.y+sa.height/2,tx:b.x+(reverse?sb.width:0),ty:b.y+sb.height/2}),direction,reverse,sourceHandle:adaptive?'port-'+sourceSide:'out',targetHandle:adaptive?'port-'+targetSide:'in'};
}
export function reconcileConnectionRoutes(edges,before,after,layout,details=true){
 if(!LAYOUTS[layout]?.adaptive)return edges;
 return edges.map(e=>{
  if(!e.route)return e;
  const a=edgePoints(e,before,layout,details),b=edgePoints(e,after,layout,details);
  if(a&&b&&(a.direction!==b.direction||a.reverse!==b.reverse)){const {route,...rest}=e;return rest;}
  return e;
 });
}
