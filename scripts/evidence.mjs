import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {day} from './dates.mjs';

export const recordNames = ['applications','application-disclosures','declared-history','declared-credentials','privilege-requests','licence-lookup-wa','licence-lookup-other-states','certification-replies','verification-replies','verification-attempts','peer-referees','peer-reference-replies','correspondence'];
export const sha = data => createHash('sha256').update(data).digest('hex');
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function fields(text) {
  return Object.fromEntries([...text.matchAll(/^\*\*([^*]+):\*\*[ \t]*(.*?)[ \t]*$/gm)].map(m => [m[1].toLowerCase(), m[2].trim()]));
}
export function readBatch(folder, batch, prior = null) {
  if (!Number.isInteger(batch) || batch !== (prior?.batch || 0) + 1) throw new Error('Consume exactly the next batch; a predecessor is required after batch 1');
  const root = path.resolve(folder), readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const asOf = readme.match(/Export date:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  day(asOf || '');
  if (prior && asOf <= prior.as_of) throw new Error('Export clock must advance');
  const state = structuredClone(prior || {version:1, batch:0, records:{}, documents:[], inputs:[]});
  const hashes = {'README.md':sha(fs.readFileSync(path.join(root, 'README.md')))};
  const counts = {};
  for (const name of recordNames) {
    const file = `${name}.csv`, bytes = fs.readFileSync(path.join(root, file));
    hashes[file] = sha(bytes);
    const rows = parse(bytes, {columns:true, bom:true, skip_empty_lines:true});
    counts[file] = rows.length;
    const expected = readme.match(new RegExp('`' + file.replace('.', '\\.') + '`\\s*\\|\\s*(\\d+)'));
    if (expected && Number(expected[1]) !== rows.length) throw new Error(`${file}: expected ${expected[1]} rows, found ${rows.length}`);
    for (const row of rows) for (const [key, value] of Object.entries(row)) {
      if (value && (key.endsWith('_date') || ['from_date','to_date','verified_from','verified_to','signature_date','last_worked_together_end'].includes(key))) {
        day(value);
        if (['received_date','lookup_date','attempt_date','signature_date'].includes(key) && value > asOf) throw new Error(`${file}: future evidence ${key}=${value}`);
      }
    }
    state.records[name] ||= [];
    for (const row of rows) {
      const same = state.records[name].some(old => JSON.stringify(old) === JSON.stringify(row));
      if (!same) state.records[name].push(row);
    }
  }
  const docs = [];
  for (const row of parse(fs.readFileSync(path.join(root, 'correspondence.csv')), {columns:true, bom:true, skip_empty_lines:true})) {
    day(row.date);
    if (row.date > asOf) throw new Error(`Future correspondence ${row.letter_id}`);
    const target = path.resolve(root, row.document_path);
    if (!target.startsWith(root + path.sep)) throw new Error('Document path escapes batch');
    const bytes = fs.readFileSync(target), text = bytes.toString('utf8');
    hashes[row.document_path] = sha(bytes);
    const parsed = fields(text);
    if (parsed.application && parsed.application !== row.application_id) throw new Error(`Application mismatch: ${row.document_path}`);
    if (parsed.date && parsed.date !== row.date) throw new Error(`Correspondence date mismatch: ${row.document_path}`);
    state.documents.push({...row, text, fields:parsed, batch});
    docs.push(row.document_path);
  }
  for (const kind of ['letters','dispositions','decisions']) {
    const expected = readme.match(new RegExp('`' + kind + '/`\\s*\\|\\s*(\\d+)'));
    const actual = docs.filter(p => p.startsWith(kind + '/')).length;
    if (expected && +expected[1] !== actual) throw new Error(`${kind}: expected ${expected[1]} documents, found ${actual}`);
  }
  for (const app of state.records.applications) {
    const first = state.records.applications.filter(a => a.application_id === app.application_id).sort((a,b)=>+a.revision - +b.revision)[0];
    if (app.first_received_date !== first.first_received_date) throw new Error(`First receipt changed: ${app.application_id}`);
  }
  state.batch = batch; state.as_of = asOf;
  state.inputs.push({batch, as_of:asOf, hashes, counts});
  return {state, consumed:{record_files:recordNames.map(n => `${n}.csv`), documents:docs}};
}
