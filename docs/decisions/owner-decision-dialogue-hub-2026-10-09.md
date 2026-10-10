# Owner decision: dialogue hub, conversations stay open until Leave — 2026-10-09

In the live polish session (picks mv1mqmmbrnlb and mv1p8cx6jvgu) the owner found that a
conversation ends after one answer and asked for a typical RPG dialogue instead. Asked whether
Chapter 1's dialogue may change for this, the owner said yes (paraphrased: after every answer you
still have turns, and you can always leave the conversation; Leave the conversation can be one of
the conversation options, so the footer Leave does not do double duty).

## Effect

1. **The engine keeps a conversation open.** After an answer the dialogue's choices return in the
   same decision; Leave the conversation (`close_choice`) ends it. Answers that resolve a quest,
   riddle dialogues, patrol answers and single-choice dialogues still end as authored
   ([dialogue@1](../system/mechanics.md)).
2. **Chapter 1 changes with it.** Its walkthrough, E1 recordings and fixtures follow the new
   behaviour; pre-change saves that hold such an answer open as save corrupt with Start over
   (pre-production).
3. **The Book** shows Leave the conversation as the last dialogue option and hides the footer
   Leave inside a conversation ([Book UI](../system/book-ui.md), written by the designer).

Beads: loka-x6t.5.
