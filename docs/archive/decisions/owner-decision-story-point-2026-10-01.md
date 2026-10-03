# Owner decision: "milestone" (story sense) becomes "story point" — 2026-10-01

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

**Owner (paraphrased).** "The story-progress concept the spec calls a milestone (a
cartridge-declared story-progress point such as `prologue_completed`, its pending and accepted
report, the DomainEvent of 23 §3) is renamed everywhere, because it is mostly about storylines,
quests and dialogue. Registry event names are Keys: no dot."

The owner first chose "story beat" (event `story_beat_reached`). When the clash with scene beats
(00a's "Beats" column and "consequence beat", 04's beat/occurrence) was raised, the owner chose
**story point** instead: event `story_point_reached`. Scene beats keep their name.

**Scope.** A pure rename in the spec (a reviewed amendment, [IMPORT.md](../../spec/IMPORT.md#amendments-since-import)),
the account contracts (`StoryPointReport`, `StoryPointReportId`, `StoryPointAcceptance`,
`QualifyingStoryPoint`, field `story_point`), the frozen trace field `story_point` (shape
`{key, occurrence, outcome}` unchanged) and the local authority. The quest stages of 06 are
renamed too. The project-plan sense (R milestones, milestone gates and slices) keeps its name;
review and decision records are history and keep theirs.
