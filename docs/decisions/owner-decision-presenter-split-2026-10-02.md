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

## Addendum, 2026-10-02: one presenter for every engine

The owner, **(paraphrased)**: the presentation layer must work with the TypeScript engine and with a
future online Elixir engine; decouple it as much as possible.

This is the session boundary that [07](../spec/07-offline-storypacks-to-mmo.md#the-session-boundary)
already requires: the renderer receives host-neutral `GameView` data and emits host-neutral
`ActionInvocation` values through one `GameSession`, implemented by `LocalStorySession` (the
TypeScript authority) now and `RemoteRealmSession` (Phoenix transport to the BEAM server) later.
Today `mobile/app` imports the TypeScript authority's `smoke.ts` directly, so the presenter split
slice also:

- defines the `GameSession` the renderer uses, with only protocol types in it (the generated
  `GameView`, `ActionInvocation`, narration records and error codes from `protocol/`);
- makes the local authority one implementation of it, and leaves the remote one to the Realm work;
- adds a check that `mobile/app` imports nothing from `kernel/` or `mobile/authority/` except the
  session and the generated protocol types.

Words for outcome and refusal codes live in the presenter and key on the registered codes, so the
same words serve both engines.
