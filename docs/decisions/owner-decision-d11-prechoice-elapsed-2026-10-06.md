# Owner decision: D11 trusted elapsed before character choice — 2026-10-06

Question presented to the owner:

> D11 character choice: before the player chooses a character, should trusted elapsed-time updates advance the world clock and due jobs? The system spec calls them non-player invocations and says backgrounding does not pause the world, while the D11 brief says choice comes before other gameplay. I recommend allowing elapsed updates but keeping all player commands blocked until choice.

Owner answer, verbatim:

> Allow elapsed updates (recommended)

Accordingly, the [D11 mechanic](../system/mechanics.md#d11-character-choice-selected-contract)
admits trusted schedule-owned elapsed updates before selection. They advance the world
clock and due jobs without choosing an ancestry. Ordinary player commands remain
blocked until the once-only choice commits. This follows the existing
[trusted elapsed contract](../system/mechanics.md#m1-a-elapsed-authority-time) and
[non-pausing world rule](../system/owner-rules.md).
