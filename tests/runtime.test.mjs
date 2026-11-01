import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {run} from '../scripts/credential.mjs';
import {sha,readJSON} from '../scripts/evidence.mjs';
import {validateSnapshot} from '../scripts/validation.mjs';
test('schema, state resume, idempotence, failure reporting and immutable predecessor',()=>{
  const tmp=fs.mkdtempSync(path.join(process.cwd(),'.test-'));
  try {
    const one=run({folder:'inputs/batch-01',batch:1,out:tmp});validateSnapshot(one);
    const file=path.join(tmp,'snapshots/batch-01.json'),bytes=fs.readFileSync(file);
    assert.equal(run({folder:'inputs/batch-01',batch:1,out:tmp}).snapshot_id,one.snapshot_id);
    assert.deepEqual(fs.readFileSync(file),bytes);
    const two=run({folder:'inputs/batch-02',batch:2,previous:path.join(tmp,'state/batch-01.json'),out:tmp});
    assert.equal(two.predecessor.sha256,sha(bytes));assert.equal(two.batch,2);
    assert.throws(()=>validateSnapshot({...two,as_of:'2026-02-30'}),/schema/);
    assert.throws(()=>run({folder:'no-such-export',batch:3,previous:path.join(tmp,'state/batch-02.json'),out:tmp}));
    assert.equal(readJSON(path.join(tmp,'results/batch-03.json')).status,'blocked');
    assert.equal(fs.existsSync(path.join(tmp,'snapshots/batch-03.json')),false);
    const stateFile=path.join(tmp,'state/batch-02.json'),state=readJSON(stateFile);state.as_of='2026-04-21';fs.writeFileSync(stateFile,JSON.stringify(state));
    assert.throws(()=>run({folder:'inputs/batch-03',batch:3,previous:stateFile,out:tmp}),/integrity mismatch/);
    assert.deepEqual(fs.readFileSync(file),bytes);
  }finally{assert.ok(tmp.startsWith(process.cwd()+path.sep));fs.rmSync(tmp,{recursive:true,force:true});}
});
