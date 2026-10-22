# Owner decision: designer on Opus, one design pass per UI batch — 2026-10-21

Owner words (Beads loka-x6t.73 and loka-dnf2 notes):

> can opus do it well? If so then make opus the designer. And Fable for creating and maintaining and coming up with the overall design system

> can we have the design system thats running on Fable downgrade to Opus since it will be more or less stable

> okay lets do that

## Effect

- [`.claude/agents/designer.md`](../../.claude/agents/designer.md) has `model: opus`. Opus maintains the stable design system. Fable runs only for a new page type or component family without precedent, an owner-requested visual refresh, or a milestone or RC design audit; an Opus designer escalates a system-silent item to Fable.
- A UI batch gets ONE Opus designer pass (all screenshots, wording, spec text, as single writer). Per slice there is no design review: the developer builds from the designer's rulings record and [Book UI](../system/book-ui.md), and the code reviewer also checks screenshots and wording against the rulings. The designer comes in up front only for a new page type or component family.
- Why: five per-slice design reviews (about 35-60k tokens each) found only nits and spec text; every blocker came from code reviewers or CI.
- This supersedes [designer on Fable for the polish phase](https://github.com/lorecrafting/lokacore/blob/4de109875dc985d4e09fc95b6e3433e58f94f9bb/docs/decisions/owner-decision-designer-fable-2026-10-08.md) and the per-slice design review of the [designer role](owner-decision-designer-role-2026-10-07.md); the rest of that record stands.
- It also supersedes the Sonnet line ("nit (designer on Sonnet)") of the [live polish session record](owner-decision-live-polish-session-2026-10-09.md). Designers are never Sonnet. Owner, 2026-10-15: "wait sonnet should never be a designer, wasn't it fable designer?" On 2026-10-21 the owner made Opus the designer (paraphrased). A picker nit goes to the Opus designer.
