import http from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateGraph, localGenerate } from '../shared/diagram.mjs';
import { getAIConfig, getAIStatus, generateWithAI } from './ai.mjs';
import { createDiagnostics } from './diagnostics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.env.SKETCHLINE_SKIP_ENV!=='1') try { for(const line of (await readFile(path.join(root,'.env'),'utf8')).split('\n')) { const m=line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);if(m && !process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2'); }}catch{}
const port=Number(process.env.PORT||4317); const dev=process.argv.includes('--dev');
let vite; if(dev){ const { createServer }=await import('vite');vite=await createServer({root,server:{middlewareMode:true},appType:'spa'}); }
const aiConfig=getAIConfig();
const aiStatus=getAIStatus(aiConfig);
const dataPath=process.env.SKETCHLINE_DATA_DIR||path.join(root,'data');
const diagnostics=createDiagnostics(dataPath);
const workspaceFile=path.join(dataPath,'workspace.json');let writing=Promise.resolve();
function send(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req,max=2_000_000){let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>max){throw new Error('This file is too large.');}}try{return JSON.parse(text);}catch{throw new Error('Please send valid JSON.');}}
function validateWorkspace(w){if(!w||!Array.isArray(w.documents)||w.documents.length>200)throw new Error('Invalid workspace.');const ids=new Set();for(const d of w.documents){if(!d.id||typeof d.id!=='string'||ids.has(d.id))throw new Error('Document IDs must be unique.');ids.add(d.id);validateGraph(d,{allowEmpty:true});}return w;}
const server=http.createServer(async(req,res)=>{
  const host=req.headers.host||'';
  if(!new RegExp(`^(?:127\\.0\\.0\\.1|localhost):${port}$`).test(host)){send(res,403,{error:'This app is available only on this computer.'});return;}
  const origin=req.headers.origin;
  if(origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(origin)){send(res,403,{error:'Request origin is not allowed.'});return;}
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  try{
    if(url.pathname==='/api/status'){if(req.method!=='GET'){send(res,405,{error:'Method not allowed.'});return;}send(res,200,{...aiStatus,storage:'local-files'});return;}
    if(url.pathname==='/api/workspace'){
      if(req.method==='GET'){try{send(res,200,JSON.parse(await readFile(workspaceFile,'utf8')));}catch(e){if(e.code==='ENOENT')send(res,200,{documents:[]});else throw new Error('The saved workspace could not be read. Your browser copy is still available.');}return;}
      if(req.method==='PUT'){
        if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'JSON is required.'});return;}
        const workspace=validateWorkspace(await body(req));
        const task=writing.catch(()=>{}).then(async()=>{await mkdir(dataPath,{recursive:true,mode:0o700});const temporary=workspaceFile+'.tmp';await writeFile(temporary,JSON.stringify(workspace,null,2),{mode:0o600});await rename(temporary,workspaceFile);});writing=task;await task;send(res,200,{saved:true});return;
      }
      send(res,405,{error:'Method not allowed.'});return;
    }
    if(url.pathname==='/api/generate'){
      if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return;}
      if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'JSON is required.'});return;}
      const {text,kind,engine}=await body(req,100000);
      if(typeof text!=='string'||text.trim().length<8||text.length>16000)throw new Error('Use 8 to 16,000 characters of source text.');
      if(!['flowchart','mindmap'].includes(kind))throw new Error('Choose a flowchart or mind map.');
      if(engine==='ai'&&!aiStatus.aiConfigured)throw new Error(`Add ${aiConfig.provider==='gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY'} to your local .env file, then restart Sketchline.`);
      const ai=engine==='ai'&&aiStatus.aiConfigured;
      const requestId=randomUUID();const started=performance.now();res.setHeader('X-Request-Id',requestId);
      const log=(event,details={})=>diagnostics({requestId,event,provider:ai?aiConfig.provider:'local',model:ai?aiConfig.model:'local',elapsedMs:Math.round(performance.now()-started),...details});
      log('generation_started',{inputCharacters:text.length});
      const cancelled=new AbortController();const cancel=()=>{if(!res.writableEnded)cancelled.abort();};res.once('close',cancel);
      let diagram;try{diagram=ai?await generateWithAI(text,kind,AbortSignal.any([AbortSignal.timeout(75000),cancelled.signal]),{config:aiConfig,onEvent:({event,...details})=>log(event,details)}):localGenerate(text,kind);}catch(error){await log(cancelled.signal.aborted?'generation_cancelled':'generation_failed',{errorCode:error.code||error.name,networkCode:error.networkCode,httpStatus:error.status||(error.name==='TimeoutError'?504:400)});if(!res.destroyed)send(res,error.status||(error.name==='TimeoutError'?504:400),{error:error.name==='TimeoutError'?`${aiConfig.providerLabel} did not finish within 75 seconds. Try again shortly, or use the local generator.`:error.message||'Something went wrong.',code:error.code||error.name,requestId});return;}finally{res.removeListener('close',cancel);}
      if(res.destroyed)return;
      await log('generation_complete',{nodeCount:diagram.nodes.length,edgeCount:diagram.edges.length});
      send(res,200,{diagram,engine:ai?'ai':'local',requestId,durationMs:Math.round(performance.now()-started)});return;
    }
    if(url.pathname.startsWith('/api/')){send(res,404,{error:'Not found.'});return;}
    if(/^\/(?:data(?:\/|$)|\.env(?:\.|$|\/)|\.git(?:\/|$))/.test(url.pathname)){send(res,404,{error:'Not found.'});return;}
    if(dev){vite.middlewares(req,res,()=>send(res,404,{error:'Not found.'}));return;}
    const requested=decodeURIComponent(url.pathname);const relative=requested==='/'?'index.html':requested.replace(/^\//,'');let file=path.resolve(root,'dist',relative);const base=path.join(root,'dist')+path.sep;
    if(!file.startsWith(base)){send(res,403,{error:'Not allowed.'});return;}
    try{if(!(await stat(file)).isFile())throw new Error();}catch{file=path.join(root,'dist','index.html');}
    const bytes=await readFile(file);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(bytes);
  }catch(error){send(res,error.name==='TimeoutError'?504:400,{error:error.name==='TimeoutError'?'Generation took too long. Try a shorter passage.':error.message||'Something went wrong.'});}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Sketchline is ready: http://127.0.0.1:${port}`);console.log(aiStatus.aiConfigured?`${aiConfig.providerLabel} is configured (${aiConfig.model}).`:'Local generation is ready. Add GEMINI_API_KEY to .env to enable Google Gemini.');});
for(const name of ['SIGINT','SIGTERM'])process.on(name,()=>{server.close();vite?.close();process.exit(0);});
