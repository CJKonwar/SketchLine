const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const rounded=value=>Number(value.toFixed(3));
const point=p=>`${rounded(p.x)},${rounded(p.y)}`;

export function roundedConnectionPath(points,radius=6){
 const distinct=points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);
 if(!distinct.length)return '';
 let path=`M${point(distinct[0])}`;
 for(let i=1;i<distinct.length-1;i++){
  const a=distinct[i-1],b=distinct[i],c=distinct[i+1];
  if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){path+=` L${point(b)}`;continue;}
  const before=Math.hypot(a.x-b.x,a.y-b.y),after=Math.hypot(c.x-b.x,c.y-b.y),r=Math.min(radius,before/2,after/2);
  path+=` L${point({x:b.x+(a.x-b.x)*r/before,y:b.y+(a.y-b.y)*r/before})} Q${point(b)} ${point({x:b.x+(c.x-b.x)*r/after,y:b.y+(c.y-b.y)*r/after})}`;
 }
 if(distinct.length>1)path+=` L${point(distinct.at(-1))}`;
 return path;
}

export function connectionGeometry({sx,sy,tx,ty,layout='horizontal',route,reverse=false}){
 const vertical=layout==='vertical';
 const sign=reverse?-1:1;
 const gap=(vertical?ty-sy:tx-sx)*sign;
 const lead=gap>0?clamp(gap/3,8,24):24;
 const sourceCross=vertical?sx:sy,targetCross=vertical?tx:ty;
 const values={sourceLead:route?.sourceLead??lead,targetLead:route?.targetLead??lead,center:route?.center??(gap<0?Math.max(sourceCross,targetCross)+80:(sourceCross+targetCross)/2)};
 const points=vertical?[
  {x:sx,y:sy},{x:sx,y:sy+values.sourceLead*sign},{x:values.center,y:sy+values.sourceLead*sign},
  {x:values.center,y:ty-values.targetLead*sign},{x:tx,y:ty-values.targetLead*sign},{x:tx,y:ty},
 ]:[
  {x:sx,y:sy},{x:sx+values.sourceLead*sign,y:sy},{x:sx+values.sourceLead*sign,y:values.center},
  {x:tx-values.targetLead*sign,y:values.center},{x:tx-values.targetLead*sign,y:ty},{x:tx,y:ty},
 ];
 const sections=['sourceLead','center','targetLead'].map((part,i)=>{
  const a=points[i+1],b=points[i+2];
  return {part,a,b,x:(a.x+b.x)/2,y:(a.y+b.y)/2,axis:part==='center'?(vertical?'x':'y'):(vertical?'y':'x'),length:Math.hypot(a.x-b.x,a.y-b.y)};
 });
 return {points,sections,route:values,path:roundedConnectionPath(points),labelX:sections[1].x,labelY:sections[1].y};
}

export function nearestConnectionSection(sections,p){
 const distance=section=>{
  const {a,b}=section;const dx=b.x-a.x,dy=b.y-a.y;
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
 };
 return sections.filter(s=>s.length>1).sort((a,b)=>distance(a)-distance(b))[0]||sections[1];
}

export function moveConnectionSection(route,part,delta,reverse=false){
 const sign=(part==='targetLead'?-1:1)*(reverse&&part!=='center'?-1:1);
 return {...route,[part]:rounded(clamp(route[part]+delta*sign,part==='center'?-99999:8,part==='center'?99999:10000))};
}

export function reconnectDiagramEdge(edges,id,connection){
 if(!connection.source||!connection.target||connection.source===connection.target)throw new Error('Connect two different steps.');
 if(edges.some(e=>e.id!==id&&e.source===connection.source&&e.target===connection.target))throw new Error('These steps already have a connection.');
 return edges.map(e=>{
  if(e.id!==id)return e;
  if(e.source===connection.source&&e.target===connection.target)return e;
  const {route,...rest}=e;
  return {...rest,source:connection.source,target:connection.target};
 });
}
