import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJSON,sha} from './evidence.mjs';
import {validateSnapshot} from './validation.mjs';

for(let n=1;n<=3;n++) {
  const name=`batch-${String(n).padStart(2,'0')}`;
  const snapshotPath=`deliverables/snapshots/${name}.json`;
  const snapshot=validateSnapshot(readJSON(snapshotPath));
  const state=readJSON(`deliverables/state/${name}.json`);
  const {integrity,...unsigned}=state;
  assert.equal(integrity,sha(JSON.stringify(unsigned,null,2)+'\n'),'Evidence state hash');
  assert.equal(state.snapshot.sha256,sha(fs.readFileSync(snapshotPath)),'Snapshot bound to evidence state');
  assert.equal(state.snapshot.path,snapshotPath);
  assert.equal(snapshot.batch,n);assert.equal(snapshot.as_of,state.as_of);
  assert.ok(['supported','partial'].includes(readJSON(`deliverables/results/${name}.json`).status),'Latest attempt must not be blocked');
  if(n===1)assert.equal(snapshot.predecessor,null);
  else {
    assert.equal(snapshot.predecessor.path,`deliverables/snapshots/batch-${String(n-1).padStart(2,'0')}.json`);
    assert.equal(snapshot.predecessor.sha256,sha(fs.readFileSync(snapshot.predecessor.path)));
    const prior=readJSON(snapshot.predecessor.path);
    for(const before of prior.applications) {
      const after=snapshot.applications.find(a=>a.application_id===before.application_id);assert.ok(after,'Application retained');
      for(const decision of before.decisions)assert.deepEqual(after.decisions.find(d=>d.decision_id===decision.decision_id),decision,'Decision admission history immutable');
    }
  }
  for(const file of snapshot.produced)assert.ok(fs.existsSync(file),`Missing produced file ${file}`);
  assert.ok(snapshot.produced.includes(snapshotPath));assert.ok(fs.existsSync(snapshot.rules_file));
  for(const input of state.inputs)for(const [file,hash]of Object.entries(input.hashes))assert.equal(sha(fs.readFileSync(`inputs/batch-${String(input.batch).padStart(2,'0')}/${file}`)),hash,`Closed input changed: ${file}`);
  assert.equal(snapshot.applications.length,new Set(state.records.applications.map(a=>a.application_id)).size);
  console.log(`${name}: schema, chain, evidence hashes, caseload and retained decision history valid (${snapshot.applications.length} applications)`);
}
