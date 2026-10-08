# Owner direction: close C1 and defer UI polish — 2026-10-03

Exact owner messages, in order:

> i did my manual checking, everything looks good.  should we pass the C1 gate now and move on?

> wait when i played throgh, sometimes the rooms get fuzzy.

> lets just past the C1 gate and whatever polish items for the UI we can defer to the next gate or something

When asked what immediately preceded the fuzziness:

> not sure we can diagnose more later

## PM disposition under that direction

The PM accepts the owner's manual Simulator play as the C1 human acceptance and
closes C1 after the remaining reviewed PRs, green exact-head checks and the slim
checklist have landed. This direction does not itself assert a completed merge or
checklist review. The existing 12 feature slices remain the C1 feature count.

The PM defers the following UI work to the **next UI checkpoint**: the next
owner-facing UI polish preview, with a carry review at the next milestone gate.
Mechanics work may proceed before that checkpoint; these carries must remain visible.

| Carry | Current evidence and completion condition |
|---|---|
| UI-FUZZ-01 | Owner reports intermittent fuzzy room text; trigger and cause remain unknown. The independent reviewer observed clear text in sampled Release Simulator states, which does not prove the intermittent defect fixed. Reproduce and diagnose later, then verify room text across navigation/detail/item actions and obtain owner feedback at the next UI checkpoint. |
| UI-PHONE-01 | iPhone 11 feel/response and measured touch-to-visible-feedback remain unmeasured for C1. Perform the actual phone play and slow-motion touch-to-photon proof against the existing performance envelope at the next UI checkpoint; retain evidence and record measured values only then. |

The second row is the PM's bounded scope disposition under the instruction to pass
C1 and defer UI work. The owner did not explicitly report a latency measurement or
use the words “waive latency.” This changes the timing of the human/device requirement
in the [chapter-one plan §4](owner-decision-chapter-one-plan-2026-10-02.md#4-gate-c1)
and its triage item 27; it does not claim that requirement was performed or delete it.
This is development-stage acceptance, not a release-performance certification.

No additional UI polish or simulator resets are authorized by this record. Preserve
the owner's current preview and save. Mechanics, world time, story prose, frozen
fixtures and kernel contracts are unaffected.

Tracking: [ROADMAP checkpoint row](../ROADMAP.md#c1-carry-checkpoints).
Gate proof and pending closure conditions: [C1 checklist](https://github.com/lorecrafting/lokacore/blob/15c7d41be6c54208cd37b03aa87420f9f4b90d8e/docs/C1-GATE.md).
