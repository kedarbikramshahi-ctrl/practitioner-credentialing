# Project E replacement implementation plan

Authorized by the user on 2026-11-01; replaces the unavailable earlier plan.

1. Read and retain all three closed exports and the seven standing business documents via connected Google Drive. Record provenance and verify file/row counts against each batch README. Preserve interviews/INTERVIEW.md and snapshot.schema.json byte for byte.
2. Implement a Node.js command-line batch processor with cumulative evidence state, immutable input hashes, first-receipt anchors, application revision reconciliation, and date arithmetic against the export clock. Keep all received evidence and refused decisions.
3. Make the first meaningful implementation commit with ingestion, date/gap computation and behavioral tests. Immediately verify a local Entire checkpoint for that exact commit and session 01a19518-9b5f-7691-a44b-d9df9331eb23. Diagnose sandbox access warnings outside the sandbox; stop on actual capture failure. Never push without user approval.
4. Implement the six elements using LARK-MSO, the closed attester table, privilege criteria, forms and authority roster. Separate evidence verification from reserved clinical judgments; produce explicit human-owned queues and do not send correspondence.
5. Admit decisions in receipt order against the authorized body/signatory, revision and packet before decision date, outcome/reason, criteria version and supersession. Record activation only from admitted Governing Body approvals; monitor conditions and expirables.
6. Validate each snapshot with the original draft-2020-12 schema. Retain resumable evidence state beside each snapshot and bind predecessors by path and SHA-256. Make failures explicit, protect sealed occurrences, and retain superseded bytes on changed reruns.
7. Run batch 1, resume batch 2 from batch 1, and resume batch 3 from batch 2. Test adverse and boundary behavior, failure handling, replay, decision history and source/revision changes. Independently recompute a quantity and inspect outputs against the office evidence.
8. Complete root SKILL.md, setup/resume README, rules register, run log, verification report, three snapshots and state files. Commit validated deliverables locally, verify capture again, and provide handoff with remaining human work. Do not push.

## Choices and reasons

- Use Node.js (available here), csv-parse for RFC-style CSV and Ajv 2020 for the supplied schema. Avoid a custom schema validator.
- Preserve raw batch evidence separately from computed snapshots, so a later batch can be processed without re-reading or changing earlier export folders.
- Evaluate historical packet readiness using evidence received before each decision, while evaluating current states at export date. This prevents later evidence from retroactively authorizing an earlier decision.
- Put policy tables in data files derived from the standing documents; no application identifiers or case-specific outputs in the engine.
- Human judgments are recorded evidence or queue items, never inferred approvals or clinical conclusions.
