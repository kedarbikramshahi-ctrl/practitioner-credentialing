import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// A durable undo journal gives interrupted multi-file publication one recovery
// outcome. Readers refuse pending transactions; the next run recovers before
// reading state. This is process-crash recovery, not a hardware power-loss claim.
export const journalPath = out => path.join(out,'.transaction.json');
const encode = bytes => bytes === null ? null : Buffer.from(bytes).toString('base64');
function current(file) {return fs.existsSync(file)?fs.readFileSync(file):null;}
function durable(file,bytes,exclusive=false) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const fd=fs.openSync(file,exclusive?'wx':'w');
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replace(file,bytes) {
  if(bytes===null){if(fs.existsSync(file))fs.unlinkSync(file);return;}
  const tmp=`${file}.${randomUUID()}.tmp`;
  try{durable(tmp,bytes);fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
function safeEntries(out,entries) {
  const root=path.resolve(out)+path.sep;
  for(const e of entries)if(!path.resolve(e.path).startsWith(root) || path.resolve(e.path)===path.resolve(journalPath(out)))throw new Error('Transaction path escapes output directory');
}
function rollback(entries) {for(const e of [...entries].reverse())replace(e.path,e.before===null?null:Buffer.from(e.before,'base64'));}
export function assertNoTransaction(out) {
  if(fs.existsSync(journalPath(out)))throw new Error(`Pending output transaction in ${out}; run the batch command to recover before reading results`);
}
export function recoverTransaction(out) {
  const journal=journalPath(out);
  if(!fs.existsSync(journal))return null;
  const plan=JSON.parse(fs.readFileSync(journal,'utf8'));
  if(plan.version!==1 || !['pending','committed'].includes(plan.phase))throw new Error('Unrecognized output transaction journal; manual recovery required');
  safeEntries(out,plan.entries);
  if(plan.phase==='pending' && plan.owner_pid) {
    let alive=true;
    try{process.kill(plan.owner_pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
    if(alive)throw new Error('Output transaction owner is still running; do not read or recover its files');
  }
  if(plan.phase==='pending')rollback(plan.entries);
  fs.unlinkSync(journal);
  return plan.phase==='pending'?plan.context:null;
}
export function commitFiles(out,files,{context=null,fault=null}={}) {
  for(const f of files)if(Object.hasOwn(f,'expected')) {
    const bytes=current(f.path);
    if((bytes===null)!==(f.expected===null) || (bytes && !bytes.equals(Buffer.from(f.expected))))throw new Error(`Output changed during computation: ${f.path}`);
  }
  const entries=files.map(f=>({path:f.path,before:encode(current(f.path)),after:encode(f.bytes)}));
  safeEntries(out,entries);
  if(new Set(entries.map(e=>path.resolve(e.path))).size!==entries.length)throw new Error('Duplicate transaction destination');
  const journal=journalPath(out),plan={version:1,phase:'pending',owner_pid:process.pid,context,entries};
  // wx is also the single-writer guard. Never recover another live transaction.
  durable(journal,JSON.stringify(plan),true);
  try {
    for(const [index,e] of entries.entries()) {
      fault?.({phase:'before',index,path:e.path});
      replace(e.path,Buffer.from(e.after,'base64'));
      fault?.({phase:'after',index,path:e.path});
    }
    replace(journal,Buffer.from(JSON.stringify({...plan,phase:'committed'})));
  } catch(error) {
    try{rollback(entries);fs.unlinkSync(journal);}catch(recoveryError){throw new Error(`${error.message}; rollback incomplete: ${recoveryError.message}; pending journal retained`);}
    throw error;
  }
  // A committed journal left by cleanup failure is safe to finish next time.
  fs.unlinkSync(journal);
}
