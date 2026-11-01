import test from 'node:test';
import assert from 'node:assert/strict';
import {readJSON} from '../scripts/evidence.mjs';
import {verificationSource,certificationSource,licenceSource,sourcePolicy} from '../scripts/sources.mjs';
import {evaluate} from '../scripts/engine.mjs';
const base=readJSON('deliverables/state/batch-03.json'),policy=readJSON('references/policy.json');
const educationReply=base.records['verification-replies'].find(r=>r.reply_id==='VR-2100');
const educationEntry=base.records['declared-history'].find(e=>e.entry_id===educationReply.entry_id);
const context={history:base.records['declared-history'].filter(e=>e.application_id===educationEntry.application_id),replies:base.records['verification-replies'],firstReceived:'2026-02-16'};
const cert=base.records['certification-replies'].find(r=>r.application_id==='APP-2026-001');
const declaration=base.records['declared-credentials'].find(d=>d.declaration_id===cert.declaration_id);

test('secondary education accepts actual most recent affiliation, recorded closure/no equivalent and own verification',()=>{
  assert.deepEqual(verificationSource(educationReply,educationEntry,context),{admitted:true,kind:'secondary',source:'Greyfen Regional Hospital',reason:null});
  const file=evaluate(base,educationEntry.application_id,base.as_of,policy);
  assert.equal(file.elements.education,'resolved');assert.equal(file.ready,true);
  assert.equal(file.details.entries.find(e=>e.entry_id===educationEntry.entry_id).source_checks.find(r=>r.reply_id===educationReply.reply_id).kind,'secondary');
});

test('unrelated and older secondary donors are refused, retained and queued to MSP',()=>{
  for(const organization of ['Unrelated Hospital','Larkhollow Physicians Network']) {
    const s=structuredClone(base),r=s.records['verification-replies'].find(r=>r.reply_id===educationReply.reply_id);
    r.attester_organization=organization;r.received_from=`Medical staff office \u2014 ${organization}`;
    const file=evaluate(s,r.application_id,s.as_of,policy);
    assert.equal(file.elements.education,'outstanding');assert.equal(file.ready,false);
    assert.ok(file.queue.some(q=>q.owner==='Medical Services Professional' && q.item.includes(r.reply_id) && /most recent affiliation/.test(q.item)));
    assert.ok(s.records['verification-replies'].includes(r));
  }
  const ambiguous={...context,history:[...context.history,{...context.history.at(-1),entry_id:'EXTRA-CURRENT',organization:'Another current hospital'}]};
  assert.equal(verificationSource(educationReply,educationEntry,ambiguous).admitted,false);
  const unclassified={...context,history:[...context.history,{...context.history.at(-1),entry_id:'UNCLASSIFIED-CURRENT',entry_type:'teaching',organization:'Another current institution'}]};
  assert.equal(verificationSource(educationReply,educationEntry,unclassified).admitted,false,'Do not assume an older affiliation remains the most recent when current history has an unclassified institutional relationship');
});

test('secondary route fails closed if any required provenance is missing or contradictory',()=>{
  const changes=[
    {notes:educationReply.notes.replace('closed on','did not close on')},
    {notes:educationReply.notes.replace('Cascade Valley College of Medicine closed on','It is not true that Cascade Valley College of Medicine closed on')},
    {notes:educationReply.notes.replace('This letter is a secondary source and is offered because the primary and the designated equivalent sources are both impossible.','')},
    {notes:educationReply.notes.replace(/This office verified.*?on file\./,'')},
    {notes:educationReply.notes.replace("the college's registrar",'an unrelated recruiter')},
    {received_from:'Applicant \u2014 carried letter'},
    {received_from:'Human resources department \u2014 Greyfen Regional Hospital'},
    {notes:'The source has not answered three requests. No designated equivalent source holds the record. This office verified directly with the college\'s registrar.'}
  ];
  for(const change of changes)assert.equal(verificationSource({...educationReply,...change},educationEntry,context).admitted,false,JSON.stringify(change));
  const contradictory={...context,replies:[...context.replies,{...context.replies.find(r=>r.reply_id==='VR-2104'),reply_id:'EQ-CONFIRMED',received_date:'2026-04-01',outcome:'confirmed'}]};
  assert.equal(verificationSource(educationReply,educationEntry,contradictory).admitted,false);
  const negative=educationReply.notes.replace('This letter is a secondary source and is offered because the primary and the designated equivalent sources are both impossible.','It is not true that no designated equivalent source holds the record.');
  assert.equal(verificationSource({...educationReply,notes:negative},educationEntry,context).admitted,false);
});

test('certification primary sender and credential board must match declaration, including same-code impostor',()=>{
  assert.equal(certificationSource(cert,declaration).kind,'primary');
  for(const change of [{received_from:'Certifying board \u2014 Unrelated credential agency'},{board_name:'Unrelated credential agency'},{board_code:'ABIM'},{application_id:'DIFFERENT'},{declaration_id:'DIFFERENT'},{received_from:'Applicant \u2014 certificate image'}])assert.equal(certificationSource({...cert,...change},declaration).admitted,false);
  const s=structuredClone(base),r=s.records['certification-replies'].find(r=>r.reply_id===cert.reply_id);
  r.received_from='Certifying board \u2014 Unrelated credential agency';r.board_name='Unrelated credential agency';
  const file=evaluate(s,r.application_id,s.as_of,policy);
  assert.equal(file.ready,false);assert.equal(file.elements.certification,'eligibility-question');
  assert.ok(file.queue.some(q=>q.owner==='Medical Services Professional' && q.item.includes(r.reply_id) && /inadmissible/.test(q.item)));
});

test('all seven published certification equivalents work by full service identity without changing credential issuer',()=>{
  const names=['American Board of Medical Specialties certification verification','CertiFACTS','American Medical Association Physician Profile','American Osteopathic Association Physician Profile','American Board of Physician Specialties','American Nurses Credentialing Center','National Commission on Certification of Physician Assistants'];
  for(const name of names) {
    const r={...cert,received_from:name};assert.equal(certificationSource(r,declaration).kind,'designated-equivalent',name);
    assert.equal(certificationSource({...r,received_from:`Designated equivalent source \u2014 ${name}`},declaration).admitted,true,name);
  }
  for(const source of ['ABMS unrelated directory','ABMS \u2014 Unrelated agency','Specialty society membership roster','CertiFACTS Unregistered','FCVS','Federation of State Medical Boards Physician Data Center'])assert.equal(certificationSource({...cert,received_from:source},declaration).admitted,false,source);
});

test('education primary office depends on entry type and binds both sender identities to institution',()=>{
  const school=base.records['declared-history'].find(e=>e.application_id==='APP-2026-001'&&e.entry_type==='medical-school');
  const residency=base.records['declared-history'].find(e=>e.application_id==='APP-2026-001'&&e.entry_type==='residency');
  const reply=e=>({...educationReply,application_id:e.application_id,entry_id:e.entry_id,attester_organization:e.organization,notes:''});
  for(const role of ["Registrar's office","Dean's office"])assert.equal(verificationSource({...reply(school),received_from:`${role} \u2014 ${school.organization}`},school).kind,'primary');
  for(const role of ['Graduate medical education office','Programme director'])assert.equal(verificationSource({...reply(residency),received_from:`${role} \u2014 ${residency.organization}`},residency).kind,'primary');
  assert.equal(verificationSource({...reply(school),received_from:`Graduate medical education office \u2014 ${school.organization}`},school).admitted,false);
  assert.equal(verificationSource({...reply(residency),received_from:`Registrar's office \u2014 ${residency.organization}`},residency).admitted,false);
  assert.equal(verificationSource({...reply(school),received_from:"Registrar's office \u2014 Unrelated School"},school).admitted,false);
  assert.equal(verificationSource({...reply(school),element:'affiliation-and-employment',received_from:`Medical staff office \u2014 ${school.organization}`},school).admitted,false);
  assert.equal(verificationSource({...reply(school),received_from:`Registrar's office \u2014 ${school.organization}`,notes:'Photocopy of the diploma supplied instead of verification.'},school).admitted,false);
});

test('all five education equivalents require consistent identity; services do not spill between element lists',()=>{
  const names=['Educational Commission for Foreign Medical Graduates','Federation Credentials Verification Service','American Medical Association Physician Profile','American Osteopathic Association Physician Profile','National Student Clearinghouse'];
  for(const name of names)assert.equal(verificationSource({...educationReply,attester_organization:name,received_from:name,notes:''},educationEntry).kind,'designated-equivalent',name);
  assert.equal(verificationSource({...educationReply,attester_organization:'FCVS',received_from:'FCVS \u2014 Federation Credentials Verification Service'},educationEntry).admitted,true);
  for(const source of ['FCVS Unrelated Directory','FCVS \u2014 Unrelated agency','ABMS','State medical society','CertiFACTS'])assert.equal(verificationSource({...educationReply,attester_organization:source,received_from:source},educationEntry,context).admitted,false,source);
  assert.equal(verificationSource({...educationReply,received_from:'National Student Clearinghouse',attester_organization:'Unrelated agency'},educationEntry).admitted,false);
});

test('employment primary and retained CVO identities are bound to the employer, not a name mentioned in prose',()=>{
  const entry={entry_id:'WORK',application_id:'TEST',entry_type:'employment',organization:'Example Employer',from_date:'2020-01-01',to_date:''};
  const r={entry_id:'WORK',application_id:'TEST',element:'affiliation-and-employment',attester_organization:'Example Employer',received_date:'2026-04-01',notes:''};
  for(const role of ['Medical staff office','Human resources department',"Practice's authorized administrator"])assert.equal(verificationSource({...r,received_from:`${role} \u2014 Example Employer`},entry).kind,'primary');
  assert.equal(verificationSource({...r,received_from:'Supervisor personal address \u2014 Example Employer'},entry).admitted,false);
  const cvo={...r,received_from:'Credentials verification organization \u2014 Example CVO',attester_organization:'Example CVO',notes:'Retained by Example Employer to verify this employment.'};
  assert.equal(verificationSource(cvo,entry).kind,'designated-equivalent');
  for(const notes of ['Example Employer is mentioned in this account.','Not retained by Example Employer to verify employment.','It is not true that we were retained by Example Employer to verify employment.','Retained by Another Employer to verify this employment.'])assert.equal(verificationSource({...cvo,notes},entry).admitted,false,notes);
  assert.equal(verificationSource({...cvo,attester_organization:'Unrelated CVO'},entry).admitted,false);
});

test('secondary employment needs dissolution/no successor and own verification from latest surviving affiliation',()=>{
  const entry={entry_id:'CLOSED',application_id:'TEST',entry_type:'employment',organization:'Closed Employer',from_date:'2010-01-01',to_date:'2019-12-31'};
  const history=[entry,{...entry,entry_id:'SURVIVING',organization:'Surviving Hospital',from_date:'2020-01-01',to_date:''}];
  const reply={entry_id:entry.entry_id,application_id:entry.application_id,element:'affiliation-and-employment',attester_organization:'Surviving Hospital',received_from:'Medical staff office \u2014 Surviving Hospital',received_date:'2026-04-01',notes:"Closed Employer dissolved on 2021-01-01. No successor holds the records. This office verified employment directly with the employer's human resources department on 2020-02-01."};
  assert.equal(verificationSource(reply,entry,{history}).kind,'secondary');
  for(const change of [{notes:reply.notes.replace('dissolved','did not dissolve')},{notes:reply.notes.replace('No successor holds the records.','')},{notes:reply.notes.replace('No successor holds the records.','It is not true that no successor holds the records.')},{attester_organization:'Unrelated Hospital',received_from:'Medical staff office \u2014 Unrelated Hospital'}])assert.equal(verificationSource({...reply,...change},entry,{history}).admitted,false);
});

test('licensure permits only the issuing board or FSMB Physician Data Center, never secondary copies/directories',()=>{
  const d={application_id:'TEST',declaration_id:'OR-LIC',issuer:'Oregon Medical Board',jurisdiction_or_board:'OR',number_declared:'OR123'};
  const row={board_state:'OR',licence_number:'OR123',verified_by:'Oregon Medical Board online verification'};
  assert.equal(licenceSource(row,d).kind,'primary');
  for(const source of ['Federation of State Medical Boards Physician Data Center','FSMB Physician Data Center'])assert.equal(licenceSource({...row,verified_by:source},d).kind,'designated-equivalent');
  for(const source of ['Unrelated board online verification','Aggregator directory','Applicant copy','Prior employer copy','Medical staff office \u2014 Recent Hospital','FSMB Physician Data Center Unregistered'])assert.equal(licenceSource({...row,verified_by:source},d).admitted,false,source);
  assert.equal(licenceSource({...row,board_state:'WA'},d).admitted,false);
  assert.equal(licenceSource({...row,licence_number:'OTHER'},d).admitted,false);
});
