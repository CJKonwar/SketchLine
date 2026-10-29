import React from 'react';
import {Plus,FolderOpen,FileText,BookOpen,ShieldCheck,X,ArrowUpRight} from 'lucide-react';

export default function NotebookNav({documents,activeId,onNew,onOpen,onLibrary,onClose,onExample,examples,isPublic,onHelp}){
 return <aside className="notebook-nav" aria-label="Your notes">
  <div className="notebook-nav-top"><button className="button notebook-new" onClick={onNew}><Plus size={16}/>New note</button><button className="icon-button notebook-nav-close" aria-label="Close notes" onClick={onClose}><X size={17}/></button></div>
  <button className="notebook-library" onClick={onLibrary}><FolderOpen size={15}/><span>My notes</span><span className="count">{documents.length}</span></button>
  <nav className="notebook-note-list" aria-label="Notes">{documents.map(d=><button key={d.id} className={'notebook-note '+(activeId===d.id?'current':'')} aria-current={activeId===d.id?'page':undefined} aria-label={`Open note ${d.title}`} onClick={()=>onOpen(d.id)}><FileText size={14}/><span>{d.title}</span></button>)}</nav>
  <div className="notebook-examples"><span className="field-label">Try an example</span>{examples.slice(0,3).map(e=><button key={e.title} onClick={()=>onExample(e)}><BookOpen size={13}/><span>{e.title}</span><ArrowUpRight size={12}/></button>)}</div>
  <div className="notebook-nav-bottom"><p><ShieldCheck size={14}/><span>{isPublic?'Saved in this browser':'Saved on this computer'}</span></p><button className="quiet-link" onClick={onHelp}><BookOpen size={14}/>Quick guide</button></div>
 </aside>;
}
