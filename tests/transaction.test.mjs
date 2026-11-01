import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {run} from '../scripts/credential.mjs';
import {readJSON,sha} from '../scripts/evidence.mjs';
import {assertNoTransaction,journalPath} from '../scripts/transaction.mjs';

function fixture() {
  const tmp=fs.mkdtempSync(path.join(process.cwd(),'.test-'));
  const out=path.join(tmp,'out'),input=path.join(tmp,'input');
  fs.cpSync('inputs/batch-01',input,{recursive:true});
  return {tmp,out,input};
}
function cleanup(tmp){assert.ok(tmp.startsWith(process.cwd()+path.sep));fs.rmSync(tmp,{recursive:true,force:true});}
const outputFiles=['snapshots/batch-01.json','state/batch-01.json','audit/batch-01.json'];
function saved(out){return Object.fromEntries(outputFiles.map(p=>[p,fs.readFileSync(path.join(out,p))]));}
function sameOutputs(out,previous){for(const [p,bytes]of Object.entries(previous))assert.deepEqual(fs.readFileSync(path.join(out,p)),bytes,p);}
function filesBelow(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{recursive:true}).filter(p=>fs.statSync(path.join(dir,p)).isFile());}

test('late write failures roll back state, snapshot, audit, archives and successful log before recording blocked attempt',()=>{
  const f=fixture();
  try {
    const first=run({folder:f.input,batch:1,out:f.out});
    const before=saved(f.out);
    // Harmless source whitespace changes its immutable input hash and forces a
    // new occurrence without changing expected business answers.
    fs.appendFileSync(path.join(f.input,'README.md'),'\n');
    for(const target of ['state/batch-01.json','snapshots/batch-01.json','results/batch-01.json','run-log.md']) {
      const log=fs.readFileSync(path.join(f.out,'run-log.md'),'utf8');let injected=false;
      assert.throws(()=>run({folder:f.input,batch:1,out:f.out,command:`failure after ${target}`,writeFault:event=>{
        if(event.phase==='after' && event.path.endsWith(target)){injected=true;throw Object.assign(new Error(`Injected EIO after ${target}`),{code:'EIO'});}
      }}),/Injected EIO/);
      assert.equal(injected,true);sameOutputs(f.out,before);
      const result=readJSON(path.join(f.out,'results/batch-01.json'));assert.equal(result.status,'blocked');assert.equal(result.snapshot,null);assert.ok(result.last_retained_snapshot.endsWith('snapshots/batch-01.json'));
      const afterLog=fs.readFileSync(path.join(f.out,'run-log.md'),'utf8');assert.ok(afterLog.startsWith(log));assert.equal(afterLog.slice(log.length).includes(': supported'),false);assert.match(afterLog.slice(log.length),/: blocked/);
      assert.equal(fs.existsSync(journalPath(f.out)),false);
      assert.deepEqual(filesBelow(path.join(f.out,'superseded')),[],'Failed occurrence must not publish archives');
    }
    const next=run({folder:f.input,batch:1,out:f.out,reason:'Regression recovery'});
    assert.notEqual(next.snapshot_id,first.snapshot_id);
    assert.deepEqual(fs.readFileSync(path.join(f.out,'superseded',first.snapshot_id,'snapshots-batch-01.json')),before['snapshots/batch-01.json']);
    assert.equal(readJSON(path.join(f.out,'state/batch-01.json')).snapshot.sha256,sha(fs.readFileSync(path.join(f.out,'snapshots/batch-01.json'))));
  }finally{cleanup(f.tmp);}
});

test('first-ever publication failure leaves no snapshot/state/audit or false successful log',()=>{
  const f=fixture();
  try{
    assert.throws(()=>run({folder:f.input,batch:1,out:f.out,writeFault:e=>{if(e.phase==='after' && e.path.endsWith('run-log.md'))throw new Error('First publication failed');}}),/First publication failed/);
    for(const file of outputFiles)assert.equal(fs.existsSync(path.join(f.out,file)),false);
    assert.equal(readJSON(path.join(f.out,'results/batch-01.json')).status,'blocked');
    assert.doesNotMatch(fs.readFileSync(path.join(f.out,'run-log.md'),'utf8'),/: supported/);
  }finally{cleanup(f.tmp);}
});

test('abrupt process exit leaves a reader-visible barrier; next run restores old bytes before archiving and records recovery',()=>{
  const f=fixture();
  try {
    const first=run({folder:f.input,batch:1,out:f.out}),before=saved(f.out);
    fs.appendFileSync(path.join(f.input,'README.md'),'\n');
    const moduleURL=new URL('../scripts/credential.mjs',import.meta.url).href;
    const child=`import {run} from ${JSON.stringify(moduleURL)};run({...${JSON.stringify({folder:f.input,batch:1,out:f.out,command:'simulated abrupt process exit'})},writeFault:e=>{if(e.phase==='after' && e.path.endsWith('results/batch-01.json'))process.exit(72);}});`;
    assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',child],{cwd:process.cwd(),windowsHide:true,stdio:'pipe'}),e=>e.status===72);
    assert.ok(fs.existsSync(journalPath(f.out)));assert.throws(()=>assertNoTransaction(f.out),/Pending output transaction/);
    assert.notEqual(sha(fs.readFileSync(path.join(f.out,'snapshots/batch-01.json'))),sha(before['snapshots/batch-01.json']),'Child really replaced output before interruption');
    const next=run({folder:f.input,batch:1,out:f.out,reason:'Recovery regression'});
    assert.notEqual(next.snapshot_id,first.snapshot_id);
    assert.equal(fs.existsSync(journalPath(f.out)),false);
    for(const [file,bytes]of Object.entries(before)) {
      const archive=path.join(f.out,'superseded',first.snapshot_id,file.replace('/','-'));
      assert.deepEqual(fs.readFileSync(archive),bytes,`Recovered original ${file} before archiving`);
    }
    const log=fs.readFileSync(path.join(f.out,'run-log.md'),'utf8');assert.match(log,/Recovered interrupted output transaction/);assert.match(log,/simulated abrupt process exit/);assert.match(log,/: blocked/);
    assert.equal(readJSON(path.join(f.out,'results/batch-01.json')).status,'supported');
    assert.equal(readJSON(path.join(f.out,'state/batch-01.json')).snapshot.sha256,sha(fs.readFileSync(path.join(f.out,'snapshots/batch-01.json'))));
  }finally{cleanup(f.tmp);}
});
