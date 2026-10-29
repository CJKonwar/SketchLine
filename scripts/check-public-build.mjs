import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Run after a public build, or against a clean exported build before publishing.
export async function checkPublicBuild(directory){
 const base=path.resolve(directory),files=[];
 async function visit(folder){
  for(const entry of await readdir(folder,{withFileTypes:true})){
   const file=path.join(folder,entry.name),relative=path.relative(base,file);
   if(entry.isSymbolicLink())throw new Error('Public output contains a symbolic link: '+relative);
   if(/(?:^|[/\\])(?:data|server|node_modules|\.git|\.vercel)(?:[/\\]|$)/i.test(relative)||/^\.env(?:\.|$)/i.test(entry.name)||/\.(?:pem|key|map|jsx|tsx|ts)$/i.test(entry.name))throw new Error('Private or source file found in public output: '+relative);
   if(entry.isDirectory())await visit(file);
   else if(entry.isFile()){
    const bytes=await readFile(file);
    if(/AIza[0-9A-Za-z_-]{30,}|sk-(?:proj-|svcacct-)?[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')))throw new Error('A credential-like value was found in public output: '+relative);
    files.push(relative);
   }
  }
 }
 await visit(base);
 const html=await readFile(path.join(base,'index.html'),'utf8');
 if(!html.includes('id="root"'))throw new Error('The public app entry point is missing.');
 const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m=>m[1].slice(1));
 if(!assets.some(a=>a.endsWith('.js')))throw new Error('The public app has no compiled JavaScript entry.');
 for(const asset of assets){
  const file=path.resolve(base,asset);
  if(!file.startsWith(base+path.sep)||!(await lstat(file)).isFile())throw new Error('A compiled asset is missing: '+asset);
 }
 return {files:files.length,assets:assets.length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await checkPublicBuild(process.argv[2]||'dist-public');console.log(`Public build verified: ${result.files} static files; referenced assets exist; no private files or credential patterns found.`);}
 catch(error){console.error('Public build check failed: '+error.message);process.exitCode=1;}
}
