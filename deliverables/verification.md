# Verification of the three credentialing runs

Reviewed on 2026-11-01. Business clocks remain 2026-03-16, 2026-04-20 and 2026-05-18. These are teaching records for fictional practitioners, not production medical decisions.

## Automated checks actually run

`npm.cmd test` passes 33 behavioral tests after the source-identity corrections. They exercise date/gap arithmetic, supplied-case transitions, admissibility/activation, source rejection, reference boundaries, roster delegation, partial application errors, state resume, tampered state, missing batches, schema failure, the six earlier review regressions and the ten source-table tests described below. No test edits a supplied input file; runtime test outputs and copied fixture inputs are isolated under a temporary repository directory and cleaned afterward.

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

## Corrections following read-only final review

The reviewed baseline is commit `64e77b9481f0a599d0de385591ec294d7361966c`. All five reproduced correctness issues and the transaction-consistency issue were addressed. Regression fixtures change only in-memory evidence or temporary copies, never the original exports, interview or schema.

| Reproduced issue | Correction and office authority | Regression evidence |
|---|---|---|
| Negative CD disposition released hold | Recognize only explicit affirmative permission in the latest authorized disposition. Negative, conflicting and unknown language retains the hold for clarification. Procedure sections 6, 8 and 11 reserve the judgment to CD. | Negative and ambiguous dispositions tested for gap and high-risk/licensure files; a later negative overrides an earlier affirmative. Explicit supplied permission still releases the hold. |
| Additional WA licence unverified | Each WA declaration now matches its own credential number and board lookup. Missing one holds readiness even when another practice licence is current. Procedure section 3/check 1 requires every active/inactive licence verified. | An unverified second WA licence holds the file; direct evidence of that inactive licence resolves it while the active licence continues to meet practice-state requirements. |
| New negative reply ignored | Separate admissible sender from confirming outcome; use the latest usable source reply. Section 11 requires re-entry on new evidence, while section 8 requires no outstanding work. | Later no-record replies reopen employment and education individually, retain original confirmation history and leave unrelated elements alone; subsequent confirmation resolves the affected element. |
| Cycle end / expired licence still active | Enforce inclusive cycle end and current practice-licence dates. Retain admitted approval rather than invent denial/discontinuation. Procedure section 3/check 1, sections 10 and 11 govern the cycle, Washington bylaw and expiry re-entry. | Last cycle day and licence expiry day are valid; the following day is inactive. Expired licence reopens verification and queues CD review. Out-of-cycle scope is partial with explicit reappointment ownership, not an inferred renewal. |
| Explicitly unrelated peer rejected | Remove explicit narrative denials before checking a No checkbox for contradictions; ambiguous/contradictory relationship text is not counted pending clarification. Procedure section 3/check 4 and reference form part 2 require all three eligibility conditions. | Negative coordinated lists count; positive family/partner statements alongside No require clarification; a Yes checkbox cannot be overridden by a negative narrative. |
| Late output failure left inconsistent files | Durable undo journal covers archives/current outputs/result/run log. Failure rolls back old bytes before recording blocked result; readers refuse an interrupted publication until recovery. Assignment failure-state and immutable-occurrence requirements govern this implementation mechanism. | Injected EIO after state, snapshot, result and log replacement restores prior snapshot/state/audit exactly and removes unpublished archives. First-ever failure creates no computed artifacts. A child process exits after replacing the result; next run restores old bytes before archiving, logs the interrupted attempt as blocked, then publishes a consistent successful occurrence. |

The office procedure explicitly excludes reappointment, and the original schema has no expired-cycle status. Consequently that out-of-scope application retains its historical approval/privilege list with active_at_export false, is reported partial at run level, and uses in-verification only as a disclosed unresolved-processing placeholder. This encoding limitation and the MSP's reappointment task are explicit in the queue and README; no business rule or schema enumeration was added.

All three current sealed occurrences are regenerated in order because the implementation and applied-rule register changed. The run log records the exact command, old snapshot ID, correction reason and archive paths for each replacement. The baseline snapshot/state/audit/result bytes are retained under each old snapshot ID and compared directly against Git's baseline blobs during verification. Current source exports and all previously refused decisions remain unchanged. The latest supplied-batch business statuses are compared with the baseline rather than assumed from test success.

| Baseline batch | Sealed snapshot ID | SHA-256 of preserved original bytes |
|---|---|---|
| 1 | 7034510b-2f8f-46c1-9d94-6a05527fb441 | 41c7add1d02830c638aff1b3d67610b8945554d02c96189561916ae9b5a6b96e |
| 2 | f9cc8217-31f9-4cfe-8ff7-7ff3b24b9769 | d74478cbd2cba15bb7595a780e709e69833d0462fe5cb5e02041acc6a7755915 |
| 3 | e9c5f664-84fe-4e75-9638-57ba9d193c0f | ca3a901eae6a20410c3f153b49d2a6597a8487f3c4ac66d3b0f74248599ea7ad |

The occurrence IDs sealed by commit 460f494 were batch 1 `4d2d2069-26a5-444f-b51c-940e9b6356ea`, batch 2 `253d3866-3a5d-4b9c-ba49-088fb000ca58`, and batch 3 `0d12eb9b-ce25-4312-a7f7-d4279298df52`. Those runs were supported. Direct comparison against baseline 64e77b9 confirmed unchanged status, element states, decision admissions/refusals, approval IDs, activation, readiness and monitored conditions for all 40 files in each supplied batch; audit detail and relevant action wording were improved. These occurrences are retained as superseded artifacts by the subsequent source-identity correction below.

The independent Git-blob preservation check initially encountered Node's default child-process output-buffer limit on the batch-3 state blob. Repeating the read-only comparison with a 16 MiB maxBuffer passed for all twelve baseline artifacts. This was a diagnostic buffer limit, not a Skill run failure or capture failure. The exact-byte comparisons used git show against baseline commit 64e77b9481f0a599d0de385591ec294d7361966c and Buffer equality, independently of the Skill's archiving code.

The transaction journal protects process interruption and normal write errors. It is not a claim of atomic visibility to arbitrary programs that ignore the journal, nor a hardware power-loss guarantee. The Skill's predecessor reader and verifier check for the journal; simultaneous writers are unsupported and live-owner recovery is refused.

## Closed-source review corrections after commit 460f494

The baseline for this correction is `460f494ffb5769673452c5500c19c30088c984b5`. Its actual checkpoint is `01M6AT7R1EDAYXB82HJG1P67XW`, associated with session `01a19518-9b5f-7691-a44b-d9df9331eb23`. The prior review reproduced an unrelated secondary hospital being accepted and an unrelated credential agency being accepted under a generic certifying-board label. Both are corrected by binding provenance identities, not by adding source categories or clinical rules.

The source module and its identity register were reviewed against every row of LARK-ATT-2026.1. Ten tests in tests/sources.test.mjs cover both blockers and analogous gaps found during that review:

1. The supplied secondary degree letter from Greyfen Regional Hospital remains accepted: it is the applicant's most recent affiliation's MSO; its letter identifies the closed school, explains why primary/equivalent sources are unavailable and states how it verified the degree itself. Recorded FCVS no-record evidence is retained; a contradictory equivalent confirmation would prevent the impossibility route.
2. A hospital absent from history and an older actual affiliation both fail; education stays outstanding, evidence is retained, and MSP review is queued. Tied current affiliations also require clarification rather than an invented tie-breaker.
3. Missing or negated closure, missing/contradictory equivalent-source unavailability, a missing verification account, a recruiter substituted for the original source, applicant carriage and an HR office substituted for the required education-secondary MSO all fail.
4. Certification issuer name, board code, application/declaration and actual sender must agree. The same-code unrelated agency fails and cannot establish privilege support. Direct issuing-board evidence remains accepted.
5. All seven certification equivalents named in the table are accepted by exact service identity, including full names. Unknown acronym extensions, unrelated organizations following an acronym and services permitted only for other elements fail.
6. School registrar/dean and postgraduate GME/programme-director branches bind both sender identities to the correct institution and entry kind. Cross-kind offices, unrelated schools and certificate copies fail.
7. All five education equivalent services work with consistent sender identities, including documented aliases. Unknown services, inconsistent organizations and certification-only equivalents fail.
8. Employer MSO/HR/authorized-administrator sources remain accepted. Personal supervisors fail. A separately named retained CVO works, but employer-name mentions, negated retention, the wrong employer and inconsistent CVO identity do not.
9. Secondary employment requires named dissolution, no successor, the recent surviving affiliation and its own verification account. Missing/negated prerequisites and unrelated donors fail.
10. Licence provenance permits the issuing board and FSMB Physician Data Center; unrelated boards, directories, applicant/employer copies, secondary MSOs, unknown acronym suffixes and jurisdiction/number mismatches fail.

This is a closed-source classification and consistency check on the fictional office's records, not a live authentication service for real-world senders. Free-text provenance outside the supported explicit statements is held for human clarification. There is no invented fixed verification window, attempt threshold, clinical judgment or additional accepted organization.

All twelve baseline snapshot/state/audit/result files from commit 460f494 are preserved byte for byte under deliverables/superseded/<baseline-snapshot-id>/. Earlier retained archives are unchanged. The corrected snapshots form a newly generated 1-to-2-to-3 predecessor chain; the run log identifies each old ID, command, reason and retained archive paths. Each supplied export still computes 40 applications with supported run results. Comparing all three new snapshots against 460f494 confirms unchanged business status, element states, readiness, decision history, approval IDs, activated privileges and monitored conditions; the audit now explains source admissions/refusals and MSP queues make inadmissible-source reasons explicit.

Final source-correction occurrence IDs are batch 1 `3c24570c-0fd4-44eb-b791-5c1e0a8112da`, batch 2 `3fe76069-7c71-4dbb-a35a-ef244f39ec8d`, and batch 3 `6d600797-5de1-4ddf-888b-2fc120d18b21`. Their SHA-256 values are respectively `4c1a232fc388828a81db2d9d8917d9d445ab7d720d3229b0de738d01a9be195f`, `7bfa9f316c22f93e1cef4c8516871560f02e9c7bccf5f4ae039539e5a0a8725a`, and `690b37baf24db079aea179671077c1e48f87b3116ee4811accc584d6f58e6205`. Predecessors match the first two hashes exactly. Intermediate working occurrences were also conservatively archived and their replacement reasons logged before this correction was sealed.

## Capture and preserved originals

First meaningful implementation commit 032671cb9c05259054bba039ebd84931dee6c51a is associated with actual Entire checkpoint 01M6AQJ4VC0C1GJ6ZDFBFW1TE9 and session 01a19518-9b5f-7691-a44b-d9df9331eb23. Verified outside the sandbox; installed/approved hooks and no stuck sessions. Earlier sandbox access/network errors did not establish capture failure.

`git diff --exit-code HEAD -- interviews/INTERVIEW.md snapshot.schema.json` succeeds. Workspace SHA-256 values checked during implementation: interview `b22e7b6e030d0b7b01f66e0c9bc9308529482590e6d82a3419f45a7600600465`; schema `85404b5bdd34a3eca00589c88e7d46a6d5748e5ec533ff7b7075bac6eb2be41d`. Git publication, capture-branch publication and facilitator-access confirmation remain pending explicit user approval.
