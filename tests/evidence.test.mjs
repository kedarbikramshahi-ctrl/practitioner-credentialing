import test from 'node:test';
import assert from 'node:assert/strict';
import {readBatch, fields} from '../scripts/evidence.mjs';
test('office exports resume cumulatively and retain prior revisions', () => {
  const one = readBatch('inputs/batch-01',1).state;
  const old = JSON.stringify(one);
  const two = readBatch('inputs/batch-02',2,one).state;
  const three = readBatch('inputs/batch-03',3,two).state;
  assert.equal(JSON.stringify(one), old);
  assert.equal(one.records.applications.length,41);
  assert.equal(two.records.applications.length,45);
  assert.equal(three.records.applications.length,46);
  assert.equal(three.documents.length,82);
  assert.equal(three.inputs[0].counts['licence-lookup-wa.csv'],435);
  assert.throws(()=>readBatch('inputs/batch-03',3,one), /exactly the next/);
});
test('blank decision fields remain blank',()=>{
  assert.deepEqual(fields('**Outcome:** recommended  \n**Reason:**   \n'), {outcome:'recommended',reason:''});
});
