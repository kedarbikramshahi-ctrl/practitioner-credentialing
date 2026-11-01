# Verification of the three credentialing runs

Reviewed on 2026-11-01. Business clocks remain 2026-03-16, 2026-04-20 and 2026-05-18. These are teaching records for fictional practitioners, not production medical decisions.

## Automated checks actually run

`npm.cmd test` passes 14 behavioral tests. They exercise date/gap arithmetic, supplied-case transitions, admissibility/activation, source rejection, reference boundaries, roster delegation, partial application errors, state resume, tampered state, missing batches and schema failure. No test edits a supplied input file; runtime test outputs are isolated under a temporary repository directory and cleaned afterward.

`npm.cmd run verify` validates all snapshots with the unchanged draft-2020-12 schema and date formats, checks predecessor path/hash and state integrity, verifies every closed input hash, confirms output existence, verifies 40 distinct application files per snapshot, and compares every prior decision object to its later retained occurrence. Batch 3 was invoked with `--previous deliverables/state/batch-02.json` and reads the cumulative evidence it contains.

Counts checked from each batch README: 41/4/1 application revisions; 435/40/40 WA board rows; 15/41/26 correspondence documents; 13 record files per batch. All 124 input files are retained, including 82 opened correspondence documents. Forty application IDs span 46 revisions. All earlier records remain available in cumulative state.

## Independent recomputations

These checks used PowerShell, not the Skill's JavaScript, imports or date functions:

```powershell
$population = Import-Csv inputs/batch-01/licence-lookup-wa.csv
$population | Group-Object actiontaken | Select-Object Name, Count
([datetime]'2019-11-05' - [datetime]'2019-04-01').Days + 1
([datetime]'2026-02-09').AddDays(64).ToString('yyyy-MM-dd')
```

Results: No = 431, Yes = 3, Pending = 1, total 435. Yes is 3/435 = 0.689655%, Pending is 1/435 = 0.229885%, consistent with the export note. An action indicator is not automatically a disqualification. The APP-2026-017 gap is 219 inclusive days, matching its disposition and exceeding the office's 180-day routing threshold. REF-2301's first request plus 64 days is 2026-04-14, matching the overdue correspondence. These arithmetic checks are independent of the engine.

## Evidence-to-result checks

| Files/case scope | Evidence and governing rule | Finding in outputs |
|---|---|---|
| APP-2026-001/003 | GBD-2026-011/013; procedure §10 | 001 not active at batch 2, active May 1; cycle ends 2027-04-30. Blank effective date for 003 defaults to April 14. |
| APP-2026-002/008/036 | GB effective dates June 1 / June 15 / June 1 | Remain approved-not-yet-effective on May 18; no premature privileges. |
| APP-2026-014 | MEC-2026-024 and GBD-2026-024; reference replies; §9 condition 4 | Both refused because a packet was not ready at those dates. Later current readiness does not retroactively admit them. |
| APP-2026-015 | Board action summary, applicant confirmation, May 6 CD disposition; §§3/4/8 | Restricted licence remains `finding`; readiness withheld until confirmation/disposition, then packet presentable, no invented approval. |
| APP-2026-017/018 | Gap explanations/disposition and 30-day return letter; §§1/3 | Long-gap hold resolved by recorded CD disposition; 018 returned incomplete then revision 2 restores readiness. |
| APP-2026-019 | Missing release/CV, February 18 request; §1 | March 20 deadline; intake-incomplete in batch 1 and ineligible-clock-expired later. No automatic discontinuation or generated verification requests. |
| APP-2026-020/021/022 | Applicant-carried diploma; documented closure/FCVS no-record plus surviving affiliation; medical-society reply | 020 stays outstanding until direct registrar reply in batch 3; 021 secondary verification accepted with impossibility retained; 022 stays outstanding because society is outside the closed source list. |
| APP-2026-023/024/025 | Attempts, reference relationship/discipline, signature dates and substitutions; §3 check 4 | Non-response not passed; ineligible references excluded; substitutions permit 023/024 readiness. 025 reopens when May 5, 2024 signature is stale at May 18. Original referees carry forward across revision 2. |
| APP-2026-026/027/029 | Published map, board replies and CD disposition; privilege rules 1–6 | 026 unsupported CARD subset stays finding; only IM/HOSP approved and activated. 027 eligibility question resolves on amended supported FM request, no automatic discontinuation. 029 discontinued only from authorized recorded CD decision. |
| APP-2026-028/035 | Actual withdrawal and GB denial | Distinct terminal withdrawal and denied statuses; withdrawal preserves factual packet readiness, neither activates. |
| APP-2026-030/036 | Revised history and new replies; §§2/11 | Date discrepancy and newly added employment reopen 030. Organization/contact change reopens 036 even outside the five-year floor and despite unchanged dates. Current verification resolves them in batch 3. |
| APP-2026-032 | PPQ-2 Yes, written explanation and CD disposition; §4 | High-risk hold ends on recorded disposition. PPQ-1 No is not mistakenly treated as a contradiction merely because PPQ-2 is Yes. |
| APP-2026-033 | Unanswered employment verification and attempts | Remains outstanding; three attempts/red flag retained; silence never treated as resolved. |
| APP-2026-034 | GBD-2026-032 deferral and external referee | Continues deferred awaiting a new GB decision; additional evidence alone is not an approval. |
| APP-2026-036/037/038 | Revision 1 GB decision; duplicate approval without supersedes; MEC “approved” | First failures retained: 036 wrong revision (condition 3); 037 duplicate leaves original approval/privileges standing; 038 wrong body (condition 1) then actual GB approval activates. |
| APP-2026-039/013 | Explicit approval conditions and licence expiry inside cycle | Active-with-conditions. Conditions have separate due dates; no unrecorded satisfaction inferred. |

## Corrections made before sealing

Initial exploratory computation exposed uppercase `ACTIVE` in WA rows and `applicant_comment` as the PPQ explanation column. Corrected both parsers. Adjusted board-eligibility handling to read the explicit good-standing/end-date confirmation in board notes, and retained previous referees when later revisions add rather than replace them. Reconciliation now reopens an older entry whose employer/contact changes even outside the ordinary five-year window. Corrected PPQ-1 contradiction detection to require board evidence, rather than any unrelated Yes. Tests cover these corrected behaviors.

The interrupted input import was completed and its resumed documents rewritten with Unicode escape-safe transfer to preserve UTF-8 punctuation. The row/document count checks and cumulative hashes pass. No original interview or schema edits were made.

## Final caseload at batch 3

19 active; 2 active-with-conditions; 3 approved-not-yet-effective; 7 packet-presentable; 3 in-verification; one each decision-inadmissible, ineligible-clock-expired, withdrawn, discontinued, deferred and denied. Total 40. Final counts were independently grouped in PowerShell from the output JSON.

Supported is a run state, not a statement that all practitioners are approved. Human actions remain in each file's queue. Application signatures, CV reconciliation content and referee working addresses are not in the export and must be checked in the office file; this limitation is visible in audit/queues. Structured-header parsing covers the supplied forms and explicit recorded dispositions; new formats require review and tests. No clinical judgment was inferred, no correspondence was sent, and no push was performed.

## Capture and preserved originals

First meaningful implementation commit 032671cb9c05259054bba039ebd84931dee6c51a is associated with actual Entire checkpoint 01M6AQJ4VC0C1GJ6ZDFBFW1TE9 and session 01a19518-9b5f-7691-a44b-d9df9331eb23. Verified outside the sandbox; installed/approved hooks and no stuck sessions. Earlier sandbox access/network errors did not establish capture failure.

`git diff --exit-code HEAD -- interviews/INTERVIEW.md snapshot.schema.json` succeeds. Workspace SHA-256 values checked during implementation: interview `b22e7b6e030d0b7b01f66e0c9bc9308529482590e6d82a3419f45a7600600465`; schema `85404b5bdd34a3eca00589c88e7d46a6d5748e5ec533ff7b7075bac6eb2be41d`. Git publication, capture-branch publication and facilitator-access confirmation remain pending explicit user approval.
