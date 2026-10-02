# Owner decision: "milestone" (story sense) becomes "story beat" — 2026-10-01

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

**Owner (paraphrased).** "The story-progress concept the spec calls a milestone (a
cartridge-declared story-progress point such as `prologue_completed`, its pending and accepted
report, the DomainEvent of 23 §3) is renamed to story beat everywhere, because it is mostly about
storylines, quests and dialogue. The event 23 §3 calls `story.milestone_reached` becomes
`story_beat_reached` (registry event names are Keys: no dot)."

**Scope.** A pure rename in the spec (a reviewed amendment, [IMPORT.md](../spec/IMPORT.md#amendments-since-import)),
the account contracts (`StoryBeatReport`, `StoryBeatReportId`, `StoryBeatAcceptance`,
`QualifyingStoryBeat`, field `story_beat`), the frozen trace field `story_beat` (shape
`{key, occurrence, outcome}` unchanged) and the local authority. The project-plan sense (R
milestones, milestone gates and slices) keeps its name; review and decision records are history
and keep theirs.
