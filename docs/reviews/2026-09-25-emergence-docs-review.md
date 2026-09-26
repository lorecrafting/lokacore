# Review: composability and emergence owner decision; composes-with check (PR #39)

PR #39 (docs only), commit reviewed `48cac4d`. Reviewer: Opus, fresh. Mutation testing
skipped (docs/config only). Owner quotes are unverifiable by design.

**Verdict: APPROVE WITH NOTES.**

## What must be true

1. Every spec citation points at a section that says what the principle claims.
2. No principle contradicts the spec: reactions emit only registered typed consequences
   and stay bounded (21 §11; 04 budgets); persistent player state uses existing scopes
   and authority, with no new mutation authority (21 StateScope, 21 §27).
3. The composes-with check is something a developer can write and a reviewer can check,
   and it asks for nothing beyond the spec.
4. developer.md, reviewer.md and the decision record state the same check.

## Citations

All accurate: 21 §1 (closed semantics, open composition), §3.4 ReactionRule, §6
Recognition / displayed identity, §11 Shared consequence vocabulary, §27 Property,
housing, and persistent places ("does not imply a new mutation authority"), 07 §3
(`shared_area`: "multiplayer/economy/abuse certification required"), 07 §21 Economy
boundary. Principle 3's "budgets and ordering" matches 04 (shared aggregate budget,
bounded reaction depth, registry order). Principle 4's Realm authority fits StateScope
`realm` and 21 §27.

## Findings

1. **should-fix**, `.claude/agents/reviewer.md:24-26`. Step 7 drops the decision's
   exception ("each such place is a finding unless the spec requires it",
   `owner-decision-emergence-2026-09-25.md:54-55`) and says "a rule that names ... one
   piece of content is a finding". Cartridge ReactionRules name content by design (21 §11's
   example fires on `village/bell_rung` and selects `village_guard`). Scenario: a reviewer
   of a content slice flags every authored reaction and asks for a rewrite the spec does
   not require, which the same file forbids ("Do not ask for work beyond the spec").
   Fix: say "capability code that names another mechanic or one piece of content is a
   finding unless the spec requires it".
2. **nit**, `docs/decisions/owner-decision-emergence-2026-09-25.md:28-30`. "reads and
   writes facts, properties, ..." can read as licence for a property setter; 21 §11 says
   "There is deliberately no generic set-component-field operator". Say writes go through
   the registered consequence vocabulary. Likewise line 37: "registered typed
   consequences" (21 §11 wording).
3. **nit**, same file `:31-32`. "burning opens it, and nobody wrote that rule" overstates:
   someone writes the burn consequence (e.g. `connection.set_state` on a destroyed
   barrier). The point is that nobody wrote a fire-and-door rule; say that.
4. **nit**, same file `:44-45`. Speech, emotes and group channels are 21 §16
   (SocialAction/Emote, Party/group); only §6 is cited.

The check itself (`:52-55`) is followable: three lists, "none" is a valid answer, and it
demands no new features.
