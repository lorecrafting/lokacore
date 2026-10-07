# Chapter 1 one-time documentation audit — 2026-10-06

Independent read-only audit of published A–D baseline
`e9f6979905e48cc9b6062b424576d13955c9d607`, preserved on publication base
`37a2af0c3f59465f36c0ec3a1d560c5fc3845741`. Repository line references below name
the audited baseline; shared-memory references name the handoff inspected during
that audit. The [owner audit decision](../decisions/owner-decision-chapter-one-docs-audit-2026-10-05.md)
governs this one-time work. This record preserves the completed audit, not a new
audit of the publication base, approval of repairs, or E1–E3 certification.

Scope: AGENTS/CLAUDE entry points; shared MEMORY → STATE → CONTINUATION; active
system/protocol guidance; owner/PM decisions; Chapter 1 briefs, roadmap, plan and
Beads; checks/workflow versus CI; Builder guidance, lessons, world parameters;
current cartridge schemas/fixtures; review/evidence navigation; E1–E3 obligations.
The separate [architecture audit](2026-10-06-post-d10-architecture-audit.md)
remains its own record. No runtime, owner save or native session was changed.

## Ranked findings

All six findings below are **open at this record's preparation**. Focused repair
branches are in progress, not published; a branch or proposed disposition does
not close a finding. PM records reviewed publication before E3 closure.

### DOC-E3-01 — P1: private path retained in hashed evidence

`docs/evidence/2026-10-04-m1-b1-driver/replay-run-new.log:22` and `:33` retain a
private macOS temporary path inside escaped assertion output. Nearby stack paths
were sanitized, but the nested message was missed. `SHA256SUMS` covers this log.
The private value is deliberately not copied here. Synthetic identifiers in
older red-control scripts were identified as test inputs and excluded.

**Disposition / owner / trigger:** the PM's evidence repair is in progress. Sanitize
those strings without changing the failed assertion's meaning, update the affected
hash manifest, and append an explicit sanitation note. Preserve the historical
failure and its provenance. The evidence developer supplies a controlled nested
message redaction check; a fresh reviewer verifies the repair before publication
and E3 closure. Do not silently rewrite historical results.

### DOC-E3-02 — P1: save-change scope is described inconsistently

`docs/decisions/owner-decision-preproduction-ci-scope-2026-10-06.md:7` says save
changes remain in the broad code lane; `:6` exempts changes confined to `mobile/`.
`bin/ci_scope.sh:11` implements that broad mobile exemption, which includes the
local Story authority. `docs/evidence/2026-10-06-ci-scope-audit.md:7–11` and
`.githooks/pre-push:2` instead describe the exemption as Book-only.

Controlled reproduction used the published selector in a throwaway Git repository
with two ancestor commits differing only in
`mobile/authority/local-story/store.ts`. Results were `code: skip` and
`browser: run`. This proves classifier behavior, not execution of a save test.

**Disposition / owner / trigger:** PM reconciles the intended scope before asserting
that save-only changes receive the broad lane. Name the actual authority exemption
and required focused save proof, or honor an explicitly selected save carve-out
with a failing classifier control and independent review. Preserve the current
owner-approved gates until that disposition is reviewed. The separate post-E3
portable-authority lane remains [ARCH-D10-04](2026-10-06-post-d10-architecture-audit.md#arch-d10-04--visible-host-neutral-authority-gate-third);
this finding does not authorize its early implementation or repeat that audit.

### DOC-E3-03 — P2: shared handoff repeats superseded live instructions

`MEMORY.md:2–3` describes overwritten current state and a thin continuation.
`STATE.md:4,10,12` and `CONTINUATION.md:4,10,12` still identify main as `1424b6cd`
and instruct publication of work already present at the audited baseline.
`STATE.md:15` onward and `CONTINUATION.md:15` onward retain older current-state
checkpoints, including 24/33, 23/33 and earlier source states. The two files
contained approximately 13,188 words combined. Their private locations are omitted.
A fresh agent can repeat publication work or resume an obsolete branch.

**Disposition / owner / trigger:** PM writes one verified current checkpoint and
short operational continuation before the next context handoff, preserving exact
unpublished E1 heads, open findings and next actions. Move superseded checkpoints
to the existing memory archive and repair the entry links. Archive history rather
than deleting it; neither a newer checkpoint nor this audit completes E1–E3.

### DOC-E3-04 — P2: authoring map omits installed forms

`docs/system/cartridge.md:16–20` omits `map_positions.json`, `skills/`, `topics/`,
`liquids/`, `populations/`, `population_bundles/`, `services/`, `transports/` and
`bleeds/`, then says other JSON files are `UNKNOWN_FIELD`. These forms are accepted
by `lib/loka/content/source.ex:104,119–126` and used by the current chapter.
`docs/BUILDERS-GUIDE.md:65` says every NPC file creates one NPC at fresh-world birth;
`kernel/ts/src/runtime/fresh.ts:119–121` excludes `spawn_template`, as used by the
current chapter's `npcs/fen_hound.json`. A builder following the summaries can
reject valid source or expect an extra static NPC from a population template.

**Disposition / owner / trigger:** a docs developer completes the source map and
qualifies ordinary placement versus population templates, linking existing
normative clauses. No schema, fixture or runtime change is needed. Independently
review and publish before E3 documentation closure.

### DOC-E3-05 — P2: active summaries lag installed behavior

- `docs/system/architecture.md:20` calls `mobile/packages/*` empty `export {}`
  stubs, although `mobile/packages/game-view/session.ts:49` defines the working
  `Game` boundary.
- `docs/system/protocol.md:29` says 38 capabilities; the current registry has 45.
- `docs/system/future.md:64` lists `real_elapsed` as future production work,
  although the current chapter declares and uses it.
- `docs/system/save.md:823` calls published D2 knowledge/Read recovery Planned.

These active statements can lead a new assignment to recreate installed behavior.
**Disposition / owner / trigger:** a docs developer corrects the summaries from
existing contracts and published proofs before E3. Remove the duplicated capability
count rather than creating another maintained count. Keep dated decisions/reviews
unchanged and preserve genuine remaining production/native obligations.

### DOC-E3-06 — P3: entry indexes omit current material

`docs/briefs/README.md:1–10` exposes six older M briefs but omits the Chapter 1
index, although `docs/ROADMAP.md:11–12` routes assignment readers there.
`protocol/README.md:11–46` omits the installed `liquid.schema.json`,
`transport.schema.json` and `water.schema.json` from its schema map.

**Disposition / owner / trigger:** the authoring/navigation docs developer links
Chapter 1 first, labels retained M briefs as dated assignments, and adds the three
schema entries with existing contract links. Publish the reviewed correction
before E3; no new index framework is needed.

## Historical records, pending proof and verification limits

- Roadmap and Beads agreed: 30 closed, E1 in progress, E2/E3 open. Independent
  SHA-256 of v042's canonical oracle bytes matched its recorded hash; its artifact
  contains 57 rooms and ten quests, and its allocation oracle contains 211 IDs.
  The [current chapter identity](../system/cartridge.md#current-bundled-chapter)
  remains the owning release reference.
- E1's applicability-matrix omissions, remaining fixture migration, final selected
  candidate simulation and obligation coverage are existing explicit carries.
  E3's human walkthrough, browser recovery gaps and deferred native/blur obligations
  remain open. This audit neither closes nor duplicates those work units.
- E1/E3 briefs label their older inspected baselines and require re-pinning; old
  pins alone are not false certification claims. The world-parameter table labels
  its original inventory as dated, with remaining proof routed through E1.
- Older cartridge fixtures remain inputs to transcript discovery and the simulator
  corpus. The [published B9/D4 orphan disposition](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/decisions/pm-decision-orphan-fixtures-2026-10-06.md)
  records its consumer assessment and recovery source. No additional fixture was
  established as safe to delete. Preserve frozen conformance and current regression
  proof; do not infer deletion safety from a missing literal filename reference.
- Checked active entry/system/guide/workflow heading links resolved. Decision records
  were indexed; the D10 self-review is reachable through its PM decision despite
  not appearing directly in the review index. No new broken-link finding was made.
- Owner-save bytes, exact mismatch refusal, the native pause, headless simulation
  and deferred UI blur remain explicit. No browser or device result was produced
  by this audit. Existing evidence proves only its recorded source and host.

## Focused fix units and record self-review

Use separate evidence sanitation, shared handoff cleanup and check-scope
reconciliation units; group compatible authoring/navigation and active-summary
corrections as narrowly as practical. Each repository unit receives normal checks
and a fresh independent review. A repair record must identify its published source
before PM closes the corresponding finding. Do not rewrite decision/review history,
re-pin conformance or repeat the architecture audit to tidy these documents.

Ponytail self-review: one audit record and one roadmap link reuse existing formats;
no new tooling, policy authority, competing release pin or recurring gate.
Correctness self-review retains the exact audit/publication distinction, controlled
classifier result, private-value omission, open repair status and proof exclusions.
This author self-review is not the independent review of this record or its repairs.

Record validation: `mise exec -- elixir bin/check_docs.exs` exited 0
(785 documents, zero broken links, zero unreachable); staged `git diff --check`
exited 0. No runtime change or new regression test is part of this record.
