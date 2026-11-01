import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readBatch,readJSON,sha} from './evidence.mjs';
import {compute} from './engine.mjs';
import {validateSnapshot} from './validation.mjs';

const json = value => JSON.stringify(value,null,2)+'\n';
function write(file,text) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,'utf8');}
function atomic(file,text){write(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}
const relative = p => path.relative(process.cwd(),path.resolve(p)).replaceAll('\\','/');
function inside(p){const r=relative(p);if(r.startsWith('../') || path.isAbsolute(r))throw new Error('Output/predecessor path must stay inside repository');return r;}
function appendLog(file,entry){write(file,(fs.existsSync(file)?fs.readFileSync(file,'utf8'):'# Credentialing run log\n\nActual attempts; business dates come from each export, runtime timestamps do not.\n')+'\n'+entry+'\n');}
export function run({folder,batch,previous=null,out='deliverables',command='programmatic invocation'}) {
  out=inside(out);const n=String(batch).padStart(2,'0');
  const paths={snapshot:`${out}/snapshots/batch-${n}.json`,state:`${out}/state/batch-${n}.json`,audit:`${out}/audit/batch-${n}.json`,result:`${out}/results/batch-${n}.json`,log:`${out}/run-log.md`};
  const at=new Date().toISOString();let prior=null,priorSnapshot=null,predecessor=null;
  try {
    if(previous){
      previous=inside(previous);prior=readJSON(previous);
      const {integrity,...unsigned}=prior;
      if(integrity!==sha(json(unsigned)))throw new Error('Predecessor evidence-state integrity mismatch');
      const p=inside(prior.snapshot.path),bytes=fs.readFileSync(p);
      if(sha(bytes)!==prior.snapshot.sha256)throw new Error('Predecessor snapshot hash mismatch');
      priorSnapshot=validateSnapshot(JSON.parse(bytes));
      if(priorSnapshot.batch!==prior.batch || priorSnapshot.as_of!==prior.as_of)throw new Error('Predecessor state and snapshot disagree');
      predecessor={path:p,sha256:sha(bytes)};
    }
    const {state,consumed}=readBatch(folder,batch,prior);
    delete state.integrity;delete state.snapshot;delete state.fingerprint;
    const policy=readJSON('references/policy.json');
    const codeHash=sha(['scripts/credential.mjs','scripts/engine.mjs','scripts/evidence.mjs','scripts/dates.mjs','scripts/validation.mjs','snapshot.schema.json','references/policy.json','deliverables/rules.md'].map(p=>fs.readFileSync(p)).join('\n'));
    const fingerprint=sha(json({inputs:state.inputs,predecessor,codeHash}));
    if(fs.existsSync(paths.state) && fs.existsSync(paths.snapshot)) {
      const existing=readJSON(paths.state);
      if(existing.fingerprint===fingerprint && existing.snapshot.sha256===sha(fs.readFileSync(paths.snapshot))) {
        validateSnapshot(readJSON(paths.snapshot));
        appendLog(paths.log,`## ${at} — batch ${batch}: unchanged re-run\n\nCommand: \`${command}\`. Consumed: ${consumed.record_files.join(', ')}; opened ${consumed.documents.length} documents. Existing occurrence retained byte for byte. Wrote: ${paths.log}, ${paths.result}.`);
        atomic(paths.result,json({run_at:at,batch,status:existing.processing_errors?.length?'partial':'supported',errors:existing.processing_errors||[],unchanged:true,snapshot:paths.snapshot}));
        return readJSON(paths.snapshot);
      }
    }
    const result=compute(state,policy,priorSnapshot);
    const snapshot={schema_version:'credentialing-snapshot/1',snapshot_id:randomUUID(),predecessor,batch,as_of:state.as_of,consumed,produced:Object.values(paths),rules_file:'deliverables/rules.md',applications:result.applications};
    const superseded=[];
    if(fs.existsSync(paths.snapshot)) {
      const old=readJSON(paths.snapshot);
      for(const file of [paths.snapshot,paths.state,paths.audit,paths.result])if(fs.existsSync(file)){
        const archive=`${out}/superseded/${old.snapshot_id}/${path.basename(path.dirname(file))}-${path.basename(file)}`;
        write(archive,fs.readFileSync(file));superseded.push(archive);
      }
      snapshot.produced.push(...superseded);
    }
    validateSnapshot(snapshot);
    const bytes=json(snapshot);
    state.snapshot={path:paths.snapshot,sha256:sha(bytes)};state.fingerprint=fingerprint;state.processing_errors=result.errors;
    state.integrity=sha(json(state));
    // All computation/validation precedes writes of the current occurrence; snapshot is the commit marker.
    atomic(paths.audit,json(result.audit));atomic(paths.state,json(state));
    atomic(paths.snapshot,bytes);
    const status=result.errors.length?'partial':'supported';
    atomic(paths.result,json({run_at:at,batch,status,errors:result.errors,snapshot:paths.snapshot,submission_note:'Business holds and outstanding work remain in application action queues.',superseded}));
    appendLog(paths.log,`## ${at} — batch ${batch}: ${status}\n\nCommand: \`${command}\`. Export clock: ${state.as_of}.\n\nConsumed: ${consumed.record_files.join(', ')}.\n\nDocuments opened: ${consumed.documents.join(', ') || '(none)'}.\n\nWrote: ${snapshot.produced.join(', ')}.\n\n${superseded.length?'Superseded earlier occurrence because input, predecessor, policy or implementation changed; original bytes retained at '+superseded.join(', ')+'.':'First retained occurrence.'} Retained ${snapshot.applications.length} applications; unresolved business work is owned in each queue. ${result.errors.length?'Failures and affected scope: '+JSON.stringify(result.errors):'No run failures.'}`);
    return snapshot;
  } catch(error) {
    atomic(paths.result,json({run_at:at,batch,status:'blocked',error:error.message,affected_scope:folder,snapshot:null,last_retained_snapshot:prior?.snapshot?.path||null}));
    appendLog(paths.log,`## ${at} — batch ${batch}: blocked\n\nCommand: \`${command}\`. Affected scope: ${folder}. Error: ${error.message}. No new computed snapshot. Current attempt result: ${paths.result}; last retained predecessor: ${prior?.snapshot?.path||'(none)'}. Wrote ${paths.result}, ${paths.log}.`);
    throw error;
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),opts={};
  for(let i=0;i<args.length;i+=2){if(!['--batch','--number','--previous','--out'].includes(args[i]) || !args[i+1])throw new Error('Usage: node scripts/credential.mjs --batch inputs/batch-01 --number 1 [--previous deliverables/state/batch-01.json] [--out deliverables]');opts[args[i].slice(2)]=args[i+1];}
  try{const s=run({folder:opts.batch,batch:Number(opts.number),previous:opts.previous,out:opts.out,command:`node scripts/credential.mjs ${args.join(' ')}`});console.log(`Batch ${s.batch}: ${s.applications.length} applications at ${s.as_of}; snapshot ${s.snapshot_id}`);}catch(e){console.error(e.message);process.exitCode=1;}
}
