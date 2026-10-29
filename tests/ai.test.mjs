import test from 'node:test';
import assert from 'node:assert/strict';
import {getAIConfig,getAIStatus,generateWithAI} from '../server/ai.mjs';
import {localGenerate,SAMPLE_TEXT} from '../shared/diagram.mjs';

const graph=localGenerate(SAMPLE_TEXT);
const gemini=getAIConfig({GEMINI_API_KEY:'test-gemini-key'});
const success=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
const generated=(parts,finishReason='STOP')=>({candidates:[{finishReason,content:{parts}}]});

test('Gemini is preferred when supplied and public status never includes a secret',()=>{
 const cfg=getAIConfig({GEMINI_API_KEY:'test-gemini-key',OPENAI_API_KEY:'test-openai-key'});
 assert.equal(cfg.provider,'gemini');assert.equal(cfg.model,'gemini-3.5-flash-lite');
 assert.deepEqual(getAIStatus(cfg),{aiConfigured:true,provider:'gemini',providerLabel:'Google Gemini',model:'gemini-3.5-flash-lite'});
 assert.ok(!JSON.stringify(getAIStatus(cfg)).includes('test-gemini-key'));
 assert.equal(getAIConfig({AI_PROVIDER:'openai',OPENAI_API_KEY:'test-openai-key'}).provider,'openai');
 assert.throws(()=>getAIConfig({AI_PROVIDER:'unsupported'}),/AI_PROVIDER/);
});

test('Gemini sends the key in a header and requests schema-based JSON',async()=>{
 let calls=0;
 const result=await generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.ok(!url.includes('test-gemini-key'));assert.equal(options.headers['x-goog-api-key'],'test-gemini-key');assert.ok(!('Authorization' in options.headers));
  const body=JSON.parse(options.body);assert.ok(body.contents[0].parts[0].text.includes(SAMPLE_TEXT));assert.equal(body.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');assert.ok(body.generationConfig.responseFormat.text.schema.required.includes('nodes'));
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'LOW');
  return success(generated([{thought:true,text:'not output'},{text:JSON.stringify(graph)}]));
 }});
 assert.equal(calls,1);assert.equal(result.nodes.length,5);assert.equal(result.edges.length,4);
});

test('temporary provider failure retries once and records timing stages without content',async()=>{
 let calls=0;const events=[];
 const result=await generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,retryDelayMs:1,onEvent:e=>events.push(e),fetchImpl:async()=>{
  calls++;
  return calls===1?new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:'secret test-gemini-key'}}),{status:503}):success(generated([{text:JSON.stringify(graph)}]));
 }});
 assert.equal(calls,2);assert.equal(result.nodes.length,5);
 assert.ok(events.some(e=>e.event==='provider_retry_scheduled'&&e.httpStatus===503));
 assert.equal(events.filter(e=>e.event==='provider_headers_received').length,2);
 assert.ok(!JSON.stringify(events).includes('test-gemini-key'));assert.ok(!JSON.stringify(events).includes(SAMPLE_TEXT));
});

test('persistent service failure preserves its status; quota and network failures do not retry',async()=>{
 for(const status of [503,429]){
  let calls=0;
  await assert.rejects(generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,retryDelayMs:1,fetchImpl:async()=>{calls++;return new Response('{}',{status});}}),e=>e.status===status&&e.code===(status===503?'AI_SERVICE_UNAVAILABLE':'AI_QUOTA'));
  assert.equal(calls,status===503?2:1);
 }
 let calls=0;
 await assert.rejects(generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,fetchImpl:async()=>{calls++;throw new TypeError('untrusted test-gemini-key',{cause:{code:'ECONNRESET'}});}}),e=>e.code==='AI_NETWORK_ERROR'&&e.networkCode==='ECONNRESET'&&!e.message.includes('test-gemini-key'));
 assert.equal(calls,1);
});

test('timeouts include stalled response bodies; cancellation is never retried',async()=>{
 const {setTimeout:delay}=await import('node:timers/promises');
 for(const stalledBody of [false,true]){
  let calls=0;
  await assert.rejects(generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,attemptTimeoutMs:10,fetchImpl:async(url,{signal})=>{
   calls++;const wait=()=>delay(100,undefined,{signal});
   if(stalledBody)return {status:200,ok:true,text:wait};
   await wait();
  }}),e=>e.code==='AI_TIMEOUT'&&e.status===504);
  assert.equal(calls,1);
 }
 const cancel=new AbortController();let calls=0;
 const pending=generateWithAI(SAMPLE_TEXT,'flowchart',cancel.signal,{config:gemini,fetchImpl:async(url,{signal})=>{calls++;await delay(100,undefined,{signal});}});
 cancel.abort();await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(calls,1);
});

test('Gemini errors explain rejected keys, quota limits and unavailable models without leaking details',async()=>{
 for(const [status,pattern]of [[400,/API key/],[403,/API key/],[429,/quota/],[404,/GEMINI_MODEL/]]){
  await assert.rejects(generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,fetchImpl:async()=>new Response(JSON.stringify({error:{message:'untrusted provider message: test-gemini-key',details:status===400?[{reason:'API_KEY_INVALID'}]:[]}}),{status})}),error=>pattern.test(error.message)&&!error.message.includes('test-gemini-key'));
 }
});

test('blocked, truncated, empty, malformed and dangling Gemini output is rejected',async()=>{
 for(const response of [
  {promptFeedback:{blockReason:'SAFETY'}},
  generated([{text:'{"title":'}],'MAX_TOKENS'),
  generated([{text:JSON.stringify(graph)}],'CONTINUATION'),
  generated([]),generated([{text:'not json'}]),
  generated([{text:JSON.stringify({...graph,edges:[{source:'missing',target:'n1',label:''}]})}]),
 ])await assert.rejects(generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:gemini,fetchImpl:async()=>success(response)}));
});

test('OpenAI remains an explicit optional provider and missing keys make no request',async()=>{
 let called=false;
 await assert.rejects(generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:getAIConfig({AI_PROVIDER:'gemini'}),fetchImpl:async()=>{called=true;}}),/GEMINI_API_KEY/);assert.equal(called,false);
 const result=await generateWithAI(SAMPLE_TEXT,'flowchart',undefined,{config:getAIConfig({AI_PROVIDER:'openai',OPENAI_API_KEY:'test-openai-key'}),fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-openai-key');return success({output:[{content:[{type:'output_text',text:JSON.stringify(graph)}]}]});}});
 assert.equal(result.nodes.length,5);
});
