# Missing Child Chapter 1 completion plan

This is the current delivery plan, not a claim that the chapter is complete. The
[roadmap](ROADMAP.md) records merged status; the [33 provisional implementation and proof briefs](briefs/chapter-one/README.md) give candidate slice detail; [the mechanics queue](NEXT-MECHANICS.md)
records the reusable capabilities. Each row below is one proposed player-visible PR
after **Q2-C-rescue (Wren's escorted return to Elspeth)**. A row starts only after its
dependencies are merged and its brief is re-pinned to the actual source head. The
[delivery workflow](WORKFLOW.md) supplies the specification, review and merge gates.

Completion means 57 reachable rooms (25 Ashmere, 22 Fen, ten public Priory), ten
playable quests (Q1–Q3 and S1/S2/S3/S4/S9/S10/S27), and three child outcomes
(`rescued`, `stays`, `lost`). The bell choice yields five valid child/bell combinations:
rescued or stays with prior or fox, and lost with prior. There is no lost/fox path.
Real failure, retry, save/reopen, recovery and chapter consequence behavior are part
of completion. A quest title or room file does not count until its player path works.

**Lift** compares a row with Q2-C-rescue = 1.0, a cross-layer escort/save/terminal
slice. It is a relative implementation/review size, not elapsed time. These 33
candidates consist of 30 implementation/content PRs and three proof PRs. Split a
candidate if its actual review footprint exceeds a complete player outcome; do not
split a working outcome merely by engine, content and UI layers.

## A. Finish the main story

| Slice and player outcome | Depends on | Lift |
|---|---|---:|
| **A1 Q3-B — bell and lost path:** reach the belfry and choose the bell. Ringing before meeting Wren can resolve Q2 as lost; later ringing leaves an active return completable. | Q2-C-rescue | 0.9–1.1 |
| **A2 Q3-F — fox choice:** after rescuing Wren or returning Vesper's message, choose silence and receive the fox variant. | A1 | 0.4–0.6 |
| **A3 Green finale:** voluntarily begin and acknowledge the selected epilogue; export the ending only on final acknowledgement. | A1, A2, both Q2 returns | 0.9–1.1 |

The first delivery path is A1 → A2 → A3, so the story's three outcomes and five
valid combinations become playable before the whole world's optional surfaces.

## B. Village, Priory and useful goods

| Slice and player outcome | Depends on | Lift |
|---|---|---:|
| **B1 Calendar/status:** see truthful cartridge-owned day/time and changing sun/moon status. | elapsed clock and recovery | 0.7–0.9 |
| **B2 S2 Chandler's Debt:** accept Peg's ledger and deliver it to Aldric on time, late or after honest expiry. | A1, B1 | 0.9–1.1 |
| **B3 Peg's shop:** buy and sell useful goods with conserved money, stock and carrying load ([adopted contract](decisions/pm-decision-b3-pegs-shop-2026-10-05.md)). | B2 | 0.8–1.0 |
| **B4 Light:** use and refuel a light source in an optional dark well passage, with a safe possession-recovery route. | B1, B3 | 0.8–1.0 |
| **B5 S9 Infirmary Herbs:** harvest real fenwort and exchange three for bandages and bounded faction gain. | B1, B2 | 0.8–1.0 |
| **B6 S4 Wisp:** start an all-hours marsh riddle, retry promptly and learn its ward. | B4, B5, Q2 riddle | 0.6–0.8 |
| **B7 Well and waterskin:** fill, pour and drink conserved liquid. | B3 | 0.6–0.8 |
| **B8 Maud's services:** buy a room, food or drink and receive an immediate, declared benefit. | B3, B7, Rest | 0.7–0.9 |
| **B9 S10 Room at the Lantern:** an actual Rest opens a resumable dream and an acknowledged memory. | A3, B8 | 0.8–1.0 |

## C. Watch, combat and survival

| Slice and player outcome | Depends on | Lift |
|---|---|---:|
| **C1 Tobin training:** learn swords and dodge, and see qualification affect a real fight. | B3, installed combat | 0.9–1.1 |
| **C2 S3 Watchman's Rounds:** accompany Tobin on a finite patrol and recover from failure without waiting for night. | B1, C1, Q2-C-rescue follow | 0.8–1.0 |
| **C3 Living hounds:** encounter bounded, persistent Fen hounds and collect actual fight loot. | B1, C1, installed combat | 0.9–1.1 |
| **C4 Hound behavior:** hounds respond to aggression, assist a pack and flee when hurt. | C1, C3 | 0.8–1.0 |
| **C5 Bleeding and bandage:** a hound hit can bleed; a learned bandage skill can stop it. | B5, C1, C4 | 0.7–0.9 |
| **C6 S27 Night in the Marsh:** begin a bounded survival expedition now and finish its real route alive; any swim-training reward is free and idempotent after Sedge's earlier lesson. | C2, C5, D1, D6 if swim reward retained | 0.7–0.9 |

## D. Connected world and remaining chapter consumers

| Slice and player outcome | Depends on | Lift |
|---|---|---:|
| **D1 Ferry and isle:** pay for passage, meet Sedge, take an immediately available swim lesson and return safely even after a loss. | B3, B4, B8 | 0.7–0.9 |
| **D2 Priory books:** explore the public Priory and learn real topics from held books. | A1, B5, B6 | 0.4–0.6 |
| **D3 Western Ashmere:** explore the mill and cottages and meet Hob through existing interactions. | B4, D1 | 0.3–0.5 |
| **D4 Homes and orchard:** meet Gareth and Ada, visit Elspeth's home and forage useful food. | B5, B8 | 0.3–0.5 |
| **D5 Deep Fen:** explore the oak canopy, black pool edge, fox den and fishing shallows. | B4, B6, Q2 returns | 0.3–0.5 |
| **D6 Water depths:** use Sedge's earlier swim lesson to reach two bottom rooms through an explicit, recoverable water rule; S27 is not the first way to learn swim. | B4, C1, D1, D5 | 0.8–1.0 |
| **D7 Deer:** observe bounded deer fleeing and conserved loot from deliberate fights. | C3, C4, D4 | 0.4–0.6 |
| **D8 Crows:** follow scavenged eligible items to a bounded, reachable nest and recover them. | C3, D5 | 0.6–0.8 |
| **D9 Reactive village:** hear the bell where it carries and see distinct cast responses to child and allegiance outcomes. | A3, B2, C3, D1, D2, D4 | 0.7–0.9 |
| **D10 Finding the way:** discover the full map, ask where and knock on a real accessible door. | all 57 rooms | 0.6–0.8 |
| **D11 Character choice:** choose the reconciled ancestry/attributes once and use them in existing checks. | B2, B6, C1 | 0.6–0.8 |
| **D12 Practical skills:** train herbalism and haggle, then use them on herbs and a shop price. | B3, B5, C1, D1 | 0.6–0.8 |

The 41 planned additions are disjoint: A1 +2; B2 +2; B4 +1; B5 +2; B6 +3;
C2 +4; C3 +2; D1 +6; D2 +4; D3 +5; D4 +3; D5 +5; D6 +2.
The existing 16 plus these 41 make 57. Q3 in A1 and S2/S9/S4/S10/S3/S27
in B/C bring the existing Q1/Q2/S1 to ten quests. All rooms need legal routes;
neither a sealed room nor an unimplemented quest option earns completion credit.

## E. Proof and chapter closure

| Slice and proof outcome | Depends on | Lift |
|---|---|---:|
| **E1 R9 certification:** reproduce applicable failures against an exact candidate with retained command/seed/fault identity. | applicable A–D contracts | 0.7–1.0 |
| **E2 R9C interaction proof:** exercise cross-mechanic cases in a compact synthetic cartridge. | E1, final changed contracts | 0.6–0.9 |
| **E3 R10 browser content gate:** prove reachable rooms, quests, all five ending variants, bounded long runs and a human Book walkthrough on one candidate. | A–D, E1, E2 | 0.7–1.0 |

The shared TypeScript engine simulation, real SQLite transaction/fault checks and
contract checks remain part of development proof. Browser play uses the same Book
client once its web host works, but browser storage evidence does not certify native
SQLite, backgrounding, touch or Hermes. Native build/device evidence is deferred
under the [owner's current development pause](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md); public release
readiness requires that separate prelaunch work after the pause is lifted.

## Rules for each brief

The first real consumer triggers any missing primitive; reuse the existing custody,
movement, quest, dialogue, due-job, scene and receipt machinery. Engine code owns
mechanics; cartridge content owns numbers and world settings. Every offered branch
must have a complete immediate outcome or an honest recovery route. Required chapter
paths never wait for tide, night, tomorrow, a wandering NPC or a lost key/light/fare.
An eligible death route must allow recovery of the actual body and possessions.

Each implementation brief rechecks its merged dependencies and governing
[`docs/system/`](system/README.md) clauses, identifies the exact consumer and
failure mutation, and pins new values with independent expected results. Protocol,
save, proposal/foundation and gate changes receive the extra review specified in
[the workflow](WORKFLOW.md). Changes to the release-scope applicability lock require
a reviewed amendment; an unused broad framework is not built merely to tick a
capability name. XP/levels, a generic behavior tree, timed service escrow, Realm,
Builder and a global story interpreter are not hidden Chapter 1 prerequisites.
