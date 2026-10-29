import React,{useCallback,useEffect,useLayoutEffect,useRef} from 'react';
import {FileText,GitBranch,Network,Sparkles,Loader2,ArrowRight,AlertCircle,KeyRound,PanelLeftOpen,Settings2} from 'lucide-react';

export default function NotebookEditor({doc,sourceRef,loading,kind,onKind,onTitle,onText,onFocus,onGenerate,error,usingAI,provider,onEngine,onNotes,onDesign,savedLabel}){
 const width=useRef(0);
 const resize=useCallback(()=>{const el=sourceRef.current;if(!el)return;el.style.height='0px';el.style.height=Math.max(150,el.scrollHeight)+'px';},[sourceRef]);
 useLayoutEffect(resize,[doc.source,resize]);
 useEffect(()=>{const parent=sourceRef.current?.parentElement;if(!parent)return;const observer=new ResizeObserver(()=>{if(width.current!==parent.clientWidth){width.current=parent.clientWidth;resize();}});observer.observe(parent);return()=>observer.disconnect();},[resize,sourceRef]);
 return <section className="notebook-editor">
  <div className="notebook-page-meta"><button className="icon-button notebook-nav-toggle" aria-label="Open notes" title="Open notes" onClick={onNotes}><PanelLeftOpen size={17}/></button><span><FileText size={12}/>NOTEBOOK</span><span className="notebook-save-label">{savedLabel}</span><button className="quiet-button notebook-design" onClick={onDesign}><Settings2 size={14}/>Design</button></div>
  <label className="screen-reader-only" htmlFor="note-title">Note title</label><input id="note-title" className="notebook-title" value={doc.title} maxLength={120} onFocus={onFocus} onChange={e=>onTitle(e.target.value)} onBlur={()=>{if(!doc.title.trim())onTitle('Untitled note');}} placeholder="Untitled note"/>
  <label className="screen-reader-only" htmlFor="notebook-text">Your notes</label>
  <div className="notebook-writing"><textarea id="notebook-text" ref={sourceRef} value={doc.source} maxLength={16000} disabled={loading} onFocus={onFocus} onChange={e=>onText(e.target.value)} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();onGenerate();}}} placeholder={'Start writing, or paste your notes here…\n\nExplain a process, explore an idea, or describe how things connect.'}/></div>
  <div className="notebook-generate-row"><div className="segmented type-picker"><button className={kind==='flowchart'?'active':''} onClick={()=>onKind('flowchart')} aria-pressed={kind==='flowchart'}><GitBranch size={14}/>Flowchart</button><button className={kind==='mindmap'?'active':''} onClick={()=>onKind('mindmap')} aria-pressed={kind==='mindmap'}><Network size={14}/>Mind map</button></div><button className="button primary notebook-generate" onClick={onGenerate} disabled={loading||doc.source.trim().length<8}>{loading?<Loader2 size={16} className="spin"/>:<Sparkles size={16}/>}<span>{loading?'Creating your visual…':'Generate visual'}</span>{!loading&&<ArrowRight size={15}/>}</button></div>
  <div className="notebook-writing-footer"><button className="quiet-link" onClick={onEngine}>{usingAI?<Sparkles size={12}/>:<KeyRound size={12}/>}<span>{usingAI?provider:'Connect Gemini for AI generation'}</span></button><span>{doc.source.length.toLocaleString()} / 16,000<span className="notebook-shortcut"> · ⌘ / Ctrl + Enter</span></span></div>
  {error&&<div className="inline-error notebook-error" role="alert"><AlertCircle size={15}/><span>{error}</span></div>}
 </section>;
}
