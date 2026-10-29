import React,{useEffect,useRef,useState} from 'react';
import {CheckCheck,KeyRound,Loader2,ExternalLink,AlertCircle,RefreshCw} from 'lucide-react';
import {listGeminiModels,cleanGeminiKey,preferredGeminiModel,DEFAULT_GEMINI_MODEL} from './lib/gemini-client.mjs';

export default function GeminiKeyForm({connected,apiKey,model,models,onModels,onModelChange,generating,onConnect,onDisconnect}){
 const [draft,setDraft]=useState(''),[remember,setRemember]=useState(false),[checking,setChecking]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const pending=useRef();
 useEffect(()=>()=>pending.current?.abort(),[]);
 useEffect(()=>{
  if(!connected||models.length)return;
  const controller=new AbortController();pending.current=controller;setRefreshing(true);setError('');
  listGeminiModels(apiKey,{signal:controller.signal}).then(onModels).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setRefreshing(false);});
  return()=>controller.abort();
 },[connected,apiKey]);
 async function connect(event){
  event.preventDefault();if(checking)return;
  setError('');setChecking(true);const controller=new AbortController();pending.current=controller;
  try{
   const key=cleanGeminiKey(draft);const available=await listGeminiModels(key,{signal:controller.signal});if(controller.signal.aborted)return;
   onConnect(key,remember,preferredGeminiModel(available,model),available);setDraft('');
  }catch(e){if(!controller.signal.aborted)setError(e.message);}
  finally{if(!controller.signal.aborted)setChecking(false);}
 }
 async function refresh(){
  if(refreshing||generating)return;
  pending.current?.abort();const controller=new AbortController();pending.current=controller;setRefreshing(true);setError('');
  try{const available=await listGeminiModels(apiKey,{signal:controller.signal});if(!controller.signal.aborted)onModels(available);}
  catch(e){if(!controller.signal.aborted)setError(e.message);}
  finally{if(!controller.signal.aborted)setRefreshing(false);}
 }
 const listed=models.some(m=>m.id===model),busy=refreshing||generating;
 return <div className="gemini-key-form">
  <div className="key-intro"><span className="key-intro-icon"><KeyRound size={21}/></span><div><h3>Your key. Your Google quota.</h3><p>Sketchline has no usage fee. Google’s API quotas and any charges apply to your key.</p></div></div>
  {connected?<>
   <div className="key-connected"><CheckCheck size={19}/><div><strong>Your Gemini key is connected</strong><p>Requests go directly from your browser to Google.</p><button className="button" onClick={()=>{pending.current?.abort();setRefreshing(false);setChecking(false);setError('');onDisconnect();}}>Disconnect key</button></div></div>
   <div className="gemini-model-picker"><div className="gemini-model-heading"><label className="field-label" htmlFor="gemini-model">Gemini model</label><button className="quiet-link" type="button" onClick={refresh} disabled={busy} aria-label="Refresh Gemini models">{refreshing?<Loader2 size={13} className="spin"/>:<RefreshCw size={13}/>}<span>{refreshing?'Loading…':'Refresh models'}</span></button></div>
    <select id="gemini-model" className="property-select" value={model} disabled={busy||!models.length} aria-describedby="gemini-model-hint" onChange={e=>onModelChange(e.target.value)}>
     {!listed&&<option value={model}>{model}{models.length?' (not in current list)':''}</option>}
     {models.map(m=><option key={m.id} value={m.id}>{m.label} · {m.id}{m.id===DEFAULT_GEMINI_MODEL?' (recommended)':''}</option>)}
    </select>
    <p className="gemini-model-id">{model}</p><p className="key-privacy" id="gemini-model-hint">{generating?'A visual is being generated. You can change models when it finishes.':refreshing?'Loading text models from Google…':'The next visual uses this model. Existing diagrams stay as they are.'} Model availability, response time, and costs can differ. {models.length>0&&`${models.length} text models returned by Google.`}</p>
    {!listed&&models.length>0&&<p className="gemini-model-notice" role="status">Your saved model was not returned by Google. Choose another model from the list.</p>}
   </div>
  </>:<form onSubmit={connect} noValidate>
   <label className="field-label" htmlFor="visitor-gemini-key">Gemini API key</label>
   <input id="visitor-gemini-key" className="property-input api-key-input" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={512} value={draft} disabled={checking} onChange={e=>{setDraft(e.target.value);setError('');}} placeholder="Paste your Google AI Studio key" aria-describedby={'key-privacy'+(error?' key-error':'')}/>
   <label className="key-remember"><input type="checkbox" checked={remember} disabled={checking} onChange={e=>setRemember(e.target.checked)}/><span>Remember for this tab, including refreshes</span></label>
   <p className="key-privacy" id="key-privacy">{remember?'Kept in this tab’s session storage. Disconnect to remove it.':'Kept in memory only. Refreshing or closing this page clears it.'} Your key is sent only to Google. It is excluded from diagrams and exports. Connect to choose a model.</p>
   <button className="button primary key-connect-button" type="submit" disabled={checking||!draft.trim()}>{checking?<Loader2 size={16} className="spin"/>:<KeyRound size={16}/>}<span>{checking?'Checking models with Google…':'Check and connect'}</span></button>
  </form>}
  {error&&<div className="inline-error key-error" id="key-error" role="alert"><AlertCircle size={15}/><span>{error}</span></div>}
  <a className="quiet-link key-get-link" href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Get a key in Google AI Studio<ExternalLink size={13}/></a>
 </div>;
}
