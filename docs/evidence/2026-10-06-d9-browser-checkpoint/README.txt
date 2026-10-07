# D9 browser checkpoint: observed failure, not completion proof

Production checkpoint `54ecc36da961dde0eb5f92c48a19d7680f1f5e20`;
provisional `ashmere_missing_child@0.0.40`, fixture SHA-256
`ee5b90cebcdda82f6357591f8bd3269a53536594a3b21a42bcdbc05584c60e00`.
This predates the source developer's final pin and fixes.

Actual Chrome Book at fresh isolated loopback origins on ports 19346 and
19348; production Expo development web bundle, expo-sqlite 57.0.3 WASM/OPFS,
existing patched worker and COOP/COEP. No seeded state, clock override, save
edits, native session or owner-save access. Capture redacts private paths and
identifier fields; screenshots contain the app viewport only. Both failed
origin saves are preserved. Start over was never pressed. Receipt/job IDs and
raw rows are not exposed through the permitted DOM surface and remain unknown.

## Observed

`trace.json` records search acceptance, Green drawing Take, Elspeth clue,
Reed Bank Study tracks, Fox Hollow introduction, literal LANTERN answer,
accepting Vesper's exact message and delivering it to Elspeth. The child ending
explicitly says Wren stays with Vesper. Green reflects message delivery rather
than describing a rescued child. Prior Study west ingress/east egress work
before allegiance. Public Aldric offers the bell task in Chapel Nave; travel
reaches Belfry and its actual bell detail. Ring bell shows the committed scene
line: "The bell's voice shudders through the timber around you."

**B1: reload failure.** Reload immediately after Ring, before Continue, yields
"The save is damaged and cannot be read. (save_corrupt)" and Start over.
Original logical day 1 pre-ring 19:51, scene 19:57. A second fresh origin repeats
Fen-born/stays/prior and fails again at pre-ring18:46, scene18:47. Crucially,
`reproduction-trace.json` proves cold reopen after completed stays and before
bell passes; the second run omits the Study detour. No root cause claimed.
Browser errors show duplicate React keys Talk to Elspeth/Prior Aldric, with no
corruption diagnostic. Both reproductions were reported to source owner/PM.

**B2: misleading bell Read.** Actual detail says the bell can be heard "out into
the fen", contrary to declared Ashmere/public Priory area excluding Fen/isle.
Reported for authored copy correction.

## Unproved

Other four terminal pairs, full cast/rumor matrix, fox Study closure, public S2
delivery, hound suppression/refresh, surviving cue history/reopen and continued
bell scene are unproved here. Controlled corpse/remote observer cases belong
to host/projection proof. No final D9 approval or completion claimed; rerun on
fixed final candidate.

## Artifacts and self-review

Chronological DOM traces, confirmed stays/bell/corruption PNGs, browser warning
and error JSON retained separately. SHA256SUMS hashes raw evidence;
SHA256SUMS.verify retains verification and is not self-listed. Existing
.gitattributes evidence rule is -whitespace. No test or production source added.
Ponytail review: lean evidence, no framework/dependency. Correctness pass keeps
observations, red reproduction, good reopen control and unknowns distinct.

## Temporary diagnostic, after the red reproduction

Source developer and PM authorized temporary console diagnostics solely in the
isolated proof worktree. Preserved failing origin was reopened; no save edits.
Raw sanitized output in corruption-diagnostic.json identifies SyntaxError
"malformed JSON: inconsistent bell return" at bellSave → dialogueSave →
receiptRecovery → load. Compiled bundle line maps the refusal to bell-save.ts:105,
the original prior choiceReceipt check. receipt-guard-diagnostic.json confirms
Command validation returns zero problems; receipt command ID, row/payload actor
and context all match. The payload target resolves neither bell detail key nor
Belfry room, so receipt validation rejects before DecisionResult checks.
Target ID value/presence was not captured and remains unknown. This is exact
predicate evidence, not an asserted root cause/fix. Source owner was notified.

Metro watch roots resolved the isolated checkout; node_modules came from npm ci
and was not symlinked. All diagnostic changes to store/session/authority/bell-save
were restored; this commit contains evidence only.
