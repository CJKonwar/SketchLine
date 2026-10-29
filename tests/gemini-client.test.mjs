import test from 'node:test';
import assert from 'node:assert/strict';
import {checkGeminiKey,generateWithGemini,cleanGeminiKey,saveGeminiSession,readGeminiSession,GEMINI_SESSION,listGeminiModels,preferredGeminiModel,readGeminiModel,saveGeminiModel,GEMINI_MODEL_PREFERENCE} from '../src/lib/gemini-client.mjs';
import {isPublicWorkspace,workspaceStorageKey} from '../src/lib/runtime.mjs';
import {localGenerate,SAMPLE_TEXT} from '../shared/diagram.mjs';
const key='test-key-000000000000';
const graph=localGenerate(SAMPLE_TEXT);
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
const generated=()=>reply({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(graph)}]}}]});

test('visitor key check goes only to Google, uses a header and omits cookies',async()=>{
 let calls=0;
 const result=await checkGeminiKey(key,{fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite');
  assert.equal(options.headers['x-goog-api-key'],key);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.ok(!url.includes(key));
  return reply({supportedGenerationMethods:['generateContent']});
 }});
 assert.equal(calls,1);assert.equal(result.accepted,true);assert.ok(!JSON.stringify(result).includes(key));
});

test('visitor generation uses their key with schema validation and one transient retry',async()=>{
 let calls=0;
 const result=await generateWithGemini(key,SAMPLE_TEXT,'flowchart',{retryDelayMs:1,fetchImpl:async(url,options)=>{
  calls++;assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));assert.ok(!url.includes(key));assert.equal(options.headers['x-goog-api-key'],key);
  const body=JSON.parse(options.body);assert.ok(body.generationConfig.responseFormat.text.schema.required.includes('edges'));assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'LOW');
  return calls===1?reply({error:{message:key,status:'UNAVAILABLE'}},503):generated();
 }});
 assert.equal(calls,2);assert.equal(result.nodes.length,5);assert.ok(!JSON.stringify(result).includes(key));
});

test('rejected visitor keys and quota errors do not expose provider messages or retry',async()=>{
 for(const status of [400,401,403,404,429]){
  let calls=0;
  await assert.rejects(generateWithGemini(key,SAMPLE_TEXT,'flowchart',{fetchImpl:async()=>{calls++;return reply({error:{message:'provider echoed '+key,details:[{reason:status===400?'API_KEY_INVALID':'UNKNOWN'}]}},status);}}),e=>!e.message.includes(key)&&!e.message.includes('provider echoed'));
  assert.equal(calls,1);
 }
 await assert.rejects(checkGeminiKey('bad'),/Paste/);
 await assert.rejects(checkGeminiKey(key,{model:'https://attacker.example/model'}),/valid Gemini/);
});

test('visitor cancellation stops a request and malformed graphs are rejected',async()=>{
 const cancel=new AbortController();let calls=0;
 const pending=generateWithGemini(key,SAMPLE_TEXT,'flowchart',{signal:cancel.signal,fetchImpl:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 cancel.abort();await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(calls,1);
 const broken={...graph,edges:[{source:'missing',target:graph.nodes[0].id}]};
 await assert.rejects(generateWithGemini(key,SAMPLE_TEXT,'flowchart',{fetchImpl:async()=>reply({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(broken)}]}}]})}),/missing node/);
 await assert.rejects(generateWithGemini(key,SAMPLE_TEXT,'flowchart',{fetchImpl:async()=>reply({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[]}}]})}),/incomplete/);
});

test('remembering a key is opt-in, tab-scoped, disconnectable and resilient to blocked storage',()=>{
 const memory=new Map();let writes=0;
 const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>{writes++;memory.set(k,v);},removeItem:k=>memory.delete(k)};
 assert.equal(saveGeminiSession(storage,key,false),true);assert.equal(writes,0);assert.equal(readGeminiSession(storage),'');
 assert.equal(saveGeminiSession(storage,key,true),true);assert.equal(readGeminiSession(storage),key);assert.equal(memory.has(GEMINI_SESSION),true);
 const differentVisitor={getItem:()=>null};assert.equal(readGeminiSession(differentVisitor),'');
 assert.equal(saveGeminiSession(storage,'',false),true);assert.equal(readGeminiSession(storage),'');
 const blocked={getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}};
 assert.equal(readGeminiSession(blocked),'');assert.equal(saveGeminiSession(blocked,key,true),false);
 assert.equal(cleanGeminiKey(' '+key+' '),key);
});

test('public builds and hosted domains use a separate browser workspace',()=>{
 assert.equal(isPublicWorkspace('127.0.0.1','development'),false);
 assert.equal(isPublicWorkspace('localhost','production'),false);
 assert.equal(isPublicWorkspace('127.0.0.1','public'),true);
 assert.equal(isPublicWorkspace('diagrams.example.com','production'),true);
 assert.notEqual(workspaceStorageKey(true),workspaceStorageKey(false));
});


test('model discovery follows pages, uses only Google and filters non-diagram models',async()=>{
 let calls=0;
 const model=(id,methods=['generateContent'])=>({name:'models/'+id,displayName:id,supportedGenerationMethods:methods});
 const models=await listGeminiModels(key,{fetchImpl:async(url,options)=>{
  calls++;const address=new URL(url);assert.equal(address.origin,'https://generativelanguage.googleapis.com');assert.equal(address.pathname,'/v1beta/models');assert.equal(address.searchParams.get('pageSize'),'1000');assert.ok(!url.includes(key));assert.equal(options.headers['x-goog-api-key'],key);assert.equal(options.credentials,'omit');
  if(calls===1)return reply({models:[model('gemini-2.5-pro'),model('gemini-3.5-flash-image'),model('gemini-3.5-flash-tts'),model('gemini-3.5-transcribe'),model('gemini-embedding-001',['embedContent']),model('gemini-live',['bidiGenerateContent']),model('gemini-robotics-er-2'),model('gemini-nano-banana-2.1'),model('gemini-2.5-computer-use'),model('gemini-3.1-pro-preview-customtools'),model('https://attacker.example')],nextPageToken:'next page+/?'});
  assert.equal(address.searchParams.get('pageToken'),'next page+/?');return reply({models:[model('gemini-2.5-pro'),model('gemini-3.5-flash-lite'),model('gemini-pro-latest'),model('gemini-4-argon')]});
 }});
 assert.equal(calls,2);assert.equal(models[0].id,'gemini-3.5-flash-lite');assert.equal(models.length,4);assert.equal(new Set(models.map(m=>m.id)).size,4);assert.ok(!JSON.stringify(models).includes(key));
 assert.equal(preferredGeminiModel(models,'gemini-2.5-pro'),'gemini-2.5-pro');assert.equal(preferredGeminiModel(models,'gemini-missing'),'gemini-3.5-flash-lite');assert.equal(preferredGeminiModel([{id:'gemini-2.5-pro'}]),'gemini-2.5-pro');
});

test('empty, malformed, cyclic and denied model lists fail safely',async()=>{
 for(const data of [{models:[]},{models:'invalid'},{models:[{name:'models/gemini-image',supportedGenerationMethods:['generateContent']}]}])await assert.rejects(listGeminiModels(key,{fetchImpl:async()=>reply(data)}),/model/i);
 let calls=0;await assert.rejects(listGeminiModels(key,{fetchImpl:async()=>{calls++;return reply({models:[],nextPageToken:'repeated'});}}),/incomplete/);assert.equal(calls,2);
 await assert.rejects(listGeminiModels(key,{fetchImpl:async()=>reply({error:{message:key}},403)}),e=>/permission/.test(e.message)&&!e.message.includes(key));
});

test('model discovery cancellation stops the outgoing request',async()=>{
 const controller=new AbortController();let calls=0;
 const pending=listGeminiModels(key,{signal:controller.signal,fetchImpl:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(calls,1);
});

test('model preference survives refresh without storing a credential and tolerates blocked storage',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(readGeminiModel(storage),'gemini-3.5-flash-lite');assert.equal(saveGeminiModel(storage,'gemini-2.5-flash'),true);assert.equal(readGeminiModel(storage),'gemini-2.5-flash');assert.equal(values.get(GEMINI_MODEL_PREFERENCE),'gemini-2.5-flash');assert.ok(!JSON.stringify([...values]).includes(key));
 values.set(GEMINI_MODEL_PREFERENCE,'https://attacker.example');assert.equal(readGeminiModel(storage),'gemini-3.5-flash-lite');assert.equal(saveGeminiModel(storage,'https://attacker.example'),false);
 const blocked={getItem:()=>{throw Error();},setItem:()=>{throw Error();}};assert.equal(readGeminiModel(blocked),'gemini-3.5-flash-lite');assert.equal(saveGeminiModel(blocked,'gemini-2.5-pro'),false);
});

test('generation uses the selected model and retains structured output for earlier Gemini models',async()=>{
 for(const model of ['gemini-2.5-flash-lite','gemini-3.1-flash-lite']){
  const result=await generateWithGemini(key,SAMPLE_TEXT,'flowchart',{model,fetchImpl:async(url,options)=>{
   assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent');const body=JSON.parse(options.body);assert.ok(body.generationConfig.responseFormat.text.schema.required.includes('nodes'));if(model.startsWith('gemini-2.5'))assert.equal(body.generationConfig.thinkingConfig,undefined);return generated();
  }});assert.equal(result.nodes.length,5);
 }
});
