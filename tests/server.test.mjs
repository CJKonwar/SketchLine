import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {SAMPLE_TEXT} from '../shared/diagram.mjs';
test('local server generates, validates, saves and restores a private workspace',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'sketchline-test-'));
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const proc=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),SKETCHLINE_DATA_DIR:dir,OPENAI_API_KEY:'',GEMINI_API_KEY:'',AI_PROVIDER:'gemini',SKETCHLINE_SKIP_ENV:'1'},stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server did not start')),10000);proc.stdout.on('data',d=>{if(String(d).includes('Sketchline is ready:')){clearTimeout(timeout);resolve();}});proc.on('error',reject);proc.on('exit',code=>{if(code)reject(Error('Server exited: '+code));});});
 const base=`http://127.0.0.1:${port}`;
 let response=await fetch(base+'/api/status');assert.equal(response.status,200);const status=await response.json();assert.equal(typeof status.aiConfigured,'boolean');assert.ok(!('key' in status));assert.equal(status.provider,'gemini');assert.equal(status.aiConfigured,false);
 response=await fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:SAMPLE_TEXT,kind:'flowchart',engine:'local'})});assert.equal(response.status,200);const {diagram,engine,requestId}=await response.json();assert.equal(engine,'local');assert.equal(diagram.nodes.length,5);assert.equal(response.headers.get('x-request-id'),requestId);
 const records=(await readFile(path.join(dir,'network.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.ok(records.some(r=>r.requestId===requestId&&r.event==='generation_complete'));assert.ok(!JSON.stringify(records).includes(SAMPLE_TEXT));
 diagram.edges[0].route={center:320,sourceLead:20,targetLead:30};
 const workspace={version:1,savedAt:new Date().toISOString(),documents:[{...diagram,id:'fixture',source:SAMPLE_TEXT,layout:'vertical',theme:'sage',details:true}]};
 response=await fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(workspace)});assert.equal(response.status,200);
 const loaded=await (await fetch(base+'/api/workspace')).json();assert.deepEqual(loaded,workspace);assert.deepEqual(JSON.parse(await readFile(path.join(dir,'workspace.json'),'utf8')),workspace);assert.equal((await stat(path.join(dir,'workspace.json'))).mode&0o777,0o600);
 response=await fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify(workspace)});assert.equal(response.status,403);
 response=await fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:SAMPLE_TEXT,kind:'unsupported',engine:'local'})});assert.equal(response.status,400);
 response=await fetch(base+'/.env');assert.equal(response.status,404);
 response=await fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:[{id:'invalid',nodes:[],edges:[{source:'missing',target:'missing'}]}]})});assert.equal(response.status,400);
 }finally{proc.kill('SIGTERM');await new Promise(resolve=>proc.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
});
