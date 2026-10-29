import React,{useRef} from 'react';
import {BaseEdge,useReactFlow,useViewport} from '@xyflow/react';
import {connectionGeometry,nearestConnectionSection,moveConnectionSection} from './lib/connections.mjs';

export default function DiagramEdge({id,sourceX,sourceY,targetX,targetY,label,markerEnd,style,selected,data}){
 const {screenToFlowPosition}=useReactFlow();
 const {zoom}=useViewport();
 const dragging=useRef(null);
 const geometry=connectionGeometry({sx:sourceX,sy:sourceY,tx:targetX,ty:targetY,layout:data.layout,route:data.route,reverse:data.reverse});
 const enabled=!data.preview&&!data.panMode;
 const position=e=>screenToFlowPosition({x:e.clientX,y:e.clientY});
 function start(e,part){
  if(!enabled||e.button!==0)return;
  e.stopPropagation();e.preventDefault();
  const p=position(e),section=part?geometry.sections.find(s=>s.part===part):nearestConnectionSection(geometry.sections,p);
  data.onSelect(id);
  dragging.current={pointerId:e.pointerId,start:p,screen:{x:e.clientX,y:e.clientY},route:geometry.route,original:data.route||null,section,changed:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function move(e){
  const drag=dragging.current;if(!drag||drag.pointerId!==e.pointerId)return;
  e.stopPropagation();
  if(!drag.changed&&Math.hypot(e.clientX-drag.screen.x,e.clientY-drag.screen.y)<3)return;
  if(!drag.changed){data.onStart();drag.changed=true;}
  const p=position(e),axis=drag.section.axis;
  data.onChange(id,moveConnectionSection(drag.route,drag.section.part,p[axis]-drag.start[axis],data.reverse));
 }
 function finish(e,cancel=false){
  const drag=dragging.current;if(!drag||drag.pointerId!==e.pointerId)return;
  e.stopPropagation();
  if(cancel&&drag.changed)data.onChange(id,drag.original);
  dragging.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }
 function key(e,section){
  if(!enabled)return;
  const axisKeys=section.axis==='x'?{ArrowLeft:-1,ArrowRight:1}:{ArrowUp:-1,ArrowDown:1};
  if(!axisKeys[e.key])return;
  e.preventDefault();e.stopPropagation();data.onStart();
  data.onChange(id,moveConnectionSection(geometry.route,section.part,axisKeys[e.key]*(e.shiftKey?20:5),data.reverse));
 }
 const pointerEvents={onPointerMove:move,onPointerUp:e=>finish(e),onPointerCancel:e=>finish(e,true),onLostPointerCapture:()=>{dragging.current=null;}};
 return <>
  <BaseEdge id={id} path={geometry.path} markerEnd={markerEnd} style={style} interactionWidth={0} label={label} labelX={geometry.labelX} labelY={geometry.labelY} labelStyle={{fill:data.text,fontSize:12,fontWeight:500}} labelBgStyle={{fill:data.background}} labelBgPadding={[7,4]} labelBgBorderRadius={4}/>
  <path d={geometry.path} className={'edge-route-hit nodrag nopan '+(enabled?'is-editable':'')} fill="none" stroke="transparent" strokeWidth={22/zoom} onPointerDown={e=>start(e)} {...pointerEvents}/>
  {selected&&enabled&&<>
   <circle className="edge-endpoint" cx={sourceX} cy={sourceY} r={4/zoom}/><circle className="edge-endpoint" cx={targetX} cy={targetY} r={4/zoom}/>
   {geometry.sections.map(section=><g key={section.part} className="edge-bend-handle nodrag nopan" role="button" tabIndex={section.length>1?0:-1} aria-label={`Move ${section.part==='center'?'middle':section.part==='sourceLead'?'starting':'ending'} line section`} style={{visibility:section.length>1?'visible':'hidden',cursor:section.axis==='x'?'ew-resize':'ns-resize'}} onKeyDown={e=>key(e,section)} onPointerDown={e=>start(e,section.part)} {...pointerEvents}>
    <title>{`Drag ${section.axis==='x'?'left or right':'up or down'} to reshape. Arrow keys move by 5; Shift moves by 20.`}</title>
    <circle cx={section.x} cy={section.y} r={12/zoom} fill="transparent" className="edge-bend-hit"/>
    <rect x={section.x-5/zoom} y={section.y-5/zoom} width={10/zoom} height={10/zoom} rx={2/zoom} className="edge-bend-square"/>
   </g>)}
  </>}
 </>;
}
