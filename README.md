# Practitioner credentialing

Reusable initial-appointment credentialing Skill for Larkhollow Community Hospital's fictional exports. Start with [SKILL.md](SKILL.md). The authorized replacement plan is [PLAN.md](PLAN.md).

## Install and run

Requires Node.js 22 or later and npm. Dependency versions are locked in package-lock.json. On Windows use npm.cmd if PowerShell blocks npm.ps1.

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
node scripts/credential.mjs --batch inputs/batch-01 --number 1
node scripts/credential.mjs --batch inputs/batch-02 --number 2 --previous deliverables/state/batch-01.json
node scripts/credential.mjs --batch inputs/batch-03 --number 3 --previous deliverables/state/batch-02.json
npm.cmd run verify
```

On other shells, `npm` works in place of `npm.cmd`. Run from the repository root. `--out <repository-relative-directory>` redirects computed outputs for review/testing. The rules register remains deliverables/rules.md.

Each input batch contains README.md with its export date, thirteen CSVs, and all documents indexed in correspondence.csv. Header-only CSVs are valid. Never edit a closed export. The next authorized batch must use the same office format, a strictly later export date and the next batch number; invoke the command with the last state file. Do not merge later CSVs by hand or start batch 3 without batch 2's state.

## Outputs and resuming work

| File | Purpose |
|---|---|
| deliverables/snapshots/batch-0N.json | Schema-valid caseload state, revision, six elements, readiness, every decision/refusal, activation, monitored conditions and human queue |
| deliverables/state/batch-0N.json | Cumulative source rows/documents, first-receipt history, input hashes and binding to snapshot bytes; input to next run |
| deliverables/audit/batch-0N.json | Entry-level source selection, declared and verified dates, gaps, reference exclusions, supported/unsupported subsets and limitations |
| deliverables/results/batch-0N.json | Latest attempt's submission state, errors and affected scope; inspect this before claiming success |
| deliverables/run-log.md | Actual commands, runtime timestamps, export clocks, consumed files/documents, writes, failures and supersessions |
| deliverables/rules.md | Applied rules with office/manual sections and explicit human authority boundaries |
| deliverables/verification.md | Evidence checks, independent arithmetic, fixes and limits |

Supported means the batch was computed and validated; all three snapshots together are the supplied-batch submission. Partial means a consumed application's computation failed: it stays in the caseload with conservative outstanding states, no new activation, an MSP-owned error queue, and scope in the result/run log. Repair and regenerate that batch and successors before relying on it. Blocked means the batch could not be consumed or validated: no new computed snapshot is claimed, the current attempt result points to the failure and the retained predecessor remains historical. A previous successful snapshot never substitutes for a later blocked attempt.

Deferred is a business hold, carried as application status `deferred` with the information and owner it awaits. It is compatible with a supported run. Other incomplete evidence and human decisions also remain explicit business work, not run failures. Queues are reports and proposed tasks; the program sends no correspondence and never records invented verification attempts or clinical decisions.

Open the latest snapshot's action_queue alongside its audit entry and original referenced evidence. Supply actual replies and authorized dispositions in a new closed export. The Skill cannot decide whether an explanation is satisfactory, a finding disqualifies, eligibility requires discontinuation, a recommendation should be made or which privileges the GB should grant. These remain with the roster's named people and bodies.

Each snapshot links its predecessor by path and SHA-256; the state links the snapshot and carries its own integrity hash. `npm run verify` checks schema, chain, all retained input hashes, output existence and decision-history preservation. The original schema is used by Ajv 2020 plus date-format validation. Tests cover supplied cases, boundaries, malformed application scope, missing batches, tampered state and unchanged reruns.

A Git commit seals a snapshot. Identical reruns retain its snapshot_id and bytes while recording the attempted run. Changed reruns preserve earlier snapshot/state/audit/result bytes under deliverables/superseded/<old-id>/, create new IDs at the standard paths and record the supersession. Rerun the changed batch and every successor in order; run verification before committing the corrected chain. Do not hand off a chain with a stale predecessor hash. The runtime archives changed working occurrences too, conservatively preserving evidence even before they are sealed.

## Source documents and limits

All 124 input files were fetched through connected Google Drive. Their IDs, titles/paths and source URLs are in [references/source-manifest.json](references/source-manifest.json). The seven standing documents are readable text exports:

- [Procedure](references/procedure.md) ([office source](https://docs.google.com/document/d/1v442U759TGLwnElS24xF1MmvovZjBSHy4KKe2Nl-GDk/edit))
- [Export dictionary](references/export-note.md) ([office source](https://docs.google.com/document/d/1UtQMnsCW78nPClsgEJV1DgBKlaiIkzNS-fT93-kTLgA/edit))
- [Accepted sources](references/attester-table.md) ([office source](https://docs.google.com/document/d/1ze0RTP4H8J68FSqbFmkG7Qd_5cZiB6Lh2BfyU6v2Sj8/edit))
- [Authority roster](references/authority-roster.md) ([office source](https://docs.google.com/document/d/1Dvc3eJei4K7RyE8HZtZkMtRQNqE6VPQU8gUXVbps2xQ/edit))
- [Privilege criteria](references/privilege-criteria.md) ([office source](https://docs.google.com/document/d/1auOI2S9mT7GRn3eS6HJv3wU5C9vDqGObfMmVF9Bc4fo/edit))
- [Application form](references/application-form.md) ([office source](https://docs.google.com/document/d/1nFdoz-AeCUTBzZUXrG27AKsNXCiJ_TJLLDI3WleiiB0/edit))
- [Reference form](references/reference-form.md) ([office source](https://docs.google.com/document/d/1p7lZMbDkrr34rqkv59OpGoZv_XBncpAz2WXCAH7Qa80/edit))

The policy table in references/policy.json transcribes the privilege rows and authority dates. The parser is designed for these versioned office exports and their structured Markdown headers; unfamiliar formats require MSP review and tested parser changes. CV contents, application signature/date and referee working addresses are not present in exported columns. Their checks are explicitly not assessable and remain queued for office confirmation, rather than being fabricated. Only the six in-scope elements are computed; other credentialing processes remain outside this Skill.

## Local capture and handoff

First meaningful implementation commit: `032671cb9c05259054bba039ebd84931dee6c51a`.
Entire local checkpoint: `01M6AQJ4VC0C1GJ6ZDFBFW1TE9`.
Captured session: `01a19518-9b5f-7691-a44b-d9df9331eb23`.

The exact commit and session association was verified with `entire checkpoint explain 032671c` and `entire checkpoint list` outside the sandbox. `entire doctor` confirmed installed/approved Codex hooks and no stuck sessions. Earlier sandbox `Access is denied` and network errors were access restrictions, not capture failures. The checkpoint destination has two-remotes review information; no settings were changed and nothing was pushed.

After user approval, the handoff still needs a push of the code revision and actual Entire capture branch and confirmation that the facilitator can access both. Do not substitute this README or a self-authored log for actual capture records. No GitHub publication or Classroom submission has been performed.

Build a reusable Agent Skill that runs a medical staff office's initial-appointment credentialing file from application intake to recorded appointment and active privileges.

## Start

1. Read the [full task](https://docs.google.com/document/d/1HhmU8Jay09XHDci38hl9ZOX_dMryaSv4aFLCPu1Nk-E/edit): it owns the scope, deliverables and acceptance requirements.
2. Create your own repository from [this starter](https://github.com/GitRollTraining/practitioner-credentialing) using **Use this template → Create a new repository**, then clone your copy and work there.

## Supplied files

| File | Purpose |
|---|---|
| `README.md` | Starting instructions and the full-task link. |
| `snapshot.schema.json` | The required shape of the per-batch snapshot your Skill writes. Validate every snapshot against it. Your implementation language and validation library are yours. |

The Skill, implementation, checks and retained outputs now accompany these original starting instructions. The original interview and supplied schema remain unchanged.

## Before you work

**Interview rule.** You conduct the stakeholder interview yourself, and the questions are yours. Do not connect a coding agent or any other AI to the interview to run, script, or automate it. The interview transcript is assessed together with the code; a project whose interview was run by an agent is not scored.

- Export your interview as the original Work Sim Markdown, save one final complete file per session under `interviews/`, and commit and push it with your code. Do not rewrite the export. If the export is unavailable, contact the facilitator.
- No runtime is supplied. Choose the dependencies your Skill needs and document how to install and run it.
- Complete the program's coding-session capture setup in the course before assessed work, and confirm your session is being captured after your first meaningful commit. Ask the facilitator to repair missing capture before you continue.
- Meet the stakeholder to obtain the relevant business source links and context; the facilitator supplies the interview link with the assignment. Read those online sources through the intended access route.
