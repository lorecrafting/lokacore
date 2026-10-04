# C1 next UI independent review

PR: [#148](https://github.com/lorecrafting/lokacore/pull/148)
Commit reviewed: `0e49963f893192d193fac65851aa882be0f597b8`
Base: `1f4e27ad0b6c33fda92250d85ae02490a26500b9`
Reviewer: fresh independent Codex primary; authored none of the change. Actual model identity unverified. Bounded owner-delegated substitute while Claude unavailable.

## Acceptance derived before diff

- Explicit projected authored descriptions precede actions on NPC/item/held/worn/contents details; missing optional fields and absent speakers remain honest. No fabricated players or inferred keys.
- NPC route, animation token and mounted scroll history remain stable. Offered controls follow the description initially and the latest chronological entry thereafter, inside scroll content.
- Distinct italic Journal updated appears only after confirmed accepted NPC commands actually change projected journal; no pending/refused/fault/unchanged/duplicate cue.
- One Leave uses matching offered close_choice and captured token; only confirmed accepted close returns World. Refused/fault/pending stay and retry keeps original context. Local Leave only without matching close. Generic choice_closed is silent, meaningful authored/quest consequences remain.
- World position directly cycles through offered legal standing/sitting/resting/sleeping actions with drawn freshness, skips unavailable, preserves admission and modal precedence, never flips World.
- Existing Take/Drop, Contents, room-log clearing, fixed title, scene/relaunch and queued chapter behavior remain. No mechanics/persistence/content/native-plugin/dependency/world-number additions.
- Opaque scroll surfaces and settled-transform removal are candidate readability repairs. Native before/after comparison with 665 remains required; source approval cannot claim native or owner Gate C1 acceptance.

## Source verdict: APPROVE

No open source findings at the reviewed head. This verdict covers the authored UI/presenter/tests and governing documentation, not a full re-audit of independently reviewed stacked parents #146/#147 or inherited #145 evidence. PM reports all six exact-head CI jobs completed SUCCESS and the author full normal pre-push passed; those are reported checks, not this reviewer's local full pipeline.

## Personally run evidence

- All Book source tests: 50 PASS. Targeted model/presenter/polish files: 30 PASS. Added independent controlled-input checks: 31 PASS including the existing targeted suite; explicit missing optional prose remains absent, unmatched speaker leaves locally without dispatching another choice, matching Leave preserves literal drawn token, description/history/event/control ordering is literal, and appended history calls the existing nonanimated scroll-to-end host callback. Native layout/scroll mounting/gesture behavior is not inferred from those host leaves.
- Own throwaway detached worktree at the exact SHA. Four individually planted realistic mutations all exited 1: omitted journal cue, offered Leave reduced to local navigation, missing NPC description, and lost offered position freshness. Both the independent suite and original targeted suite returned GREEN after restoration; Git status was clean. No mutation touched owner/main/author/PM worktrees.
- The first independent fixture incorrectly omitted its synthetic projected speaker and correctly got an absent-speaker message. The coherent fixture was corrected and confirmed GREEN before using it for red controls; retained logs label the fixture error, not a product finding.
- Reviewed every authored source diff hunk with TS/TSX outlines and syntax search, checked rejection/pending/fault/retry routing and literal expected results, and performed correctness plus Ponytail Review. No new dependencies, persistence surface, mechanics or world literals. Ponytail result: Lean already. Ship.
- Retained [redacted source controls](../evidence/2026-10-03-c1-next-ui-primary/source/SHA256SUMS) and [actual verify output](../evidence/2026-10-03-c1-next-ui-primary/source/SHA256SUMS.verify): 16 artifacts, verify exit 0. These are personal source evidence. No new source-text checker/test hook/framework was introduced.

## Findings

None.

## Native verdict: APPROVE WITH NOTES

The separate integrated native report records personally completed Release Simulator proof at this exact head and content pin, including the current owner supersession and still-current #144 routes. The sampled integrated walk remains valid. Subsequent owner-reported intermittent fuzz is deferred as UI-FUZZ-01 to the next UI checkpoint under the PM-adopted direction; it is not claimed fully fixed. This review does not pass the historically incomplete 665 walk, unmeasured owner-phone feel/response or the separate Gate C1 checklist. Main proof was hash-verified before preview freshening. External activity began during the final new-device preview handoff; all actions stopped and current progress was preserved. No fresh revision-zero READY claim is made. Actual current preview remains the correct reviewed clean Release and sampler pin. See the [current integrated native report](../evidence/2026-10-03-c1-next-ui-primary/native/native-primary-review-current.md) and [chronological owner-deferral addendum](../evidence/2026-10-03-c1-next-ui-primary/native/owner-deferral-addendum.md) for the personal/reported distinction and limits.

## Owner-reported follow-up and deferred polish

After the sampled native walk and review handoff, PM relayed the owner's exact messages, in chronological order:

> i did my manual checking, everything looks good. should we pass the C1 gate now and move on?

> wait when i played throgh, sometimes the rooms get fuzzy.

> lets just past the C1 gate and whatever polish items for the UI we can defer to the next gate or something

These are owner-reported observations and direction, not this reviewer's personal reproduction. The intermittent room fuzz recurrence is not personally reproduced here. The retained sampled walk remains valid: its fresh and post-Take bodies were clear compared with the retained blurred 665 baseline. That sampled improvement does not establish that intermittent fuzz is fully fixed.

PM adopts the owner's manual Simulator acceptance and direction to pass C1 with deferred UI polish. Native disposition is now **APPROVE WITH NOTES**: owner-deferred **UI-FUZZ-01**, intermittent room-body fuzz, carried to the next UI checkpoint. Source **APPROVE** remains unchanged; this is not a new unresolved source blocker. The PM owner-decision record and canonical carry pointer are pending the separate Gate C1 publication; no unresolved link is introduced here.

Owner-phone feel/response remain unmeasured UI proof carries. No explicit latency waiver is inferred. The whole Gate C1 PR/checklist is a separate PM closure step and is not passed by this review alone. No new GUI capture, reproduction, code change, build, test or device/save/reset operation was performed for this follow-up; current play progress remains protected.

## Governing scope and proof references

Acceptance was derived from [Book UI](../system/book-ui.md), the [latest detail-flow owner decision](../decisions/owner-decision-c1-journal-position-polish-2026-10-03.md) and the PM-adopted brief before reading the authored diff. The linked native evidence distinguishes actual personal GUI/save observations from reported [Release build provenance](../evidence/2026-10-03-c1-next-ui-primary/build/SHA256SUMS) and preserves the original 101/108 proof bytes and manifests. The new current native report and deferral addendum are separate appended artifacts. The [historical sampled native report](../evidence/2026-10-03-c1-next-ui-primary/native/native-primary-review.md) retains its original disposition, superseded chronologically by the current report/addendum; the [build evidence index](../evidence/2026-10-03-c1-next-ui-primary/build/README.md) describes the five retained provenance artifacts.

## Separate Codex Sol review (verbatim)

PM requested `gpt-6.1-sol`, high effort, in an independent read-only process; actual primary model identity remains unverified. [Sol metadata](../evidence/2026-10-03-c1-next-ui-primary/sol/c1-next-ui-sol-meta.json) records the requested model, process exit and answer digest; [retained answer](../evidence/2026-10-03-c1-next-ui-primary/sol/c1-next-ui-sol-answer.md) retains its provenance. The redacted process log remains retained privately under the metadata’s recorded digest; the full process transcript is not published. The following source-only review predates the personally completed native walk and later owner deferral above. Its original PENDING statements remain verbatim historical limits, not the current native disposition.

```text
APPROVE — source review only.
PR148
Head: 0e49963f893192d193fac65851aa882be0f597b8
Base: 1f4e27ad0b6c33fda92250d85ae02490a26500b9

Findings: None.

Personally verified:
- Governing documents and adopted brief before the diff; all PR148-authored hunks and relevant route/action/retry paths reviewed.
- 37 focused existing tests PASS.
- Controlled component probes PASS: legacy descriptions, absent speakers, matching/unmatched Leave, captured freshness, chronological italic journal events and shared item detail rendering.
- All 30 retained evidence files match their SHA manifest; changed production Book files match the reported proof head.

Reported/inspected:
- PM verified all six exact-head CI jobs SUCCESS.
- Author reports normal full pre-push PASS, 55 focused passes plus one existing optional device-save SKIP, and 16 RED mutants followed by restored GREEN. Logs inspected; mutations and full checks not personally repeated.

Limits:
Read-only; authored none. No installs, builds, native/device/save/lifecycle operations, subagents or simultaneous primary-review results read. Parent146/147 audits remain settled. Native composed proof, actual blur resolution and owner Gate C1 acceptance remain PENDING. Opaque scroll surfaces and settled-transform removal are UI candidates, not proven native fixes.

Ponytail Review: Lean already; no unnecessary machinery found.
```