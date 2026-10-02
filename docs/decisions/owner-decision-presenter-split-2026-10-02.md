# Owner decision: engine output is structured; each presenter owns its layout and wording — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

The owner set the direction while reviewing the R6P UX polish:

- **The engine says what happened; each surface decides how to show it.** The kernel and the local
  authority return structured results only: events, outcome codes, narration keys with their
  bindings, and the GameView. They carry no layout and no surface-specific wording.
- **Each presenter renders the same results its own way.** `loka play` in a terminal prints a plain
  log. The phone's book UI may give dialogue its own page or pane, put a choice in a card, or show a
  move as a page turn with no log line. The owner expects many UI requests of this kind; each one is a
  presenter change and leaves the other presenters and the engine alone.
- **Cartridge prose is content,** shown on every surface; only its placement differs.

PM recommendation, accepted by the owner: the phone's log text is currently built below the UI line,
in `mobile/authority/local-story/smoke.ts` (`said`) and `mobile/authority/local-story/words.ts`
(added by the R6P UX polish). A **presenter split** slice after Gate R6P moves that text into
`mobile/app`, so the authority returns results only, and adds a check to [CHECKS](../CHECKS.md) that
stops display text from returning to `mobile/authority`. The R6P UX polish PR was not changed for
this; its behaviour for the player is the same either way.

Effect: [ROADMAP](../ROADMAP.md) Presenter split row.
