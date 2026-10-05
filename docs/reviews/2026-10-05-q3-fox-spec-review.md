# Q3-F fox/silent bell — independent spec review

2026-10-05. **APPROVE** at `2b235074ab65621d15d2a0436dd2acd1e84db742`; no open findings. I authored none of the reviewed change. This is a planning and active-spec adoption review, not an implementation verdict.

The source parent is main `abb92527`. The brief's A1 merge, v0.0.13/API1.12, hash and bell detail ID match the merged release and frozen known answers. I checked the A1 exact-detail Ring recipe, Q3 objective, prior/lost reactions, scene and receipt validator against the new [Q3-F contract](../system/cartridge.md#q3-f-fox-and-silent-bell), [bell recovery clause](../system/save.md#bell-choice-return-recovery), [implementation brief](../briefs/chapter-one/a2-q3-fox-sol-brief-2026-10-05.md) and [PM adoption](../decisions/pm-decision-q3-fox-silence-2026-10-05.md).

Silence is restricted to completed rescued/stays returns, sets fox without ringing, and uses a separate fact-change reaction and evidenced scene start. The first Q3 terminal choice closes the opposing action. The save clause requires the own Silence receipt plus the original Q2 terminal evidence, while retaining Ring/prior and bell-first lost validation. This matches the chapter plan's five lawful pairs and the pre-production decision's current-release integrity rule; no old-release adapter is requested. The two-line modal scene and delegated copy use installed scene@1 without a new control or global behavior.

Ponytail review: **Lean already. Ship.** No unnecessary abstraction or compatibility machinery found. `git diff --check abb92527 2b235074` passed. No implementation tests were run for this docs-only adoption; source tests and independent save opinion remain implementation gates.
