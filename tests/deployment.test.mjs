import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {checkPublicBuild} from '../scripts/check-public-build.mjs';
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'sketchline-static-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'assets'));
 await writeFile(path.join(root,'index.html'),'<div id="root"></div><script src="/assets/app.js"></script>');
 await writeFile(path.join(root,'assets/app.js'),'console.log("public app");');
 return root;
}
test('deployable static output has a real compiled entry and rejects missing assets',async t=>{
 const root=await fixture(t);assert.deepEqual(await checkPublicBuild(root),{files:2,assets:1});
 await rm(path.join(root,'assets/app.js'));await assert.rejects(checkPublicBuild(root),/ENOENT|missing/);
});
test('public output rejects credentials and private workspace files without echoing secrets',async t=>{
 const root=await fixture(t),credential='AIza'+'a'.repeat(35);
 await writeFile(path.join(root,'assets/app.js'),'const key="'+credential+'";');
 await assert.rejects(checkPublicBuild(root),e=>/credential/.test(e.message)&&!e.message.includes(credential));
 await writeFile(path.join(root,'assets/app.js'),'console.log("public app");');
 await mkdir(path.join(root,'data'));await writeFile(path.join(root,'data/workspace.json'),'{}');
 await assert.rejects(checkPublicBuild(root),/Private or source/);
});
test('public output rejects hidden environment files and symbolic links',async t=>{
 const root=await fixture(t);await writeFile(path.join(root,'.env.production'),'not a real secret');
 await assert.rejects(checkPublicBuild(root),/Private or source/);await rm(path.join(root,'.env.production'));
 await symlink(path.join(root,'index.html'),path.join(root,'linked.html'));
 await assert.rejects(checkPublicBuild(root),/symbolic link/);
});
