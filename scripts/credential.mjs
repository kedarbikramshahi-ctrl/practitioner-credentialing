import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readBatch,readJSON,sha} from './evidence.mjs';
import {compute} from './engine.mjs';
import {validateSnapshot} from './validation.mjs';
import {assertNoTransaction,commitFiles,journalPath,recoverTransaction} from './transaction.mjs';

const json = value => JSON.stringify(value,null,2)+'\n';
const relative = p => path.relative(process.cwd(),path.resolve(p)).replaceAll('\\','/');
function inside(p){const r=relative(p);if(r.startsWith('../') || path.isAbsolute(r))throw new Error('Output/predecessor path must stay inside repository');return r;}
function logBytes(file,entry){return (fs.existsSync(file)?fs.readFileSync(file,'utf8'):'# Credentialing run log\n\nActual attempts; business dates come from each export, runtime timestamps do not.\n')+'\n'+entry+'\n';}
function pathsFor(out,batch){const n=String(batch).padStart(2,'0');return {snapshot:`${out}/snapshots/batch-${n}.json`,state:`${out}/state/batch-${n}.json`,audit:`${out}/audit/batch-${n}.json`,result:`${out}/results/batch-${n}.json`,log:`${out}/run-log.md`};}
function recordFailure(out,context,error) {
  const p=pathsFor(out,context.batch);
  const result={run_at:context.at,batch:context.batch,status:'blocked',error,affected_scope:context.folder,snapshot:null,last_retained_snapshot:context.lastRetainedSnapshot||null};
  const entry=`## ${context.at} — batch ${context.batch}: blocked\n\nCommand: \`${context.command}\`. Affected scope: ${context.folder}. Error: ${error}. No new snapshot was published; prior files were retained or restored. Wrote ${p.result}, ${p.log}. Last retained snapshot: ${context.lastRetainedSnapshot||'(none)'}.`;
  commitFiles(out,[{path:p.result,bytes:json(result)},{path:p.log,bytes:logBytes(p.log,entry)}],{context});
}
export function run({folder,batch,previous=null,out='deliverables',command='programmatic invocation',reason=null,writeFault=null}) {
  out=inside(out);const n=String(batch).padStart(2,'0');
  const recovered=recoverTransaction(out);
  if(recovered)recordFailure(out,recovered,`Recovered interrupted output transaction at ${new Date().toISOString()}; prior files restored before reading state`);
  const paths=pathsFor(out,batch);
  const at=new Date().toISOString();let prior=null,priorSnapshot=null,predecessor=null;
  const context={at,batch,folder,command,lastRetainedSnapshot:fs.existsSync(paths.snapshot)?paths.snapshot:null};
  try {
    if(previous){
      previous=inside(previous);assertNoTransaction(path.dirname(path.dirname(previous)));prior=readJSON(previous);
      const {integrity,...unsigned}=prior;
      if(integrity!==sha(json(unsigned)))throw new Error('Predecessor evidence-state integrity mismatch');
      const p=inside(prior.snapshot.path),bytes=fs.readFileSync(p);
      if(sha(bytes)!==prior.snapshot.sha256)throw new Error('Predecessor snapshot hash mismatch');
      priorSnapshot=validateSnapshot(JSON.parse(bytes));
      assertNoTransaction(path.dirname(path.dirname(previous)));
      if(priorSnapshot.batch!==prior.batch || priorSnapshot.as_of!==prior.as_of)throw new Error('Predecessor state and snapshot disagree');
      predecessor={path:p,sha256:sha(bytes)};
      context.lastRetainedSnapshot ||= p;
    }
    const {state,consumed}=readBatch(folder,batch,prior);
    delete state.integrity;delete state.snapshot;delete state.fingerprint;
    const policy=readJSON('references/policy.json');
    const codeHash=sha(['scripts/credential.mjs','scripts/transaction.mjs','scripts/engine.mjs','scripts/evidence.mjs','scripts/dates.mjs','scripts/validation.mjs','snapshot.schema.json','references/policy.json','deliverables/rules.md'].map(p=>fs.readFileSync(p)).join('\n'));
    const fingerprint=sha(json({inputs:state.inputs,predecessor,codeHash}));
    if(fs.existsSync(paths.state) && fs.existsSync(paths.snapshot)) {
      const existing=readJSON(paths.state);
      if(existing.fingerprint===fingerprint && existing.snapshot.sha256===sha(fs.readFileSync(paths.snapshot))) {
        validateSnapshot(readJSON(paths.snapshot));
        const entry=`## ${at} — batch ${batch}: unchanged re-run\n\nCommand: \`${command}\`. Consumed: ${consumed.record_files.join(', ')}; opened ${consumed.documents.length} documents. Existing occurrence retained byte for byte. Wrote: ${paths.log}, ${paths.result}.`;
        commitFiles(out,[{path:paths.log,bytes:logBytes(paths.log,entry)},{path:paths.result,bytes:json({run_at:at,batch,status:existing.processing_errors?.length?'partial':'supported',errors:existing.processing_errors||[],unchanged:true,snapshot:paths.snapshot})}],{context,fault:writeFault});
        return readJSON(paths.snapshot);
      }
    }
    const result=compute(state,policy,priorSnapshot);
    const snapshot={schema_version:'credentialing-snapshot/1',snapshot_id:randomUUID(),predecessor,batch,as_of:state.as_of,consumed,produced:Object.values(paths),rules_file:'deliverables/rules.md',applications:result.applications};
    const superseded=[],archives=[];
    const oldSnapshotBytes=fs.existsSync(paths.snapshot)?fs.readFileSync(paths.snapshot):null;
    if(fs.existsSync(paths.snapshot)) {
      const old=readJSON(paths.snapshot);
      for(const file of [paths.snapshot,paths.state,paths.audit,paths.result])if(fs.existsSync(file)){
        const archive=`${out}/superseded/${old.snapshot_id}/${path.basename(path.dirname(file))}-${path.basename(file)}`;
        const original=fs.readFileSync(file);
        if(fs.existsSync(archive)) {
          if(!fs.readFileSync(archive).equals(original))throw new Error(`Refusing to overwrite retained occurrence ${archive}`);
        } else {archives.push({path:archive,bytes:original});superseded.push(archive);}
      }
      snapshot.produced.push(...superseded);
    }
    validateSnapshot(snapshot);
    const bytes=json(snapshot);
    state.snapshot={path:paths.snapshot,sha256:sha(bytes)};state.fingerprint=fingerprint;state.processing_errors=result.errors;
    state.integrity=sha(json(state));
    const status=result.errors.length?'partial':'supported';
    const entry=`## ${at} — batch ${batch}: ${status}\n\nCommand: \`${command}\`. Export clock: ${state.as_of}.\n\nConsumed: ${consumed.record_files.join(', ')}.\n\nDocuments opened: ${consumed.documents.join(', ') || '(none)'}.\n\nWrote: ${snapshot.produced.join(', ')}.\n\n${superseded.length?'Superseded occurrence '+JSON.parse(oldSnapshotBytes).snapshot_id+' because '+(reason||'input, predecessor, policy or implementation changed')+'; original bytes retained at '+superseded.join(', ')+'.':'First retained occurrence.'} Retained ${snapshot.applications.length} applications; unresolved business work is owned in each queue. ${result.errors.length?'Failures and affected scope: '+JSON.stringify(result.errors):'No run failures.'}`;
    commitFiles(out,[...archives,{path:paths.audit,bytes:json(result.audit)},{path:paths.state,bytes:json(state)},{path:paths.snapshot,bytes,expected:oldSnapshotBytes},{path:paths.result,bytes:json({run_at:at,batch,status,errors:result.errors,snapshot:paths.snapshot,submission_note:'Business holds and outstanding work remain in application action queues.',superseded})},{path:paths.log,bytes:logBytes(paths.log,entry)}],{context,fault:writeFault});
    return snapshot;
  } catch(error) {
    if(fs.existsSync(journalPath(out)))throw new Error(`${error.message}; output journal retained; recover before reading results`);
    recordFailure(out,context,error.message);
    throw error;
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),opts={};
  for(let i=0;i<args.length;i+=2){if(!['--batch','--number','--previous','--out','--reason'].includes(args[i]) || !args[i+1])throw new Error('Usage: node scripts/credential.mjs --batch inputs/batch-01 --number 1 [--previous deliverables/state/batch-01.json] [--out deliverables] [--reason "correction reason"]');opts[args[i].slice(2)]=args[i+1];}
  try{const s=run({folder:opts.batch,batch:Number(opts.number),previous:opts.previous,out:opts.out,reason:opts.reason,command:`node scripts/credential.mjs ${args.map(a=>/\s/.test(a)?JSON.stringify(a):a).join(' ')}`});console.log(`Batch ${s.batch}: ${s.applications.length} applications at ${s.as_of}; snapshot ${s.snapshot_id}`);}catch(e){console.error(e.message);process.exitCode=1;}
}
