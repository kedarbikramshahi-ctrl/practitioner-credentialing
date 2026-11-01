import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {readJSON} from './evidence.mjs';
const ajv = new Ajv2020({allErrors:true, strict:false});
addFormats(ajv);
const check = ajv.compile(readJSON(new URL('../snapshot.schema.json',import.meta.url)));
export function validateSnapshot(snapshot) {
  if (!check(snapshot)) throw new Error(`Snapshot schema: ${ajv.errorsText(check.errors)}`);
  if (new Set(snapshot.applications.map(a=>a.application_id)).size!==snapshot.applications.length)throw new Error('Duplicate application');
  for(const a of snapshot.applications) {
    if(a.approval_decision_id && !a.decisions.some(d=>d.decision_id===a.approval_decision_id && d.admitted))throw new Error('Activation lacks admitted approval');
    if(!!a.activation!==!!a.approval_decision_id)throw new Error('Approval and activation disagree');
    if(a.decisions.some(d=>d.admitted && d.reason!==null))throw new Error('Admitted decision carries refusal reason');
    if(new Set(a.decisions.map(d=>d.decision_id)).size!==a.decisions.length)throw new Error('Duplicate decision identifier');
    if(a.activation?.active_at_export && a.activation.effective_date>snapshot.as_of)throw new Error('Premature activation');
    if(a.activation?.active_at_export && a.activation.cycle_end<snapshot.as_of)throw new Error('Activation after appointment cycle');
    if(['withdrawn','discontinued'].includes(a.status) && a.activation)throw new Error('Terminal file activated');
  }
  return snapshot;
}
