import test from 'node:test';
import assert from 'node:assert/strict';
import {readBatch,readJSON} from '../scripts/evidence.mjs';
import {compute,evaluate,qualifyingReference,authorized,admissibleSource} from '../scripts/engine.mjs';
const policy=readJSON('references/policy.json');
const states=[];let state=null,prior=null;const results=[];
for(let n=1;n<=3;n++){state=readBatch(`inputs/batch-0${n}`,n,state).state;states.push(state);prior=compute(state,policy,prior);results.push(prior);}
const app=(batch,n)=>results[batch-1].applications.find(a=>a.application_id===`APP-2026-${String(n).padStart(3,'0')}`);

test('activation uses only an admitted GB approval and its effective date',()=>{
  assert.equal(app(2,1).status,'approved-not-yet-effective');assert.equal(app(2,1).activation.active_at_export,false);
  assert.equal(app(3,1).status,'active');assert.equal(app(3,1).activation.cycle_end,'2027-04-30');
  assert.equal(app(2,3).activation.effective_date,'2026-04-14');
  assert.equal(app(3,2).activation.active_at_export,false);
  assert.deepEqual(app(3,26).activation.privileges,['PRIV-IM','PRIV-HOSP']);
  assert.equal(app(3,26).elements.certification,'finding');assert.equal(app(3,26).packet_presentable,true);
});
test('decisions retain first refusal, reject wrong body and duplicate, allow later actual approval',()=>{
  assert.match(app(2,38).decisions[0].reason,/^1:/);assert.equal(app(2,38).activation,null);
  assert.equal(app(3,38).decisions[0].admitted,false);assert.equal(app(3,38).approval_decision_id,'GBD-2026-038');
  assert.match(app(2,36).decisions.at(-1).reason,/^3:/);assert.equal(app(2,36).packet_presentable,false);
  assert.equal(app(3,36).approval_decision_id,'GBD-2026-035');assert.equal(app(3,36).status,'approved-not-yet-effective');
  assert.equal(app(3,37).approval_decision_id,'GBD-2026-036');assert.match(app(3,37).decisions.at(-1).reason,/duplicate/);
  assert.deepEqual(app(2,14).decisions,app(3,14).decisions);assert.equal(app(3,14).packet_presentable,true);assert.equal(app(3,14).activation,null);
});
test('human holds, terminal status, clock, stale references and source rejection remain distinct',()=>{
  assert.equal(app(1,18).status,'returned-incomplete');assert.equal(app(2,18).packet_presentable,true);
  assert.equal(app(1,19).status,'intake-incomplete');assert.equal(app(2,19).status,'ineligible-clock-expired');
  assert.equal(app(2,34).status,'deferred');assert.equal(app(3,34).status,'deferred');
  assert.equal(app(2,35).status,'denied');assert.equal(app(2,28).status,'withdrawn');assert.equal(app(2,28).packet_presentable,true);
  assert.equal(app(2,29).status,'discontinued');assert.equal(app(2,29).activation,null);
  assert.equal(app(3,25).elements.references,'outstanding');assert.equal(app(2,25).packet_presentable,true);
  assert.equal(app(2,20).elements.education,'outstanding');assert.equal(app(3,20).packet_presentable,true);
  assert.equal(app(3,22).elements.education,'outstanding');assert.equal(app(3,33).elements.experience,'outstanding');
});
test('restriction remains a finding after recorded disposition; no automatic clinical judgment',()=>{
  assert.equal(app(2,15).packet_presentable,false);assert.equal(app(3,15).packet_presentable,true);
  assert.equal(app(3,15).elements.licensure,'finding');assert.equal(app(3,15).activation,null);
  assert.equal(app(1,17).elements.gaps,'routed-to-clinical-director');assert.equal(app(2,17).elements.gaps,'resolved');
  assert.equal(app(2,32).packet_presentable,true);assert.equal(app(3,32).status,'active');
  assert.equal(app(3,39).status,'active-with-conditions');assert.ok(app(3,39).monitored_conditions.some(c=>c.due==='2026-06-30'));
});
test('new non-date history identity reopens old experience outside five-year floor',()=>{
  assert.equal(app(1,36).elements.experience,'resolved');assert.equal(app(2,36).elements.experience,'outstanding');assert.equal(app(3,36).elements.experience,'resolved');
  assert.equal(app(1,30).elements.experience,'discrepancy');assert.equal(app(2,30).elements.experience,'outstanding');assert.equal(app(3,30).elements.experience,'resolved');
});
test('referee eligibility and signature anniversary boundaries are inclusive',()=>{
  const a={discipline:'Internal Medicine',first_received_date:'2024-01-01'};
  const r={signature_date:'2024-05-05',related_or_partner:'No',relationship_stated:'Colleague',referee_specialty_stated:'Internal Medicine',last_worked_together_end:'2022-05-05'};
  assert.equal(qualifyingReference(r,a,'2026-05-05').ok,true);assert.equal(qualifyingReference(r,a,'2026-05-06').ok,false);
  assert.equal(qualifyingReference({...r,last_worked_together_end:'2022-05-04'},a,'2024-05-05').ok,false);
  assert.equal(qualifyingReference({...r,related_or_partner:'Yes'},a,'2024-05-05').ok,false);
  assert.equal(qualifyingReference({...r,referee_specialty_stated:'Hospital Medicine'},a,'2024-05-05').ok,false);
});
test('roster delegation date checked and applicant-carried letter rejected regardless of letterhead',()=>{
  assert.equal(authorized(policy,'Governing Body','Mr. Desmond Ihejirika','Vice-Chair, Governing Body','2026-01-04'),false);
  assert.equal(authorized(policy,'Governing Body','Mr. Desmond Ihejirika','Vice-Chair, Governing Body','2026-01-05'),true);
  const r=states[0].records['verification-replies'].find(r=>r.reply_id==='VR-2000');
  const e=states[0].records['declared-history'].find(e=>e.entry_id===r.entry_id);assert.equal(admissibleSource(r,e),false);
});
test('clock deadline and strict reply window do not use machine date',()=>{
  const id='APP-2026-019';assert.equal(evaluate(states[0],id,'2026-03-20',policy).intake,'intake-incomplete');assert.equal(evaluate(states[0],id,'2026-03-21',policy).intake,'ineligible-clock-expired');
  const e=evaluate(states[1],'APP-2026-010','2026-03-23',policy,{beforeDecision:true});assert.equal(e.elements.experience,'outstanding');
  assert.equal(app(2,10).elements.certification,'resolved');
});
test('a malformed application is partial and does not erase unaffected files',()=>{
  const broken=structuredClone(states[0]);
  const row=broken.records['declared-history'].find(e=>e.application_id==='APP-2026-001' && e.entry_type==='residency');
  row.from_date='2015-07-01';row.to_date='2014-06-30';
  const result=compute(broken,policy);
  assert.equal(result.applications.length,40);assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].application_id,'APP-2026-001');
  assert.equal(result.applications[0].packet_presentable,false);assert.equal(result.applications[0].activation,null);
  assert.ok(result.applications.find(a=>a.application_id==='APP-2026-003').packet_presentable);
});
