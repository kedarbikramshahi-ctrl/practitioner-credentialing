import test from 'node:test';
import assert from 'node:assert/strict';
import {readBatch,readJSON} from '../scripts/evidence.mjs';
import {compute,evaluate,qualifyingReference,dispositionPermission} from '../scripts/engine.mjs';
const policy=readJSON('references/policy.json');
let base=null,prior=null;
for(let n=1;n<=3;n++){base=readBatch(`inputs/batch-0${n}`,n,base).state;prior=compute(base,policy,prior);}
const id='APP-2026-001';
const subject = result => result.applications.find(a=>a.application_id===id);

test('negative and ambiguous CD dispositions retain holds; later negative does not reuse earlier permission',()=>{
  for(const application of ['APP-2026-017','APP-2026-015','APP-2026-032']) {
    for(const body of ['Do not proceed. The explanation is unsatisfactory.','Do not present the file to the Executive Committee of the Medical Staff and the Governing Body.','I do not agree that the file may proceed.','Please consider whether the file may proceed.']) {
      const s=structuredClone(base),old=s.documents.find(d=>d.application_id===application && d.document_path.startsWith('dispositions/'));
      s.documents.push({...old,date:'2026-05-18',letter_id:'REVIEW-LATER-HOLD',text:old.text.split('\n')[0]+'\n'+body});
      const result=evaluate(s,application,s.as_of,policy);
      assert.equal(result.ready,false,`${application}: ${body}`);
      assert.ok(result.queue.some(q=>q.owner==='Clinical Director' && q.item.includes('REVIEW-LATER-HOLD')));
    }
  }
  assert.equal(dispositionPermission({text:'# Gap\nThe explanation is sufficient and the file may proceed.'}),'release');
  assert.equal(dispositionPermission({text:'# Finding\nPresent the file to the Executive Committee of the Medical Staff and the Governing Body. Do not discontinue the application.'}),'release');
});

test('every WA declaration requires a matching lookup; inactive verified licences do not replace practice licence',()=>{
  const s=structuredClone(base),declaration=s.records['declared-credentials'].find(c=>c.application_id===id && c.credential_class==='licence');
  s.records['declared-credentials'].push({...declaration,declaration_id:'REVIEW-EXTRA-WA',number_declared:'WA-SECOND',declared_status:'Inactive'});
  let result=evaluate(s,id,s.as_of,policy);
  assert.equal(result.elements.licensure,'outstanding');assert.equal(result.ready,false);
  assert.ok(result.queue.some(q=>q.item.includes('WA-SECOND')));
  const lookup=s.records['licence-lookup-wa'].find(r=>r.credentialnumber===declaration.number_declared);
  s.records['licence-lookup-wa'].push({...lookup,credentialnumber:'WA-SECOND',status:'INACTIVE',lookup_date:'2026-05-18'});
  result=evaluate(s,id,s.as_of,policy);
  assert.equal(result.elements.licensure,'resolved');assert.equal(result.ready,true);
  assert.equal(result.wa.credentialnumber,declaration.number_declared);
  assert.ok(result.details.licences.find(l=>l.number==='WA-SECOND').lookup_date);
});

test('later source no-record reopens only the affected element; a subsequent confirmation can resolve it',()=>{
  for(const type of ['employment','medical-school']) {
    const s=structuredClone(base),entry=s.records['declared-history'].find(r=>r.application_id===id && r.entry_type===type);
    const old=s.records['verification-replies'].find(r=>r.entry_id===entry.entry_id);
    s.records['verification-replies'].push({...old,reply_id:'REVIEW-NO-RECORD',received_date:'2026-05-17',outcome:'no-record',verified_from:'',verified_to:''});
    let result=evaluate(s,id,s.as_of,policy),element=type==='employment'?'experience':'education';
    assert.equal(result.elements[element],'outstanding');assert.equal(result.ready,false);
    assert.equal(result.details.entries.find(e=>e.entry_id===entry.entry_id).reply_id,'REVIEW-NO-RECORD');
    assert.equal(result.elements.references,'resolved');assert.equal(result.elements.licensure,'resolved');
    assert.ok(s.records['verification-replies'].some(r=>r.reply_id===old.reply_id));
    s.records['verification-replies'].push({...old,reply_id:'REVIEW-RESTORED',received_date:'2026-05-18'});
    result=evaluate(s,id,s.as_of,policy);assert.equal(result.elements[element],'resolved');assert.equal(result.ready,true);
  }
});

test('appointment boundaries are inclusive, expired cycles do not renew and partial scope retains approval',()=>{
  const at=(date)=>{const s=structuredClone(base);s.as_of=date;return compute(s,policy,prior);};
  assert.equal(subject(at('2027-04-30')).activation.active_at_export,true);
  const result=at('2027-05-01'),a=subject(result);
  assert.equal(a.activation.active_at_export,false);assert.equal(a.status,'in-verification');
  assert.equal(a.approval_decision_id,'GBD-2026-011');assert.deepEqual(a.decisions,subject(prior).decisions);
  assert.ok(result.errors.some(e=>e.application_id===id && /schema has no expired-cycle status/.test(e.error)));
  assert.ok(a.action_queue.some(q=>/reappointment is outside/.test(q.item)));
});

test('practice licence expiry reopens processing and removes active assertion without inventing denial',()=>{
  const s=structuredClone(base),app=s.records.applications.find(a=>a.application_id===id);
  const rows=s.records['licence-lookup-wa'].filter(r=>r.lastname===app.last_name && r.firstname===app.first_name && r.birthyear===app.birth_year);
  for(const row of rows)row.expirationdate='2026-05-18';
  assert.equal(subject(compute(s,policy,prior)).activation.active_at_export,true);
  s.as_of='2026-05-19';const a=subject(compute(s,policy,prior));
  assert.equal(a.activation.active_at_export,false);assert.equal(a.elements.licensure,'outstanding');assert.equal(a.packet_presentable,false);
  assert.equal(a.status,'in-verification');assert.equal(a.approval_decision_id,'GBD-2026-011');
  assert.ok(a.action_queue.some(q=>q.owner==='Clinical Director' && /Re-open licensure/.test(q.item)));
});

test('No plus explicit denial of a prohibited relationship counts; contradictory narrative is held for clarification',()=>{
  const app={discipline:'Internal Medicine',first_received_date:'2024-01-01'};
  const r={signature_date:'2026-01-01',related_or_partner:'No',referee_specialty_stated:'Internal Medicine',last_worked_together_end:''};
  for(const statement of ['I am not a relative, spouse or partner.','We are not related and are not partners.','I am neither a relative nor a spouse nor a partner.','Colleague in the same department.'])assert.equal(qualifyingReference({...r,relationship_stated:statement},app,'2026-05-18').ok,true,statement);
  for(const statement of ['I am the applicant\'s spouse.','We are related by marriage.','I am not a spouse but I am a cousin.']) {
    const q=qualifyingReference({...r,relationship_stated:statement},app,'2026-05-18');assert.equal(q.ok,false);assert.match(q.reason,/clarification/);
  }
  assert.equal(qualifyingReference({...r,related_or_partner:'Yes',relationship_stated:'I am not a relative.'},app,'2026-05-18').ok,false);
});
