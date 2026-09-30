# Review: Android evidence deferred to the first free product gate

- PR: #64 (`android-descope`), commit reviewed `da832dd`.
- Scope: normative spec amendment (docs/spec/README.md §11), docs only. No mutation
  testing (no code). Depth: thorough requirement audit.
- Verdict: **APPROVE WITH NOTES** (one should-fix, two nits, one question).

## What must be true (written before reading the diff)

1. Android is still required, and not deleted, at a named later gate. The 14 Shipping rule
   names that requirement.
2. No R6, R6P or P1-P6 requirement still needs Android Hermes, a Pixel or an Android
   device as evidence.
3. The two DEVICE strings in `release-scope.json` and `release-scope.md` match exactly (no
   generator keeps them in sync here).
4. No fixture, `protocol/` file, schema or expected answer changes.
5. The decision record is marked (paraphrased) and says plainly what is given up.
6. The rule is stated once (envelope §4). Other places link to it, and the links resolve.

## Checks

1. Met. 14 Shipping rule (`14-implementation-plan.md:1023`) now names "the Android evidence
   deferred to it". Envelope §4 (`r1-acceptance-envelope.md:102-106`) keeps the Android
   rows, §4.1 and the §3 host pair, required at that gate.
2. Met. Own grep `git grep -n -i -E 'android|pixel|iOS/Android'` at `da832dd`, each
   remaining normative hit classified:
   - Updated with a link: 07:484, 09:165, 14:564, 15:71, 16:898, ADR-074:89,
     pre-release-proof:65/86, ROADMAP:61.
   - R1/R2 history: 07:205, 07:482 (list, qualified at :484), 07:514 (§14 spike gate),
     14:109/132/153/203/265, 16:84/830/870-874, envelope:88-97/110 (governed by new
     paragraph), envelope:194 ("both mobile platforms", §10 R1 builds),
     `conformance/r1-run-manifest.template.json`, ADR-070/071 records, AGENTS.md
     Pixel 3a lessons.
   - Release-time: 09:486 (§19), 10:447, 11:452, 14:727/733 (R13).
   - Code/schema enum values (`hermes_android`, `ANDROID_SERIAL`): not evidence
     requirements. Left alone correctly.
   - Misses: none. ROADMAP R6/R6P rows (26, 43, 52, 53) name only Hermes/phone/device.
3. Met. The DEVICE strings are identical (compared programmatically).
4. Met. `git diff --stat main...da832dd` lists 15 Markdown/JSON docs. No `protocol/`,
   `docs/spec/conformance/`, schema or kernel file changed.
5. Partly met: see S1.
6. Met. There is one normative paragraph at envelope §4. The other places carry a one-clause
   pointer plus a link. `bin/check_docs.exs`: 155 docs, 0 broken. That check skips
   anchors, so I resolved `#4-physical-devices-and-reproducible-setup`, `#shipping-rule`,
   `#amendments-since-import` and `#3-the-proposal` against their headings by hand.
7. ROADMAP P1 row (`docs/ROADMAP.md:61`) now says Node + iOS Hermes. The Proposed R6
   slices table has no other Android text.
8. The workflows `mobile.yml` (android job) and `mobile-bundle.yml` (android export) can
   stay. They use no device time, and they keep the Android build from rotting before
   the gate. The decision defers evidence. It does not forbid builds.

## Findings

- **S1 (should-fix)**: `docs/decisions/owner-decision-android-descope-2026-09-30.md:13-19`
  and `docs/spec/r1-acceptance-envelope.md:63` do not call the deferral an **assurance
  reduction**. ADR-074 §3 (`adr-074-ts-first-proposal.md:86-87`) and envelope §3 name
  exactly one owner-approved reduction: fresh sequences run on Node. The new text only
  says Android is "deferred". Failure: an Android-only Hermes/native divergence, like
  the expo-sqlite Android double-open NPE (`docs/lessons/mobile.md:6`), passes R6P
  unseen. No record says the owner accepted that exposure. The gate reviewer
  reading the reduction list sees only the Node one. Fix: in the record and in the
  envelope §3 sentence, add one sentence: "Deferring the Android Hermes host pair and
  Android device evidence to the first free product gate is a further owner-approved
  assurance reduction beside ADR-074 §3."
- **N1 (nit)**: `r1-acceptance-envelope.md:104` says "the only physical device is the
  iPhone 11", but :98 keeps Palma 2 as an optional usability device. Suggested wording:
  "the only required physical device".
- **N2 (nit)**: `docs/lessons/mobile.md:31-33` dropped "ask for a swap only when needed",
  which still applies after the gate.
- **Q1 (question)**: the owner said "the final, fully finished release", and the PR maps
  that to the first free product gate (R10+R12). This is the earlier, stricter reading
  and is consistent with 14:51 ("full first release remains chapter one"). The PM should
  confirm the owner did not mean R13 (the paid release). If the owner did mean R13, only
  the gate name in the envelope §4 paragraph and the record changes.
