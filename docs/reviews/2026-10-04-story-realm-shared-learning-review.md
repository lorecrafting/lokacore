# Shared Story/Realm learning and replaceable content — independent review

PR #164 purpose: record the owner's direction that offline Story teaches Realm's mechanics
and interaction, with story content replaceable above the stable engine.

Reviewed source: `e14fab0ca1cfcc312f6ea6999804aa469493ee9a`.
Reviewer: fresh Codex agent; authored none of the reviewed changes.
Verdict: **APPROVE**. No findings or open items.

## Requirements derived before the diff

- The owner's current instructions require familiar mechanics/UI across Story and Realm,
  differences justified by multiplayer needs, and replaceable story/events/quests/content.
  Owner wording must be identified as paraphrased; architecture applications must be distinct.
- Preserve the earlier leaning as history. Do not select the first Realm activity, promise
  unchanged-cartridge hosting, authorize Realm implementation, or replace approved story work.
- Preserve [ADR-074 §3/§5](../archive/decisions/adr-074-ts-first-proposal.md): TypeScript-first
  capabilities until a real server consumer, route selection before enablement, and retained
  fixtures/differentials for ports; no compulsory advance port of every mechanic.
- Preserve [save pins](../system/save.md#opening-a-story), typed cartridge identities and
  [onboarding-only offline evidence](../archive/spec/23-accounts-progress-admission.md#6-evidence-policy-onboarding-not-competitive-rewards).
  Rewriting content grants no silent migration, deletion or online-value import.

## Review and verification

The five-file documentation diff satisfies these requirements. The new record separates
owner paraphrase, application of existing contracts and remaining product decisions. The
historical leaning is unchanged; active architecture, owner-rule and future links resolve
to the new direction. The decision index keeps both historical and current records. Other
active documents link to the canonical record instead of repeating its rules.

The existing presenter/session boundary supports familiar interaction; the record preserves
versioned semantics and distinct contracts for genuine multiplayer differences. Save policy
and the narrow unreleased-sampler exception remain explicit. No code, fixture or test changes.

At the reviewed source, `mise exec -- elixir bin/check_docs.exs` exited 0: 380 docs,
zero broken links and zero unreachable docs. Mutation testing is inapplicable to this
documentation-only change under [the workflow](../WORKFLOW.md#review-stance).

Ponytail Review: **Lean already. Ship.** One canonical decision record and small references;
no speculative implementation or duplicate framework.
