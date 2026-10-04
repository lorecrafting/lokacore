# Gate C1 checklist

Current status and gate PR: [ROADMAP](ROADMAP.md#c1-slices).
The owner directs C1 closure with UI work deferred
under the [acceptance record](decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md).
This page is the short checklist required by [WORKFLOW](WORKFLOW.md#milestone-gate),
not a reviewer verdict or a declaration that the gate has already merged. Continued
mechanics delivery follows the [owner's autonomous-work delegation](decisions/owner-decision-autonomous-mechanics-2026-10-03.md);
this gate PR installs no additional mechanic.

## Feature and spec proofs

All twelve feature slices are merged; their [ROADMAP rows](ROADMAP.md#c1-slices)
link the PRs. Each independent review below records its actual audited head,
behavioral checks, literal answers, red controls and evidence where applicable.
Archived citations retain the governing section names used in the approved plan.

| Slice / PR | Governing proof | Independent record |
|---|---|---|
| Host #129 | Durable seed/context, truthful kernel identity; 10 §§31–32, ADR-075; P6 | [host](reviews/2026-10-03-c1-host-review.md) |
| Numbers #131 | Movement costs, condition bands; 00 §4, 04 §15; W1/W2/W13 | [numbers](reviews/2026-10-03-c1-numbers-review.md) |
| Attributes #133 | Six stats and resource/stat policies; 00 §4.3, 06 §21 | [attributes](reviews/2026-10-03-c1-attributes-review.md) |
| Doors #132 | Adjacent sight, reciprocal doors, exact offered unlock; 00 §4.1, 21 §5 | [doors](reviews/2026-10-03-c1-doors-review.md) |
| Equipment #134 | Conserved transfers, appended slot IDs; 00 §4.4, 21 §8, numeric profile | [equipment](reviews/2026-10-03-c1-equipment-review.md) |
| Locks #135 | Reachable keys and container custody; 00 §4.4, 03 §23 | [locks](reviews/2026-10-03-c1-locks-review.md) |
| Position #137 | Guarded reserved fact and legal positions; 00 §4.3, 21 §28 | [position](reviews/2026-10-03-c1-position-review.md) |
| Journal #138 | Selected authored quest objective/state text; 06 §§2/41, 04 §15 | [journal](reviews/2026-10-03-c1-journal-review.md) |
| Chapters #139 | Content chapter-marker projection and reached outcome; new [chapter section](system/mechanics.md#chapters-kerneltssrcviewviewts), 00a §9 | [chapters](reviews/2026-10-03-c1-chapters-review.md) |
| Modal scenes #140 | Persisted line, admission and start once; 06 §§35/37, 15 SCENE-01/SCENE-03/QUESTSCENE-01 | [scenes](reviews/2026-10-03-c1-scenes-modal-review.md) |
| Sampler #142 | Approved six-room scope, literal artifact/oracle, durable quest/scene/ending | [sampler](reviews/2026-10-03-c1-sampler-review.md), [Look replacement #145](reviews/2026-10-03-c1-sampler-look-review.md) |
| Touch #141 | Doors, items/equipment, position, journal, bands, chapter and scene by touch; 04 §15, slice 12 | [touch](reviews/2026-10-03-c1-touch-review.md), [actual Release walk/relaunch](evidence/c1-touch/README.md); P3 |

Current supporting iterations (not additional C1 feature slices):
[room/details #143](reviews/2026-10-03-c1-playtest-polish-review.md),
[dialogue/Contents #144](reviews/2026-10-03-c1-dialogue-contents-polish-review.md),
[kernel layout #146](reviews/2026-10-03-kernel-layout-review.md),
[descriptions #147](reviews/2026-10-03-c1-description-projection-review.md),
[next UI #148](reviews/2026-10-03-c1-next-ui-review.md).
The final composed #148 native walk identifies actual source `0e49963f893192d193fac65851aa882be0f597b8`
and sampler `813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa`;
older captures remain historical proof, not a claim that every older UI build was replayed.

## Riskiest-code audit and later coverage

The [Astra stage audit](reviews/2026-10-03-c1-gate-astra-audit.md) actually audited
`b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4`, with no findings. Its recorded sampler/touch
carry-forward inspected the later App binding. It is not an Astra audit of #148's head.
Later coverage: #146's independent primary/Astra import-normalized body comparison and
Sol doc-fix recheck; #147's primary/Sol optional description projection checks; #144/#148's
primary/Sol presentation checks and current composed native interaction/relaunch proof.
The PM completed the [actual Git-blob carry comparison](evidence/2026-10-03-c1-gate-audit-carry-forward.json):
37 core audited paths are byte-identical at the pre-layout #144 source; Metro,
mobile-bundle workflow and scene schema are identical at the composed #148 source;
App is identical to its previously scoped sampler/touch-reviewed head. After the
reviewed layout, only generated contracts and optional view descriptions changed
in kernel/authority/content sources, covered by #147. The gate developer separately
recomputed every recorded hash and that exact changed-path list. This comparison
carries the scoped audits forward; it is not a new Astra audit. The checklist
reviewer checks the comparison and linked relocation/projection dispositions.
The retained comparison has [its hash manifest](evidence/2026-10-03-c1-gate-audit-carry-forward.SHA256SUMS)
and [actual verification output](evidence/2026-10-03-c1-gate-audit-carry-forward.SHA256SUMS.verify).

## Carries and live-doc tidy

- Every original deferred triage item and newly found carry has a stage/trigger in
  [ROADMAP carry checkpoints](ROADMAP.md#c1-carry-checkpoints), including the partial
  scene contract, implicit dependency loader boundary and fresh-id Continue.
- [DIFFERENCES](system/DIFFERENCES.md) has no rows 3/6/7; row 10 is limited to far
  scan, perception and darkness. [World parameters](world-parameters.md) marks
  W1/W2/W13/P3/P6 DONE with their proofs; remaining time numbers stay deferred.
- Live docs link current sampler binding, actual scene render/relaunch proof and
  completed room-view needs 2/7/12. Future/release planning links the active content
  ending decision; its planning input is corrected without changing any capability
  or feature row. Book UI links the canonical acceptance/carry record. Historical decisions, reviews, captures and archive remain unedited.

Supporting PRs #144, #146, #147 and #148 have merged into main with their
published reviews; this gate draft integrates status head
`bf973c56196c5f15e16b2542bb71dc35e7457bc3`. Runtime bytes remain identical to the
reviewed composed #148 source. This records completed support merges, not gate closure.

## Closure requirements

- Exact gate head and all started CI jobs verified green by the PM.
- One fresh checklist reviewer confirms proofs, audit carry-forward, carry stages
  and live-doc tidy; append its short verdict in the review index.
- Gate PR merged; only then mark Gate C1 passed in ROADMAP and the handoff state.
