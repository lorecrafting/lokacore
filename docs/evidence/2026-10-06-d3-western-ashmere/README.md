# D3 Western Ashmere provisional source proof — 2026-10-06

Source: `6964feed5d65739ac4f9dd6f68bde790ae0cc2fd`, branch
`chapter1/d3-western-ashmere`, based on independently reviewed planning
`b7a031fe45231a8f4b17a3d9eb235308b8dfb679` and published D1
`815f66f9039ca22f80d44112a1ff966eadb8381e`.
Governors: [approved brief](../../briefs/chapter-one/d3-western-ashmere-brief-2026-10-05.md),
[cartridge declarations](../../system/cartridge.md#d3-western-ashmere-declarations),
[Book flow](../../system/book-ui.md#d3-mill-cottage-and-hob-details),
[B4](../../system/mechanics.md#b4-light-and-darkness-selected-contract) and
[composition](../../system/architecture.md#building-mechanics-by-composition).

This is local provisional source, not a published release. Source retains
`0.0.30`/API `1.26` for focused compilation; final successor release/API/hash/IDs
are **null** pending ordered D4/C4 integration and independent re-pin. Frozen
v030 fixture and bundled app assets remain unchanged. Each SQLite test uses the
compiled current source's exact provisional hash, not a final successor oracle.
Browser/native proof is **null**: no preview, build, simulator, phone or owner
save was used. All new room/detail/document/Hob prose is an **authored addition**;
archived 00a §§2/4/5/8/11 supplies topology and cast, not recovered prototype prose.

## Behavior and controlled consumers

The literal public route visits all five rooms and returns through Boathouse's
preserved east exit; its ferry offer remains present. Both dark rooms hide
ordinary identities/details and retain their stairs. Illuminated Mill Cellar
has no NPC, rat or population. Existing S1 behavior remains unchanged.

Original Hob starts in Mill Loft at 64800; his first job is 108000. That boundary
moves the same identity into Old Mill, 151200 returns him, and a controlled
21600 dawn start transfers at 64800. A controlled source gives the existing
torch enough authored fuel to observe both schedule boundaries while lit;
this is test tuning, not a production fuel change. Saved departure preserves
Conversation/Leave without present-speaker offers; the captured `hob` action
invokes the original speaker through ordinary Talk admission.

Both document bodies are hand-written literal oracles. Their exact captured
Read controls keep narration in their own Book detail histories and leave the
entire gameplay state unchanged. Cold SQLite reopens retain one committed body;
room changes prune local detail routes. Existing controlled Book renderer tests
cover Read entry, safe Back/Leave and saved detail restoration.

Each dark branch has an actual lethal combat/death consumer using a controlled
NPC and the installed perception producer; no production mill enemy is added.
The original body returns to Chapel Nave without gear, walks the public route
back, sees its actual owned corpse and nested torch, and Takes the original
light/satchel. Cold reopen validates death, arrival and each recovery receipt.
Existing containment forced-overload extraction/Give/Drop safety, and existing
light/ferry failed-COMMIT, lost acknowledgement and replay proofs were reused;
no save shape or semantic writer changed.

## Checks and red controls

- New source route/schedule/rat and real SQLite/Book checks: **6 pass**.
- Existing S1, light, ferry and controlled Book checks: **40 pass**.
- Compiler room/reference/readable/schedule/ferry checks: **41 pass**.
- Kernel/test/play and Book TypeScript checks: **exit 0**.
- Current-source compilation: **exit 0, no warnings**; normal staged hooks pass.
- Nine source mutants fail, then restored source passes: mill return points to
  Empty Cottage, Hob starts in Old Mill, dawn moves at 07 instead of 06, dusk
  transfer is removed, ledger/sign point at each other's body, each dark
  description is removed, and an extra live Mill Cellar rat is authored.
- Relevant old focused route/recovery, schedule and Book document checks survive
  these D3-specific source breaks before the new checks fail. The old S1 oracle
  also survives the extra Cellar rat, justifying the one new illuminated-room
  behavior assertion. No source-text, filename or registry-count test was added.

**Headless sim is not green.** Current D3 and frozen published v030 each execute
200 seeds/6758 commands and report the same sole failure: seed **71**, index
**11** (the twelfth command), `gameview_agrees_with_admission/not_found`.
The command uses a foreign world context with an otherwise valid Maud
`lantern_meal` offer at 2p. Production correctly refuses `not_found` and adopts
nothing; `view/invariants_view.ts:184`'s service oracle reports a mismatch for
that envelope refusal. This is a pre-existing oracle false positive, retained
in paired raw logs; PM owns a separate fix lane. The runnable
[small reproduction](sim-envelope-repro.mjs) loads frozen v030, moves north/east,
then proves the foreign refusal/unchanged world, false oracle and lawful success.
Its exit 0 means the reproduction's literal assertions hold, not a green sim.

## Self-review and delivery limits

Ponytail Review: reused installed primitives, dynamic source fixture, SQLite host
and Book presenter/routes; no new dependency, capability, command, engine branch,
state writer or component. Removed duplicate field-by-field state comparison in
favor of one full unchanged-state assertion, and kept Book assertions out of the
kernel test. **Lean already.** Correctness self-review fixed missing touch links,
used Hob's actual authored action key, exercised the controlled dawn inverse and
kept darkness/actual corpse ownership authoritative. The evidence commit hook
caught an unreachable evidence README; the active cartridge clause now links it. No open D3 correctness
finding or spec conflict was found by this developer; independent approval is
not claimed. Final integration pins, accumulated publication checks, browser
interaction/refresh and fresh independent review remain outstanding.

Every retained tool log records its command and individual exit status and is
redacted before capture. `SHA256SUMS` covers raw logs, status JSON and the repro;
`SHA256SUMS.verify.log` is the separate verification output, not self-listed.
