---
name: practitioner-credentialing
description: Process Larkhollow initial-appointment credentialing exports one batch at a time, retaining evidence, revision-bound readiness, decision admission, activation and human action queues. Use for this office's versioned export format and policies.
---

Read [README.md](README.md) for setup and exact commands. Read [the applied rules](deliverables/rules.md), [the export dictionary](references/export-note.md), and [the procedure](references/procedure.md) before interpreting results. The closed source table, privilege map, authority roster and forms are retained in references; their source URLs are recorded in the README/manifest.

Run `node scripts/credential.mjs --batch <folder> --number <N>`, adding `--previous <previous-state.json>` for every batch after the first. The batch must contain README.md, all thirteen CSVs and every indexed correspondence document. The README's export date is the clock. Header-only CSVs are valid; missing files are failures.

The state file retains earlier evidence, revisions, attempts, documents and first receipt anchors. A later run consumes that state and validates its associated snapshot hash before adding a closed export. Do not start batch 3 from scratch or reconstruct state from the latest CSVs alone.

Inspect the resulting snapshot and per-application audit. The snapshot conforms to the unmodified schema and contains statuses, all decisions including refusals, exact approved privileges, conditions and human-owned action queues. The audit exposes source choices, declared/verified dates, gaps and reference exclusions. Outstanding evidence is a valid business result, not permission to infer a pass.

Five judgments stay human: satisfactory gap explanations, disqualifying findings, discontinuation on eligibility, committee recommendations and privilege selection, and GB outcomes. Present the evidence to the authority named in the roster; record the actual returning document. A document's assertion of authority does not establish authority. Do not send any correspondence or create clinical decisions from a queue item.

On failure, inspect the current attempt's result JSON and run log. A blocked attempt produces no new snapshot; do not present an older result as the current attempt. Partial means evidence was consumed but scope could not be computed; name that scope and owner. Route unfamiliar document language for MSP review and extend the parser/tests before relying on it. Never silently coerce unknown values.

Changed re-runs retain old occurrences under superseded/ and generate new IDs. Regenerate the affected batch and all successors, in order, before committing a corrected chain. Identical re-runs retain the existing snapshot bytes. A Git commit seals an occurrence. Validate with `npm test` and `npm run verify` before handoff. Preserve the original interview and schema. Never push or transmit capture records without the user's approval.
