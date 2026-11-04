# Prologue adoption shortlist (2026-11-04)

Informative only; nothing here is a decision. The PM merged three studies into one ranked list:
[Baldur's Gate 3 lessons](baldurs-gate-3-lessons-2026-11-04.md),
[RPG genre innovations](rpg-genre-innovations-2026-11-04.md) and the
[adoption map of the earlier notes](rnd-adoption-map-2026-11-04.md). Each row is mostly content on
mechanics that already exist (engine S) unless marked. "Writing" is the owner's word load. Line
counts are the studies' estimates. Each row's mechanics claims come from the source study and are
unverified until a slice brief checks them.

| # | Adoption | Sources | Loka systems | Engine | Writing |
|---|---|---|---|---|---|
| 1 | **Failure opens a scene, never a dead end.** Every checked choice has a `then_failed` line or small scene; a retry still works through skill growth. | BG3, map (Disco Elysium) | dialogue checks (row 14), branching dialogue | S | 2-4 lines per check |
| 2 | **Two ways past every gate.** Talk, search, force or a tool at three or four blockers; learned verbs answer in every room with one default line. | BG3, genre (Deus Ex) | barriers, hidden passages (row 11), pick/force (13, G12), Use X on Y (G4), W7 | S | 10-15 lines |
| 3 | **Act now, hear it later.** A choice sets a fact; one or two later NPCs read it back in one line, and a return visit shows the change. No combination matrix. | BG3, genre (Witcher 3, Pentiment), map | W2 facts, delayed reactions (FD1), W6 variants, `fact_compare` | S | 8-12 lines |
| 4 | **Part 1 as an onboarding chapter.** One new verb per room, the first check of each kind easy, never two systems unlocked in one beat; each basic is a quest whose objective is a skill check. | BG3 (Nautiloid), map | check ratings, row 14, quests, `skill_compare` | S, one sampler proof | 2-4 lines |
| 5 | **Every payoff lands.** Each carried seed (trowel, flower, Dov's fruit) has a reaction fallback; no story NPC can die in a combat Attack. | BG3 | reaction@1, `item.move`, story points | S | 3-5 lines |
| 6 | **Regard shown, never scored.** Hidden trust or standing changes a greeting, a description or an emote at two or three moments; fame and infamy kept as separate facts. | BG3, genre (New Vegas) | standing (15), disposition (G11), W6, G9 emotes | S | 6-8 lines |
| 7 | **Rest scenes the player cannot miss.** Dreams and night scenes tied to story points; the next rest plays what is due. A warm-hearth rested status at the first fire. | BG3, map (WoW) | `rested` trigger, Lantern Rest dream, statuses | S | in the outline |
| 8 | **The shrine keeper moves on with each death.** The Wayside Shrine's keeper says one new line per death, once per visit. Fits loka-kgd.206/.205. | genre (Hades) | death@1, a death-count fact | **S-M**: verify a reaction can see the player's own death | med |
| 9 | **A dry narrator and repeat-visit tiers.** A few second-person asides on failure, odd acts and death; a short "familiar" line per main room. | BG3, genre (storylet habit) | check failure lines, death lines, W7 variants | S | 8-12 asides, ~18 room lines |
| 10 | **Word gets around.** A witnessed deed becomes a rumour NPCs repeat before the player arrives. | genre | FD5 witness, W3 rumour, W6 | S | low |
| 11 | **Quest rewards that are verbs, not loot.** A resolved quest opens a path or grants a recipe for good. | map (OSRS) | `quest_resolved`, `barrier.set`, recipes | S | low |
| 12 | **Lasting marks.** A scar, a mood, a title kept from a hard moment, read in a few later lines. | genre (Wildermyth) | W8, W6, FD9 | S | low |

Also worth a look later: an origin tag on the ancestry that unlocks a few lines (D:OS2; S while one tag per
ancestry), a "menace" fact that rises on failure and sends the player somewhere at a threshold
(Fallen London), knowledge as the key to a place (Outer Wilds; check toolbox trap 8 first),
naive dialogue for a low stat (Fallout).

Conflicts the map found with owner rules: making hidden elites public, fee trainers and guild halls,
an economy in the prologue, agent-written text, and any rest or cooldown that makes the player wait.
