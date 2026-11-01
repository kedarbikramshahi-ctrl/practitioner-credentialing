import {addDays, addYears, cycleEnd, gaps, day} from './dates.mjs';

const MSO = 'Medical Services Professional', CD = 'Clinical Director';
const latest = (rows, key) => [...rows].sort((a,b) => a[key].localeCompare(b[key])).at(-1);
const norm = text => (text || '').normalize('NFC').toLowerCase().trim();
const eduTypes = new Set(['medical-school','residency','fellowship']);

export function authorized(policy, body, name, role, date) {
  return policy.authority.some(a => a.body === body && a.name === name && a.role === role && a.from <= date && date <= a.to);
}
export function admissibleSource(reply, entry) {
  const source = reply.received_from || '';
  if (/applicant|photocop|certificate image/i.test(source)) return false;
  if (reply.element === 'education-and-training') {
    if (/^(ECFMG|FCVS|Educational Commission for Foreign Medical Graduates|Federation Credentials Verification Service|American Medical Association Physician Profile|American Osteopathic Association Physician Profile|National Student Clearinghouse)\b/i.test(source)) return true;
    if (/^(Registrar's office|Dean's office|Graduate medical education office|Programme director)/i.test(source)) return reply.attester_organization === entry.organization;
    // The secondary route requires the closure and the failed equivalent source to be recorded.
    return /^Medical staff office/i.test(source) && /closed|dissolved/i.test(reply.notes) && /no record|holds no|no successor|not transferred/i.test(reply.notes) && /verif/i.test(reply.notes);
  }
  if (reply.element === 'affiliation-and-employment') {
    if (/^(Medical staff office|Human resources|Authorized administrator|Practice administrator)/i.test(source)) return reply.attester_organization === entry.organization;
    if (/credentials verification organization/i.test(source)) return (reply.notes || '').includes(entry.organization);
    return /dissolved/i.test(reply.notes) && /no successor/i.test(reply.notes) && /^Medical staff office/i.test(source);
  }
  return false;
}

// Recognize explicit recorded permission, never decide whether evidence merits it.
// Unknown/contradictory language remains held for human clarification.
export function dispositionPermission(doc) {
  const body = doc.text.split(/\r?\n/).filter(l=>!l.startsWith('#') && !l.startsWith('**')).join(' ');
  if (/\b(?:do not|must not|cannot|can't|never|not permitted to|not authorized to)\s+(?:\w+\s+){0,4}(?:proceed|present)\b/i.test(body) || /\b(?:unsatisfactory|insufficient|unacceptable|not satisfactory|not sufficient|not acceptable)\b/i.test(body)) return 'hold';
  if (/(?:^|[.!?]\s+)(?:The explanation is sufficient and )?the file may proceed(?:[.!?]|$)/i.test(body.trim()) || /(?:^|[.!?]\s+)Present the file to the Executive Committee of the Medical Staff and (?:to )?the Governing Body\b/i.test(body.trim())) return 'release';
  return 'unclear';
}

function relationshipConflict(text) {
  if (/\bnot\s+(?:not|neither|unrelated)\b/i.test(text)) return true;
  // Remove explicit denials as a whole, including coordinated lists. Do not
  // remove a positive relationship mentioned elsewhere in the same answer.
  const word='(?:relatives?|spouses?|partners?|related)';
  const denied=new RegExp('\\b(?:not|neither|no)\\s+(?:a\\s+|an\\s+|the\\s+|my\\s+)?'+word+'(?:(?:\\s*,\\s*|\\s+(?:or|nor|and)\\s+)(?:a\\s+|an\\s+|the\\s+)?'+word+')*','gi');
  return /\b(?:relative|relatives|spouse|spouses|partner|partners|related|husband|wife|sibling|brother|sister|cousin)\b/i.test(text.replace(denied,''));
}
export function qualifyingReference(reply, app, presentation) {
  if (!reply.signature_date || reply.signature_date < app.first_received_date || reply.signature_date > presentation) return {ok:false,reason:'signature outside verification window'};
  if (reply.related_or_partner !== 'No') return {ok:false,reason:'relative, spouse or partner box is Yes or unanswered'};
  if (relationshipConflict(reply.relationship_stated || '')) return {ok:false,reason:'relationship narrative conflicts with or does not clearly support the No box; obtain clarification'};
  if (reply.referee_specialty_stated !== app.discipline) return {ok:false,reason:'different clinical discipline'};
  if (reply.last_worked_together_end && reply.last_worked_together_end < addYears(reply.signature_date,-2)) return {ok:false,reason:'no direct work within two years of signature'};
  if (presentation > addYears(reply.signature_date,2)) return {ok:false,reason:`signature stale after ${addYears(reply.signature_date,2)}`};
  return {ok:true,reason:null};
}

export function evaluate(state, id, asOf, policy, {beforeDecision=false, presentation=asOf}={}) {
  const records = state.records;
  const apps = records.applications.filter(a => a.application_id === id && a.received_date <= asOf);
  const app = [...apps].sort((a,b)=>+a.revision - +b.revision).at(-1);
  if (!app) throw new Error(`Application not received: ${id}`);
  const rows = name => records[name].filter(r => r.application_id === id);
  const rev = name => rows(name).filter(r => r.revision === app.revision);
  const visible = date => date && (beforeDecision ? date < asOf : date <= asOf);
  const docs = state.documents.filter(d => d.application_id === id && visible(d.date));
  const queue = [], details = {revision:+app.revision,first_received:app.first_received_date,entries:[],gaps:[],references:[],supported:[],unsupported:[],limitations:[]};
  const add = (item, owner=MSO, due=null) => { if (!queue.some(q=>q.item===item && q.owner===owner)) queue.push({item,owner,due}); };
  const el = Object.fromEntries(['licensure','experience','gaps','education','certification','references'].map(k=>[k,'resolved']));
  const missing = [], used = [];
  const release = app.release_signed_date && app.release_signed_date <= asOf;
  if (!release) missing.push('signed and dated Authorization and Release');
  if (!app.cv_received_date || app.cv_received_date > asOf) missing.push('current curriculum vitae');
  const requests = rev('privilege-requests');
  if (!requests.length || requests.some(r => !policy.privileges[r.privilege_code] || r.criteria_version_cited !== policy.version)) missing.push('specific privileges under published criteria');
  const disclosures = rev('application-disclosures');
  for (let n=1;n<=8;n++) {
    const r = disclosures.find(r=>r.question_code === `PPQ-${n}`);
    if (!r || !['Yes','No'].includes(r.answer) || (r.answer==='Yes' && !r.applicant_comment)) missing.push(`completed PPQ-${n}`);
  }
  // The export has no signature or referee-address column. Do not invent values.
  details.limitations.push('Application signature/date and referee working addresses are not assessable from exported columns; office confirmation retained in queue.');
  add('Confirm application signature/date and referee working addresses in the original office file; these fields are not assessable from the export.');
  let referees = [...new Map(rows('peer-referees').filter(r=>+r.revision<=+app.revision).map(r=>[r.referee_id,r])).values()];
  referees = referees.filter(r=>r.first_request_date<=asOf);
  if (new Set(referees.map(r=>r.referee_id)).size < 2) missing.push('two named peer referees');
  const history = rev('declared-history');
  const education = history.filter(e=>eduTypes.has(e.entry_type));
  const school = education.find(e=>e.entry_type==='medical-school');
  if (!school?.to_date) {missing.push('professional school completion history');el.education='outstanding';}
  const attempts = rows('verification-attempts').filter(r=>r.attempt_date<=asOf);
  if (!release) {
    for (const k of Object.keys(el)) el[k]='outstanding';
    add('Do not send any verification request until the signed and dated release is on file.');
    for (const r of attempts) add(`Review request ${r.attempt_id}: no signed release was on file when verification was attempted.`);
  }
  let readyDates = [app.received_date], verifiedTraining=[];
  for (const entry of history) {
    const element = eduTypes.has(entry.entry_type) ? 'education' : 'experience';
    if (element==='experience' && (!entry.contact_name || !entry.contact_email)) missing.push(`verification contact on ${entry.entry_id}`);
    const older = rows('declared-history').filter(e=>e.entry_id===entry.entry_id && +e.revision<+app.revision).at(-1);
    const changed = older && ['organization','location','role','contact_name','contact_email','from_date','to_date'].some(k=>older[k]!==entry[k]);
    const candidates = rows('verification-replies').filter(r=>r.entry_id===entry.entry_id && visible(r.received_date));
    const required = element==='education' || (entry.to_date || asOf) >= addYears(app.first_received_date,-5) || changed || candidates.some(r=>r.outcome && !r.outcome.startsWith('confirmed'));
    let accepted = candidates.filter(r=>release && r.received_date >= app.first_received_date && admissibleSource(r,entry));
    // A later revision can retain a reply only if the entry's non-date identity is unchanged.
    accepted = accepted.filter(r=> !apps.some(a => a.received_date>r.received_date && +a.revision<=+app.revision && (()=>{
      const older = rows('declared-history').filter(e=>e.entry_id===entry.entry_id && +e.revision<+a.revision).at(-1);
      const newer = rows('declared-history').find(e=>e.entry_id===entry.entry_id && e.revision===a.revision);
      return older && newer && ['organization','location','role','contact_name','contact_email'].some(k=>older[k]!==newer[k]);
    })()));
    const reply = latest(accepted,'received_date');
    const confirmed = reply?.outcome?.startsWith('confirmed');
    const discrepancy = confirmed && (entry.from_date!==reply.verified_from || entry.to_date!==reply.verified_to);
    details.entries.push({entry_id:entry.entry_id,element,required,reply_id:reply?.reply_id || null,outcome:reply?.outcome || null,declared:{from:entry.from_date,to:entry.to_date,organization:entry.organization},verified:confirmed?{from:reply.verified_from,to:reply.verified_to,organization:reply.attester_organization}:null});
    for (const r of candidates.filter(r=>!accepted.includes(r))) add(`Reply ${r.reply_id} does not settle ${entry.entry_id}: source, usability window or changed entry requires review; retain the reply and obtain admissible evidence.`);
    if (discrepancy) {
      el[element]='discrepancy';
      add(`Resolve ${entry.entry_id} in writing or amend: declared ${entry.from_date} to ${entry.to_date||'current'}; ${reply.reply_id} reports ${reply.verified_from} to ${reply.verified_to||'current'}.`,'Applicant');
    } else if (required && !confirmed) {
      if (el[element]!=='discrepancy') el[element]='outstanding';
      if (release) add(`Obtain direct admissible confirmation for ${entry.entry_id} (${entry.organization}); ${reply?`latest reply ${reply.reply_id} reports ${reply.outcome || 'no confirming outcome'}; earlier confirmations do not settle it; `:''}${attempts.filter(a=>a.subject_ref===entry.entry_id).length} attempts retained.`);
    } else if (confirmed) {
      used.push(reply.reply_id); readyDates.push(reply.received_date);
      if (element==='education') verifiedTraining.push({...entry,reply});
      if (/secondary source/i.test(reply.notes)) add(`Retain documented impossibility and secondary verification ${reply.reply_id}: ${reply.notes}`);
    }
    const tries = attempts.filter(a=>a.subject_ref===entry.entry_id);
    if (tries.length>=3) add(`${entry.entry_id}: ${tries.length} verification attempts retained${confirmed?'; eventual reply does not erase non-response history':'; non-response is a red flag and remains outstanding'}.`);
  }
  if (school?.to_date) {
    details.gaps = gaps(history,school.to_date,asOf).map(g=>{
      const explanation = docs.find(d=>{const m=d.fields['period explained']?.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);return m && m[1]<=g.from && m[2]>=g.to;});
      if (!explanation) {missing.push(`written explanation for ${g.from} to ${g.to}`);el.gaps='return-incomplete';add(`Provide a written explanation covering ${g.from} to ${g.to} (${g.days} days).`,'Applicant');}
      else readyDates.push(explanation.date);
      return {...g,explained:!!explanation,explanation_id:explanation?.letter_id || null};
    });
  }
  const dispositions = docs.filter(d=>d.document_path.startsWith('dispositions/') && policy.authority.some(a=>a.body===CD && a.from<=d.date && d.date<=a.to && d.fields['recorded by']===`${a.name}, ${a.role}`));
  const gapRecord = latest(dispositions.filter(d=>/gap/i.test(d.text.split('\n')[0])),'date');
  const gapDisposition = gapRecord && dispositionPermission(gapRecord)==='release' ? gapRecord : null;
  if (gapRecord && !gapDisposition) add(`Retain Clinical Director disposition ${gapRecord.letter_id}: ${dispositionPermission(gapRecord)}; no permission to advance is established. Obtain an explicit recorded disposition before presentation.`,CD);
  if (details.gaps.some(g=>g.days>=180) && !gapDisposition) {
    if (el.gaps!=='return-incomplete') el.gaps='routed-to-clinical-director';
    add(`Record a disposition on long gaps: ${details.gaps.filter(g=>g.days>=180).map(g=>`${g.from} to ${g.to} (${g.days} days)`).join('; ')}.`,CD);
  }
  if (gapDisposition) readyDates.push(gapDisposition.date);
  for(const d of docs.filter(d=>d.document_path.startsWith('dispositions/') && !dispositions.includes(d))) add(`Disposition ${d.letter_id} is not supported by the authority roster; obtain an authorized disposition.`);
  const creds = rev('declared-credentials');
  const licences = creds.filter(c=>c.credential_class==='licence');
  const waRows = records['licence-lookup-wa'].filter(r=>r.lastname===app.last_name && r.firstname===app.first_name && r.middlename===app.middle_name && r.birthyear===app.birth_year && r.lookup_date<=asOf);
  const waByNumber = [...new Map([...waRows].sort((a,b)=>a.lookup_date.localeCompare(b.lookup_date)).map(r=>[r.credentialnumber,r])).values()];
  const wa = latest(waByNumber.filter(r=>norm(r.status)==='active' && r.expirationdate>=asOf),'lookup_date') || latest(waByNumber,'lookup_date');
  const practiceLicenceCurrent = !!wa && norm(wa.status)==='active' && !!wa.expirationdate && wa.expirationdate>=asOf;
  let licensureComplete = !!release && practiceLicenceCurrent;
  const restricted = wa && /probation|supervis|monitor|restrict|suspend|stipulat|surrender/i.test([wa.status,...docs.filter(d=>/board-action/.test(d.document_path)).map(d=>d.text)].join(' '));
  const highRisk = disclosures.some(r=>r.answer==='Yes') || restricted || wa?.actiontaken==='Yes';
  const findingRecord = latest(dispositions.filter(d=>/high-risk|licensure finding/i.test(d.text.split('\n')[0])),'date');
  const findingDisposition = findingRecord && dispositionPermission(findingRecord)==='release' ? findingRecord : null;
  if(findingRecord && !findingDisposition)add(`Retain Clinical Director disposition ${findingRecord.letter_id}: ${dispositionPermission(findingRecord)}; clarify permission before presenting the high-risk or licensure finding.`,CD);
  if (!licences.length) missing.push('declared licences (NPI is not a licence)');
  if (wa && !licences.some(c=>c.jurisdiction_or_board==='WA' && c.number_declared===wa.credentialnumber)) missing.push(`declaration of Washington credential ${wa.credentialnumber}`);
  if (!practiceLicenceCurrent) {
    el.licensure='outstanding'; if(release)add('Obtain a current active full unrestricted Washington licence; an NPI or out-of-state licence does not satisfy the bylaw.');
  }
  details.licences=[];
  for (const c of licences) {
    const isWA=c.jurisdiction_or_board==='WA';
    const board = isWA ? waByNumber.find(r=>r.credentialnumber===c.number_declared) : latest(records['licence-lookup-other-states'].filter(r=>r.board_state===c.jurisdiction_or_board && r.licence_number===c.number_declared && r.lookup_date<=asOf),'lookup_date');
    details.licences.push({declaration_id:c.declaration_id,number:c.number_declared,jurisdiction:c.jurisdiction_or_board,lookup_date:board?.lookup_date||null,status:board?.status||null});
    if (!board) {licensureComplete=false;el.licensure='outstanding';if(release)add(`Verify ${c.jurisdiction_or_board} licence ${c.number_declared}, including inactive credentials.`);}
    else if (!isWA && !/None reported/i.test(board.disciplinary_action)) {el.licensure='finding';add(`Present action on ${c.number_declared}: ${board.disciplinary_action}.`,CD);}
    else if (isWA && board.actiontaken==='Yes' && board!==wa) {el.licensure='finding';add(`Obtain and present the board's written action on Washington licence ${c.number_declared}; do not infer the action from its indicator.`,CD);}
  }
  if (restricted) {el.licensure='finding';add(`Present Washington restriction and board evidence ${wa.credentialnumber} to the Clinical Director, Executive Committee and Governing Body.`,CD);}
  if (wa?.actiontaken==='Pending') {el.licensure='outstanding';add(`Obtain the board's written account of pending action for ${wa.credentialnumber}; do not infer its meaning from actiontaken.`);}
  const disclosureConflict = (restricted || wa?.actiontaken==='Yes') && disclosures.some(r=>r.question_code==='PPQ-1' && r.answer==='No');
  const confirmedDisclosure = docs.some(d=>d.direction==='inbound' && /confirm-disclosure-reply/.test(d.document_path));
  if (disclosureConflict && !confirmedDisclosure) add('Confirm PPQ-1 in writing: board action contradicts the declared No; do not choose an answer for the applicant.','Applicant');
  if (highRisk && !findingDisposition) add('Record disposition on high-risk findings; provide disclosures and source evidence, then present to Executive Committee and Governing Body.',CD);
  if (findingDisposition) readyDates.push(findingDisposition.date);

  const certDeclarations = creds.filter(c=>c.credential_class==='certification');
  let certs=[];
  for(const c of certDeclarations) {
    const replies = rows('certification-replies').filter(r=>r.declaration_id===c.declaration_id && visible(r.received_date) && r.received_date>=app.first_received_date && /^(Certifying board|ABMS|CertiFACTS|American Medical Association Physician Profile|American Osteopathic Association Physician Profile|ABPS|ANCC|NCCPA)\b/i.test(r.received_from));
    const r=latest(replies,'received_date');
    if (!r) {el.certification='outstanding';if(release)add(`Verify all active and inactive certifications, including ${c.declaration_id} (${c.issuer}).`);}
    else {certs.push(r);used.push(r.reply_id);readyDates.push(r.received_date);}
  }
  const degreeOK = verifiedTraining.some(e=>e.entry_type==='medical-school' && /Doctor of (Medicine|Osteopathic Medicine)/i.test(e.reply.verified_credential));
  for(const r of requests) {
    const criteria=policy.privileges[r.privilege_code];if(!criteria)continue;
    const certOK=certs.some(c=>criteria.certs.some(([board,specialty])=>c.board_code===board && c.certificate_specialty===specialty) && ((c.certification_status==='Active' && (!c.expiry_date || c.expiry_date>=presentation)) || (criteria.eligible && /board eligible|candidate/i.test(c.notes) && /good standing/i.test(c.notes) && (c.notes.match(/(?:through|until) (\d{4}-\d{2}-\d{2})/)?.[1] || c.expiry_date)>presentation)));
    const trainingOK=criteria.training.every(t=>verifiedTraining.some(e=>e.entry_type===t.type && new RegExp(t.specialty,'i').test(e.reply.verified_credential) && addDays(e.reply.verified_to,1)>=(()=>{const d=day(e.reply.verified_from);d.setUTCMonth(d.getUTCMonth()+t.months);return d.toISOString().slice(0,10);})()));
    (certOK && trainingOK && degreeOK ? details.supported : details.unsupported).push(r.privilege_code);
  }
  if (!details.supported.length && requests.length) {el.certification='eligibility-question';add(`Record threshold eligibility disposition: nothing yet verified supports ${requests.map(r=>r.privilege_code).join(', ')}. Do not discontinue automatically.`,CD);}
  else if(details.unsupported.length) {el.certification='finding';add(`Present unsupported subset ${details.unsupported.join(', ')}; supported groups are ${details.supported.join(', ')}.`,CD);}
  const validRefs=[];
  for(const ref of referees) {
    const reply=latest(rows('peer-reference-replies').filter(r=>r.referee_id===ref.referee_id && visible(r.received_date)),'received_date');
    const result=reply?qualifyingReference(reply,app,presentation):{ok:false,reason:'no reply'};
    details.references.push({referee_id:ref.referee_id,reply_id:reply?.reply_id||null,...result});
    if(result.ok){validRefs.push(reply);used.push(reply.reply_id);readyDates.push(reply.received_date);}
    else if(release) {
      const due=addDays(ref.first_request_date,64);
      add(`Reference ${ref.referee_id} does not count: ${result.reason}; ${reply?'obtain a qualifying current reference':'retain the unanswered request'}.`,result.reason==='no reply'?MSO:'Applicant',result.reason==='no reply'?due:null);
      if(!reply) {
        const tries=attempts.filter(a=>a.subject_ref===ref.referee_id);
        if(asOf>=due)add(`Ask applicant for an additional referee: ${ref.referee_id} overdue from day 64; ${tries.length} attempts retained. Original request remains outstanding.`,'Applicant',due);
        else if(tries.length<3)add(`Send numbered reference request ${tries.length+1} for ${ref.referee_id}, subject to signed release.`,MSO,addDays(ref.first_request_date,21*tries.length));
      }
    }
  }
  if(validRefs.length<2)el.references='outstanding';
  else if(details.references.some(r=>r.reason==='no reply'))add('Two qualifying current references meet the element; carry surplus open requests until presentation, then close as no longer needed.');
  const findingResolved = !!findingDisposition && (!disclosureConflict || confirmedDisclosure);
  const elementsReady = licensureComplete && Object.entries(el).every(([k,v])=>v==='resolved' || (v==='finding' && (k==='certification' || (k==='licensure' && findingResolved))));
  const ready = !!release && !missing.length && elementsReady && (!highRisk || findingResolved) && (!disclosureConflict || confirmedDisclosure);
  let intake=null;
  if(missing.length) {
    const request=latest(docs.filter(d=>d.direction==='outbound' && /missing-items|return-incomplete/.test(d.document_path)),'date');
    const due=request?addDays(request.date,30):null;
    intake=due && asOf>due?'ineligible-clock-expired':el.gaps==='return-incomplete'?'returned-incomplete':'intake-incomplete';
    for(const item of [...new Set(missing)])add(`Supply missing intake item: ${item}.`,'Applicant',due);
    if(!request)add('Issue a written missing-item list; no 30-day clock is inferred before an actual written request.');
    if(intake==='ineligible-clock-expired')add(`The applicant reply clock expired after ${due}; stop advancement. This is not a Clinical Director discontinuation.`);
  }
  const withdrawal=docs.find(d=>d.direction==='inbound' && /withdrawal/.test(d.document_path));
  const discontinuation=dispositions.find(d=>/\bDiscontinue the application\b/.test(d.text) && !/Do not discontinue/.test(d.text));
  const terminal=withdrawal?'withdrawn':discontinuation?'discontinued':null;
  if(terminal) {
    const record=withdrawal||discontinuation;
    details.terminal_record={id:record.letter_id,date:record.date,path:record.document_path,text:record.text};
    add(`File ${terminal} under ${record.letter_id} (${record.date}); stop advancing outstanding requests. Recorded reason: ${record.text.split('\n').filter(line=>line.trim() && !line.startsWith('#') && !line.startsWith('**')).join(' ')}`);
  }
  return {app,elements:el,ready,ready_date:ready?[...readyDates].sort().at(-1):null,intake,terminal,queue,details,wa,practiceLicenceCurrent,used};
}

export function compute(state,policy,priorSnapshot=null) {
  const applications=[], audit=[], errors=[];
  for(const id of [...new Set(state.records.applications.map(a=>a.application_id))].sort()) {
    try {
    let current=evaluate(state,id,state.as_of,policy);
    const docs=state.documents.filter(d=>d.application_id===id && d.document_path.startsWith('decisions/'));
    const decisions=[], admitted=[];
    for(const doc of docs) {
      const d=doc.fields, date=d['decision date']; let reason=null;
      if(!d['decision id'] || !date)throw new Error(`Unstructured decision record ${doc.document_path}`);
      day(date);
      const prior=priorSnapshot?.applications.find(a=>a.application_id===id)?.decisions.find(x=>x.decision_id===d['decision id']);
      if(prior){decisions.push(prior);if(prior.admitted)admitted.push(doc);continue;}
      if(!policy.outcomes[d.body]?.includes(d.outcome))reason='1: body is not authorized to record this outcome';
      else if(!authorized(policy,d.body,d.signatory,d.role,date))reason='2: signatory did not hold an authorized role on the decision date';
      else {
        const atDecision=evaluate(state,id,date,policy,{beforeDecision:true,presentation:date});
        if(d.application!==id || +d.revision!==+atDecision.app.revision)reason='3: decision does not name the current applicant and packet revision';
        else if(!atDecision.ready || atDecision.ready_date>=date)reason='4: no presentable packet for this revision before the decision date';
        else if(!['approved','recommended'].includes(d.outcome) && !d.reason)reason='5: outcome requires a recorded reason';
        else if(d['criteria version']!==policy.version)reason='criteria version is not the published version';
        else if(d.body==='Governing Body' && admitted.some(p=>p.fields.body===d.body && p.fields.revision===d.revision) && d.supersedes!==admitted.filter(p=>p.fields.body===d.body && p.fields.revision===d.revision).at(-1).fields['decision id'])reason='duplicate Governing Body decision without reference to the earlier decision it supersedes';
      }
      const record={decision_id:d['decision id'],admitted:!reason,reason};decisions.push(record);if(!reason)admitted.push(doc);
    }
    const outcome=admitted.filter(d=>d.fields.body==='Governing Body' && +d.fields.revision===+current.app.revision).at(-1);
    if(outcome)current=evaluate(state,id,state.as_of,policy,{presentation:outcome.fields['decision date']});
    let activation=null,conditions=[],approval=null;
    const queue=[...current.queue];
    for(const d of decisions.filter(d=>!d.admitted))queue.push({item:`Refused decision ${d.decision_id}: ${d.reason}; retain and raise to the Medical Services Professional.`,owner:MSO,due:null});
    const f=outcome?.fields;
    if(f && ['approved','approved-with-conditions'].includes(f.outcome)) {
      approval=f['decision id'];const effective=f['effective date']||f['decision date'];
      activation={active_at_export:effective<=state.as_of && state.as_of<=cycleEnd(effective) && current.practiceLicenceCurrent,effective_date:effective,cycle_end:cycleEnd(effective),privileges:f.privileges.split(';').map(p=>p.trim()).filter(Boolean)};
      if(state.as_of>activation.cycle_end && !current.terminal) {
        const message=`Initial appointment cycle ended ${activation.cycle_end}; reappointment is outside this procedure (LARK-MSO sections 3/check 1 and 10). The schema has no expired-cycle status; in-verification is an unresolved processing placeholder, not a renewal or clinical decision.`;
        errors.push({application_id:id,error:message});
        queue.push({item:message,owner:MSO,due:null});
      } else if(effective<=state.as_of && !current.practiceLicenceCurrent && !current.terminal) queue.push({item:'Re-open licensure and obtain current Washington verification and a recorded Clinical Director disposition; historical approval is retained, but active privileges are not established from an expired or non-active practice licence.',owner:CD,due:current.wa?.expirationdate||null});
      if(!activation.privileges.length)throw new Error(`Approval ${approval} names no privileges`);
      conditions=[...outcome.text.matchAll(/^- (.+?)\s+[—–-]\s+due (\d{4}-\d{2}-\d{2})/gm)].map(m=>({condition:m[1],due:m[2]}));
      if(current.wa?.expirationdate && current.wa.expirationdate>=effective && current.wa.expirationdate<=activation.cycle_end)conditions.push({condition:`Re-verify Washington licence ${current.wa.credentialnumber} before expiry.`,due:current.wa.expirationdate});
      conditions=conditions.filter(c=>!state.documents.some(d=>d.application_id===id && d.date<=state.as_of && d.fields['condition satisfied']===c.condition));
      for(const c of conditions)queue.push({item:`${c.due<=state.as_of?'Unmet condition due: present as finding to Clinical Director':'Monitor condition'}: ${c.condition}`,owner:c.due<=state.as_of?CD:MSO,due:c.due});
      queue.push({item:`Record appointment authorized by ${approval}: ${activation.privileges.join(', ')} effective ${effective}, cycle ends ${activation.cycle_end}.`,owner:MSO,due:effective});
    }
    let status=current.ready?'packet-presentable':'in-verification';
    if(decisions.some(d=>!d.admitted))status='decision-inadmissible';
    if(f?.outcome==='deferred-pending-information'){status='deferred';queue.push({item:`Chase exactly the Governing Body hold: ${f.reason}`,owner:MSO,due:null});}
    if(f?.outcome==='denied'){status='denied';queue.push({item:`Record denial ${f['decision id']}: ${f.reason}`,owner:MSO,due:null});}
    if(activation)status=activation.active_at_export?(conditions.length?'active-with-conditions':'active'):activation.effective_date>state.as_of?'approved-not-yet-effective':'in-verification';
    if(current.intake)status=current.intake;
    if(current.terminal){
      status=current.terminal;activation=null;approval=null;conditions=[];
      for(const task of queue)if(!task.item.startsWith(`File ${current.terminal}`) && !task.item.startsWith('Refused decision'))task.item=`Stopped/historical after ${current.terminal}; no further advancement: ${task.item}`;
    }
    if(!outcome && current.ready && !current.terminal)queue.push({item:'Present the revision-bound packet to the Executive Committee for recommendation and the Governing Body for its decision; the Skill cannot decide either.',owner:'Executive Committee of the Medical Staff / Governing Body',due:null});
    applications.push({application_id:id,revision:+current.app.revision,status,elements:current.elements,packet_presentable:current.ready,decisions,approval_decision_id:approval,activation,monitored_conditions:conditions,action_queue:queue});
    audit.push({application_id:id,...current.details,packet_ready_date:current.ready_date,used_verifications:current.used,terminal:current.terminal});
    } catch(error) {
      const app=state.records.applications.filter(a=>a.application_id===id).sort((a,b)=>+a.revision-+b.revision).at(-1);
      const previous=priorSnapshot?.applications.find(a=>a.application_id===id);
      const decisions=[...(previous?.decisions||[])];
      for(const d of state.documents.filter(d=>d.application_id===id && d.document_path.startsWith('decisions/'))) {
        const decisionId=d.fields['decision id'];
        if(!decisionId)throw new Error(`Cannot identify decision record ${d.document_path}: ${error.message}`);
        if(!decisions.some(x=>x.decision_id===decisionId))decisions.push({decision_id:decisionId,admitted:false,reason:`Admission not established: processing error on this application (${error.message}); Medical Services Professional review required`});
      }
      errors.push({application_id:id,error:error.message});
      applications.push({application_id:id,revision:+app.revision,status:'in-verification',elements:Object.fromEntries(['licensure','experience','gaps','education','certification','references'].map(k=>[k,'outstanding'])),packet_presentable:false,decisions,approval_decision_id:null,activation:null,monitored_conditions:[],action_queue:[{item:`Partial computation: ${error.message}. Review this application and re-run the affected snapshot chain; no readiness or activation is established by this attempt.`,owner:MSO,due:null}]});
      audit.push({application_id:id,partial:true,error:error.message});
    }
  }
  return {applications,audit,errors};
}
