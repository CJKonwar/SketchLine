import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDiagnostics } from '../server/diagnostics.mjs';

test('diagnostics omit content and credentials, remain private, and rotate',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'sketchline-logs-'));
 const consoleLines=[];
 const log=createDiagnostics(dir,{maxBytes:1,consoleImpl:{info:l=>consoleLines.push(l),warn:()=>{}}});
 try {
  await log({requestId:'test',event:'provider_headers_received',httpStatus:503,elapsedMs:500,key:'private-key',headers:{authorization:'private-key'},text:'private-notes',error:'private-message'});
  await log({requestId:'test',event:'generation_complete',elapsedMs:1000,nodeCount:3});
  const file=path.join(dir,'network.jsonl');const current=await readFile(file,'utf8');const previous=await readFile(file+'.previous','utf8');
  for(const value of [current,previous,...consoleLines])assert.ok(!value.includes('private-'));
  assert.equal(JSON.parse(previous).httpStatus,503);assert.equal(JSON.parse(current).nodeCount,3);
  assert.equal((await stat(file)).mode&0o777,0o600);assert.equal((await stat(file+'.previous')).mode&0o777,0o600);
 } finally {await rm(dir,{recursive:true,force:true});}
});
