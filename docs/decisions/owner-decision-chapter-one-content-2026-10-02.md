# Owner decisions: chapter-one content, 2026-10-02

Owner decisions (paraphrased): the owner accepted all five PM recommendations on the open questions of the archived content docs, [00 first-cartridge design](../archive/spec/00-first-cartridge-design.md) and [00a chapter-one content](../archive/spec/00a-chapter-one-content.md). The archived docs are history and stay unedited; this record is the current answer. Each decision is cited to the clause it settles and says where it takes effect.

| # | Decision | Settles | Takes effect |
|---|---|---|---|
| 1 | Prose: the prototype's drafted room text (`playable-src/data.js`) is the base. Prose is written only for rooms being built (sampler first); the owner approves each batch. Current names stay as working names. | 00 §10 question 4 ("Who writes 70,000 words"); 00 §2 "Name (placeholder)" table and the Status line ("Names and prose are placeholders") | `c1-sampler` (first slice that authors prose); later room batches the same way |
| 2 | `village.child_status` gets its own `stays` value: missing / rescued / stays / lost. Elspeth, Bram, the green and the rumors react to it separately. | 00a §7 Q2 outcome `stays` (~lines 379-382), which wrote `rescued`; 00a §6 facts row (~line 286), enum `missing/rescued/lost`; 00a §10 reaction rows `mother_reacts`, `ferryman_reacts`, `rumors_update`, `green_changes` | The later chapter-one stages after Gate C1 (plan #127) that author Q2, the facts and the reactions |
| 3 | Chapter one has three real endings, one per child outcome (rescued, stays, lost). The bell choice is a small variant inside the dawn scene. | 00 §11 "two endings by (`child_status`, `allegiance`)" (~line 656) against 00a §9 `dawn_on_the_green` "variant by child_status × allegiance"; also the clauses that still say two endings: 00a §11 "both endings reachable" (00a:508), 00a §9 "either intended ending" (00a:485), 00 line 714. Certification must cover all three endings (rescued, stays, lost) | The later chapter-one stage after Gate C1 (plan #127) that authors `dawn_on_the_green` |
| 4 | The "light" spell word moves to chapter two. S4's riddle rewards `fen.wisp_answered` plus a topic in chapter one (the ward topic comes from 00a:445; the owner said only "a topic"). In chapter one the fey-touched ancestry keeps +SPI and Priory -2; its one spell word waits for chapter two, when spell words arrive (settles 00:55 and 00:639). | 00a §4 aldric "spell word: light (ch1 teaches one word only)" (~line 222); 00a §7 S4 "aldric teaches `light` word for free" (~line 445); 00 §4.3 spell-word row (~line 338) and §11 ladder (chapter two adds spell words) | The later chapter-one stages after Gate C1 (plan #127) (Aldric, S4); chapter-two spell-word content later |
| 5 | Novice fixture: the target-ambiguity test moves to the cloister at 19:00. Ash's cloister hours become 12-20 (scriptorium 20-6). Hale is unchanged (cloister 18-6). Both are then in the cloister 18-20, and 19:00 sits inside that overlap. | 00a §4 novices table (Ash 12-18, Hale 18-6) and its "Open content reconciliation" note (~lines 231-238); 00a §11 "two novices in the cloister at 14:00" (~line 510) | The time-model stage (a later stage), when schedules exist; no earlier slice needs it |

## Carries for the PM

These are stated here only. After PR #127 rewrites the ROADMAP "R7/R8 for chapter one" row, the PM adds them there:

- Decision 2: a four-value `child_status` enum and a separate reaction per value.
- Decision 3: three dawn endings, with the bell choice as a variant, not a fourth ending.
- Decision 4: move the `light` word out of chapter one; S4 gives only `fen.wisp_answered` and the ward topic.
- Decision 5: the 19:00 cloister fixture and Ash's 12-20 hours, for the time-model stage.
