# Owner decision: a playtest-and-tune stage — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

Owner's words:

> I think we'll need some type of period where we keep playtesting and adjust mechanics/ui
> etc i think taht will take a bit, its not just build and then ship.  Is there anyway we can
> have that playtest and tweak mechanics/ui period?

The PM proposed (summary): terminal playtests with `loka play` from R5 S6b on; a
playtest-and-tune stage after R6P, open-ended, ended by the owner; the owner's notes batched
by the PM into small PRs; game numbers kept as cartridge data so tuning is a content edit;
lighter review for content-number and UI-styling PRs; the "format changes never break
installed content" rule starting at the first release to real players, not at R6.

Owner's answer:

> yes i'm happy with that plan.  I'd like to also add not only tuning, like adjusting numbers
> around, but things like entire whole mechanics and tweaking of mechanics and behaviour

Effect ([roadmap](../ROADMAP.md)):

- The stage covers number tuning, UI changes, changed mechanics and behaviour, and whole new
  mechanics.
- A PR that only changes content numbers or UI styling gets a short review (no Astra, no
  mutation testing). A changed or new mechanic is a normal slice: spec amendment first, full
  review, Astra where the PM judges it foundational.
- Until the first release to real players, cartridge formats and the development cartridges
  may change; known answers that change are re-derived independently and listed in the PR.
  From that release on, a format change never breaks installed content (new tag, old loader
  kept, tested save migration; spec 07 §26, 10 §22 and §28).
