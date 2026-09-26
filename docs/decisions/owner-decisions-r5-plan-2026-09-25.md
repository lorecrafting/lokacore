# Owner decisions: R5 plan and MUD-style `loka play` — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

## 1. MUD-style `loka play`

What the PM proposed (summary): make `loka play` a single-player MUD-style terminal prompt
now (look, compass moves, scripts, replayable transcripts, trace records); a networked
telnet/SSH way in waits for the online server as an optional R14 item (plain telnet is
unencrypted; SSH or a browser terminal is the safe form).

Owner's words:

> yes

## 2. The R5 slice plan

What the PM proposed (summary): S1 rooms/exits + first world + look/move + `loka play` +
rule lint lockdown; S2 target resolution (none/unique/ambiguous) + generated feature map; S3
facts, conditions, state-dependent descriptions; S4 take/drop/give + one-container and
acyclic-containment checks; S5 ActionSet algebra + simple ActionRecipe execution; S6
logical clock, RNG use, simple checks/resources; S7 barriers/locked exits + loose ends; +1
deterministic simulation (10,000 seeded sequences per CI run, invariants, shrinking) then
the Gate R5 review; S1 gets Fable plus probably Astra, most others Opus; re-estimate after
S1-S2.

Owner's words:

> sounds good

Result: the slice list is in [the roadmap](../ROADMAP.md) R5 row.
