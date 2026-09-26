# Owner decision: review lever after the R5 re-estimate — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

What the PM proposed (summary): observed harness tokens per slice were #34 (R5 S1) 2.64M
without Astra and #35 (R5 S2) 1.08M, against about 0.35M planned; the figures may count
per-run context and overstate. About 21 slices remain after S2b: roughly 23M at today's
review style, about 14-17M with the lever, against the original 7-8M. The lever: an Opus
reviewer by default; Fable only for slices that freeze foundations or game semantics
(about six of the 21: facts/conditions, ActionRecipe, deterministic simulation, the R6
offline authority and save system, GameView for the touch UI); Astra and a broad second
review round only for those foundational freezes; every other slice gets one Opus review
with a narrow fix check.

Owner's words:

> yes i approve the lever
