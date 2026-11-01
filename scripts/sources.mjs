import fs from 'node:fs';

export const sourcePolicy=JSON.parse(fs.readFileSync(new URL('../references/accepted-sources.json',import.meta.url),'utf8'));
const norm=s=>(s||'').normalize('NFC').replaceAll('\u2019',"'").replace(/\s+/g,' ').trim().toLowerCase();
const same=(a,b)=>!!norm(a) && norm(a)===norm(b);
const identifies=(value,entity)=>[entity.name,...entity.aliases].some(alias=>same(value,alias));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const yes=(kind,source)=>({admitted:true,kind,source,reason:null});
const no=reason=>({admitted:false,kind:null,source:null,reason});
function sender(text) {
  const parts=(text||'').trim().split(/\s+[\u2014\u2013-]\s+/);
  return parts.length===2 ? {role:parts[0],organization:parts[1]} : parts.length===1 ? {role:null,organization:parts[0]} : null;
}
function equivalent(text,list) {
  const s=sender(text);if(!s)return null;
  const named=value=>list.find(e=>[e.name,...e.aliases].some(a=>same(a,value)));
  const organization=named(s.organization);if(!organization)return null;
  if(s.role && !same(s.role,'Designated equivalent source') && named(s.role)!==organization)return null;
  return organization;
}
function barred(reply) {
  return /\bapplicant\b|photocop|certificate image|scanned certificate|copy of (?:a |the )?(?:diploma|licen[sc]e|certificate)/i.test([reply.received_from,reply.reply_method].filter(Boolean).join(' '))
    || /(?:^|[.!?]\s+)(?:(?:this (?:document|reply|attachment) is|only)\s+)?(?:a\s+)?(?:photocopy|scanned copy|copy) of (?:a |the )?(?:diploma|licen[sc]e|certificate)\b/i.test(reply.notes||'');
}
function directSender(reply,roles,organization) {
  const s=sender(reply.received_from);
  return s && roles.some(r=>same(r,s.role)) && same(s.organization,organization) && same(reply.attester_organization,organization);
}
function mostRecentAffiliation(context,reply,exclude=null) {
  if(!context.history || !reply.received_date)return null;
  // End dates establish recency at receipt. Overlapping current affiliations
  // are ambiguous: do not invent a tie-breaker the office did not publish.
  const eligible=context.history.filter(e=>!['medical-school','residency','fellowship'].includes(e.entry_type) && e.from_date<=reply.received_date && !same(e.organization,exclude));
  const end=e=>!e.to_date || e.to_date>reply.received_date ? reply.received_date : e.to_date;
  const last=eligible.map(end).sort().at(-1);
  if(eligible.some(e=>end(e)===last && !['employment','affiliation'].includes(e.entry_type)))return null;
  const organizations=[...new Set(eligible.filter(e=>end(e)===last).map(e=>norm(e.organization)))];
  return organizations.length===1 ? organizations[0] : null;
}
function ownVerification(notes,entry) {
  // These are provenance statements made by the attesting office, not an
  // evaluation of whether the practitioner should be appointed.
  return notes.split(/[.!?](?:\s+|$)/).some(sentence=>{
    if(!/^(?:this office|our (?:medical staff )?office|we) (?:verified|obtained (?:its |our |the )?(?:own )?verification)\b/i.test(sentence.trim()) || /\b(?:not|never|nothing|unable)\b/i.test(sentence))return false;
    const target=sentence.match(/\bdirectly (?:with|from) (.+?)(?: on \d{4}-\d{2}-\d{2}|[,;]|$)/i)?.[1];
    if(!target)return false;
    if(equivalent(target.replace(/^the /i,''),sourcePolicy.education_equivalents))return true;
    const department=entry.entry_type==='medical-school'?/\b(?:registrar|dean)\b/i:['residency','fellowship'].includes(entry.entry_type)?/\b(?:graduate medical education|programme director|program director)\b/i:/\b(?:medical staff office|human resources|authorized administrator|authorised administrator)\b/i;
    const original=new RegExp('(?:^|\\b)'+escape(norm(entry.organization))+'(?:\\b|$)').test(norm(target)) || /^(?:the )?(?:college|school|institution|programme|program|employer|hospital)'s\b/i.test(target);
    return original && department.test(target);
  });
}
function closure(notes,organization,word) {
  const text=norm(notes),name=escape(norm(organization));
  return new RegExp('(?:^|[.!?]\\s+)'+name+' (?:has |was |is now )?'+word+'\\b').test(text)
    && !new RegExp(name+'[^.!?]{0,60}\\b(?:not|never) (?:closed|dissolved)\\b').test(text);
}
function secondary(reply,entry,context) {
  const education=reply.element==='education-and-training',notes=reply.notes||'';
  const recent=mostRecentAffiliation(context,reply,education?null:entry.organization);
  if(!recent || !same(reply.attester_organization,recent))return no('Secondary donor is not the uniquely established most recent affiliation; MSP must resolve missing or ambiguous provenance');
  const roles=education?['Medical staff office']:sourcePolicy.employment_roles;
  if(!directSender(reply,roles,reply.attester_organization))return no('Secondary reply must arrive directly from the permitted office of that affiliation');
  if(!closure(notes,entry.organization,education?'closed':'dissolved'))return no('Impossibility must explicitly identify the closed school/programme or dissolved employer; silence is not impossibility');
  if(!ownVerification(notes,entry))return no('Secondary donor must state how it obtained its own verification from an accepted original/equivalent source');
  if(education) {
    const noEquivalent=notes.split(/[.!?](?:\s+|$)/).some(sentence=>/^(?:No designated equivalent source holds (?:the |a )?record|(?:This letter is a secondary source and is offered because (?:the )?|The )?primary and (?:the )?designated equivalent sources are both impossible)\s*$/i.test(sentence.trim()));
    if(!noEquivalent)return no('No unambiguous recorded statement establishes that designated equivalent sources cannot supply the record');
    const latestEquivalent=new Map();
    for(const r of [...(context.replies||[])].sort((a,b)=>a.received_date.localeCompare(b.received_date))) {
      if(r.entry_id!==entry.entry_id || r.application_id!==entry.application_id || r.received_date<context.firstReceived || r.received_date>reply.received_date || barred(r))continue;
      const e=equivalent(r.received_from,sourcePolicy.education_equivalents);
      if(e && identifies(r.attester_organization,e))latestEquivalent.set(e.name,r);
    }
    if([...latestEquivalent.values()].some(r=>r.outcome?.startsWith('confirmed')))return no('Recorded equivalent-source confirmation contradicts the claimed impossibility route');
  } else if(!notes.split(/[.!?](?:\s+|$)/).some(sentence=>/^(?:No successor (?:holds|has) (?:the |any )?records|(?:Its |The )?records were not transferred to a successor(?: institution)?)\s*$/i.test(sentence.trim())))return no('No unambiguous recorded evidence establishes absence of a successor holding employment records');
  return yes('secondary',reply.attester_organization);
}

export function verificationSource(reply,entry,context={}) {
  if(reply.entry_id!==entry.entry_id || reply.application_id!==entry.application_id)return no('Reply does not identify the same application/history entry');
  if(barred(reply))return no('Applicant-carried evidence or a certificate copy cannot replace verification');
  const educationEntry=['medical-school','residency','fellowship'].includes(entry.entry_type);
  if(educationEntry && reply.element!=='education-and-training' || !educationEntry && entry.entry_type!=='other' && reply.element==='education-and-training')return no('Reply element does not match the declared education/employment entry');
  if(reply.element==='education-and-training') {
    const education=equivalent(reply.received_from,sourcePolicy.education_equivalents);
    if(education)return identifies(reply.attester_organization,education)?yes('designated-equivalent',education.name):no('Equivalent-source sender identity and attester organization disagree');
    const roles=entry.entry_type==='medical-school'?sourcePolicy.medical_school_roles:['residency','fellowship','other'].includes(entry.entry_type)?sourcePolicy.postgraduate_roles:[];
    if(directSender(reply,roles,entry.organization))return yes('primary',entry.organization);
    if(sender(reply.received_from)?.role && same(sender(reply.received_from).role,'Medical staff office'))return secondary(reply,entry,context);
    return no('Education sender/office is not the original school/programme or an expressly accepted equivalent source');
  }
  if(reply.element==='affiliation-and-employment') {
    if(directSender(reply,sourcePolicy.employment_roles,entry.organization))return yes('primary',entry.organization);
    const s=sender(reply.received_from);
    if(s && same(s.role,sourcePolicy.cvo_role)) {
      if(!same(s.organization,reply.attester_organization) || same(s.organization,entry.organization))return no('CVO must be separately named and match the attesting organization');
      const employer=escape(norm(entry.organization)),cvo=escape(norm(reply.attester_organization));
      const retained=(reply.notes||'').split(/[.!?](?:\s+|$)/).some(sentence=>! /\b(?:not|never)\b/i.test(sentence) && new RegExp('^(?:retained|(?:this cvo|our organization|the cvo|we|'+cvo+') (?:is|was|were|are) retained) (?:directly )?by '+employer+'(?:[.,;:]|$| (?:to|and|for)\\b)').test(norm(sentence)));
      if(retained)return yes('designated-equivalent',reply.attester_organization);
      return no('CVO reply must establish retention by the specific affiliation/employer it acted for');
    }
    if(s && sourcePolicy.employment_roles.some(r=>same(s.role,r)))return secondary(reply,entry,context);
    return no('Employment sender is outside the closed source table');
  }
  return no('Unknown verification element; MSP review required');
}

export function certificationSource(reply,declaration) {
  if(reply.application_id!==declaration.application_id || reply.declaration_id!==declaration.declaration_id)return no('Certification reply does not identify this application/declaration');
  if(barred(reply))return no('Applicant-carried certification or a certificate image is inadmissible');
  if(!same(reply.board_name,declaration.issuer) || !same(reply.board_code,declaration.jurisdiction_or_board))return no('Certification board identity/code disagrees with the declared issuing board');
  const s=sender(reply.received_from);
  if(s && (!s.role || same(s.role,'Certifying board')) && same(s.organization,declaration.issuer))return yes('primary',declaration.issuer);
  const equivalentSource=equivalent(reply.received_from,sourcePolicy.certification_equivalents);
  return equivalentSource?yes('designated-equivalent',equivalentSource.name):no('Certification sender is neither the issuing board nor an expressly accepted equivalent service');
}

export function licenceSource(row,declaration) {
  if(!same(row.board_state,declaration.jurisdiction_or_board) || row.licence_number!==declaration.number_declared)return no('Licence lookup does not identify the declared jurisdiction and number');
  const identity=row.verified_by||'';
  if(/\bapplicant\b|photocop|aggregator|directory|employer.*copy/i.test(identity))return no('Licence evidence is an applicant/employer copy or an unaccepted directory');
  if(equivalent(identity,sourcePolicy.licence_equivalents))return yes('designated-equivalent',sourcePolicy.licence_equivalents[0].name);
  const exact=[declaration.issuer,...['online verification','written reply','written verification'].map(method=>`${declaration.issuer} ${method}`)];
  return exact.some(value=>same(value,identity))?yes('primary',declaration.issuer):no('Licence verifier is not the named issuing state board or FSMB Physician Data Center; no secondary route exists');
}
