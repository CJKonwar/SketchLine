import {validateGraph} from '../../shared/diagram.mjs';
import {DEFAULT_GEMINI_MODEL,geminiRequestBody,geminiResponseText} from '../../shared/gemini.mjs';

export {DEFAULT_GEMINI_MODEL};
export const GEMINI_SESSION='sketchline-gemini-tab-v1';
export const GEMINI_MODEL_PREFERENCE='sketchline-gemini-model-v1';
export function cleanGeminiModel(input){
 const model=typeof input==='string'?input.trim():'';
 if(!/^gemini-[a-zA-Z0-9._-]{1,120}$/.test(model))throw new Error('Choose a valid Gemini model.');
 return model;
}
export function isDiagramGeminiModel(model){
 try{cleanGeminiModel(model);}catch{return false;}
 return !/(?:^|-)(?:image|tts|audio|live|transcribe|robotics|computer|embedding|nano-banana|customtools)(?:-|$)/i.test(model);
}
export function readGeminiModel(storage){
 try{return cleanGeminiModel(storage?.getItem(GEMINI_MODEL_PREFERENCE)||DEFAULT_GEMINI_MODEL);}catch{return DEFAULT_GEMINI_MODEL;}
}
export function saveGeminiModel(storage,model){
 try{storage.setItem(GEMINI_MODEL_PREFERENCE,cleanGeminiModel(model));return true;}catch{return false;}
}
export function preferredGeminiModel(models,preferred=DEFAULT_GEMINI_MODEL){
 return models.find(m=>m.id===preferred)?.id||models.find(m=>m.id===DEFAULT_GEMINI_MODEL)?.id||models[0]?.id||DEFAULT_GEMINI_MODEL;
}
const endpoint=model=>{
 model=cleanGeminiModel(model);
 return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`;
};
export function cleanGeminiKey(input){
 const key=typeof input==='string'?input.trim():'';
 if(key.length<12||key.length>512||!/^[\x21-\x7e]+$/.test(key))throw new Error('Paste the API key from Google AI Studio, without spaces or quotes.');
 if(/^['"]|['"]$/.test(key))throw new Error('Paste just the API key, without surrounding quotes.');
 return key;
}
export function readGeminiSession(storage){
 try{const saved=JSON.parse(storage?.getItem(GEMINI_SESSION)||'null');return saved?cleanGeminiKey(saved.key):'';}catch{return '';}
}
export function saveGeminiSession(storage,key,remember){
 try{if(remember)storage.setItem(GEMINI_SESSION,JSON.stringify({key:cleanGeminiKey(key)}));else storage.removeItem(GEMINI_SESSION);return true;}catch{return false;}
}
function providerError(status,data){
 const invalid=data?.error?.details?.some?.(d=>d.reason==='API_KEY_INVALID');
 if(invalid||status===401)return new Error('Google did not accept this API key. Check it in Google AI Studio and try again.');
 if(status===403)return new Error('This key does not have permission to use Gemini from this site. Check its API and website restrictions in Google AI Studio.');
 if(status===429)return new Error('Your Google API quota or rate limit has been reached. Check your Google account, try later, or use the local generator.');
 if(status===404)return new Error('This Gemini model is not available for generation with this key. Choose another model in Gemini settings.');
 if([408,500,502,503,504].includes(status))return new Error(`Google Gemini is temporarily unavailable (${status}). Try again shortly, or use the local generator.`);
 return new Error(`Google could not complete this request (${status}). Check your Gemini key and account settings.`);
}
async function request(url,key,{signal,fetchImpl,timeoutMs=35000,...options}){
 signal?.throwIfAborted();
 const deadline=AbortSignal.timeout(timeoutMs);
 try{
  const response=await fetchImpl(url,{...options,signal:signal?AbortSignal.any([signal,deadline]):deadline,credentials:'omit',cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin',headers:{...(options.method==='POST'?{'Content-Type':'application/json'}:{}),'x-goog-api-key':key}});
  let data;try{data=JSON.parse(await response.text());}catch(error){if(deadline.aborted||signal?.aborted)throw error;data={};}
  return {response,data};
 }catch{
  if(signal?.aborted)throw signal.reason;
  if(deadline.aborted)throw new Error('Google Gemini took too long to respond. Try again, or use the local generator.');
  throw new Error('Could not reach Google Gemini. Check your connection, browser blocking, and the key’s website restrictions.');
 }
}
export async function checkGeminiKey(input,{model=DEFAULT_GEMINI_MODEL,signal,fetchImpl=globalThis.fetch}={}){
 const key=cleanGeminiKey(input);
 const {response,data}=await request(endpoint(model),key,{signal,fetchImpl,timeoutMs:12000});
 if(!response.ok)throw providerError(response.status,data);
 if(!data?.supportedGenerationMethods?.includes('generateContent'))throw new Error('This key cannot access a text-generation model. Check your Google AI Studio project.');
 return {model,accepted:true};
}
export async function listGeminiModels(input,{signal,fetchImpl=globalThis.fetch}={}){
 const key=cleanGeminiKey(input),models=new Map(),seen=new Set();
 const deadline=AbortSignal.timeout(20000),combined=signal?AbortSignal.any([signal,deadline]):deadline;
 let token='';
 try{
  for(let page=0;page<5;page++){
   const query=new URLSearchParams({pageSize:'1000'});if(token)query.set('pageToken',token);
   const {response,data}=await request('https://generativelanguage.googleapis.com/v1beta/models?'+query,key,{signal:combined,fetchImpl,timeoutMs:12000});
   if(!response.ok)throw providerError(response.status,data);
   if(!Array.isArray(data.models))throw new Error('Google returned an unreadable model list. Try refreshing the list.');
   for(const item of data.models){
    const id=typeof item?.name==='string'?item.name.replace(/^models\//,''):'';
    if(!isDiagramGeminiModel(id)||!Array.isArray(item.supportedGenerationMethods)||!item.supportedGenerationMethods.includes('generateContent'))continue;
    models.set(id,{id,label:typeof item.displayName==='string'?item.displayName.slice(0,128):id});
   }
   const next=data.nextPageToken;
   if(!next){if(!models.size)throw new Error('Google returned no compatible Gemini text models for this key. Check its permissions in Google AI Studio.');return [...models.values()].sort((a,b)=>(a.id===DEFAULT_GEMINI_MODEL?-1:b.id===DEFAULT_GEMINI_MODEL?1:a.label.localeCompare(b.label,undefined,{numeric:true})));}
   if(typeof next!=='string'||next.length>4096||seen.has(next))throw new Error('Google returned an incomplete model list. Try refreshing the list.');
   seen.add(next);token=next;
  }
  throw new Error('Google returned too many model pages. Try refreshing the list.');
 }catch(error){
  if(signal?.aborted)throw signal.reason;
  if(deadline.aborted)throw new Error('Google took too long to load the models. Try refreshing the list.');
  throw error;
 }
}
function pause(ms,signal){
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();
  const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
  const timer=setTimeout(done,ms);
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  signal?.addEventListener('abort',abort,{once:true});
 });
}
export async function generateWithGemini(input,text,kind,{model=DEFAULT_GEMINI_MODEL,signal,fetchImpl=globalThis.fetch,retryDelayMs=1000}={}){
 const key=cleanGeminiKey(input);
 if(typeof text!=='string'||text.trim().length<8||text.length>16000)throw new Error('Use 8 to 16,000 characters of source text.');
 if(!['flowchart','mindmap'].includes(kind))throw new Error('Choose a flowchart or mind map.');
 let data;
 for(let attempt=1;attempt<=2;attempt++){
  const result=await request(endpoint(model)+':generateContent',key,{method:'POST',body:JSON.stringify(geminiRequestBody(text,kind,model)),signal,fetchImpl});
  data=result.data;
  if(result.response.ok)break;
  if(attempt===1&&[408,500,502,503,504].includes(result.response.status)){await pause(retryDelayMs,signal);continue;}
  throw providerError(result.response.status,data);
 }
 const value=geminiResponseText(data);
 if(!value)throw new Error('Google Gemini returned no diagram. Try more specific source text.');
 let graph;try{graph=JSON.parse(value);}catch{throw new Error('Google Gemini returned invalid diagram data. Please try again.');}
 return validateGraph(graph);
}
