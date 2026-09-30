# Owner decisions: codex cross-vendor reviews, Fable back but rare — 2026-09-30

Relayed verbatim by the PM (Claude Code) from the owner's chat. No checker can verify these
quotes against the chat.

Supersedes the [all-reviews-on-Opus decision](owner-decision-opus-reviews-2026-09-25.md).

Owner's words:

> please put in the notes that the cross-vendor review will now just use codex, and we can do away with the copy pasting stuff

> Also since we have fable back, unsuspend it for really really complex super complex things, like almost rarely use it, but instead for complex reviews you can use codexes astra

> otherwise the highest opus or highest sol is good enough

> reason why is we want claude code to be the principal developing lokacore, but since we have a $100 codex subscription, we can be very liberal on using better codex models

> fable as a rare backstop, sol and astra reviewers as normal everyday crossvendor reviews ... you can escalate to astra liberally, but we want to save a bit on fable since it uses claude code tokens faster and claude code will be our principal for this project so it will burn tokens continuously while our codex subscription just sits waiting to be called

Effect:

- Claude Code (the PM and its Opus subagents) remains the principal developer; codex is used
  for reviews only, at its strongest available model (Sol or Astra), without rationing on
  cost (the subscription is prepaid).
- Codex is a normal, everyday cross-vendor reviewer: the PM may add it to any slice beyond
  docs-only or trivial ones, and hard reviews escalate to it freely. There is no
  foundational-freezes-only limit any more. Our own independent Opus review stays required;
  codex is a second opinion, never a substitute.
- The PM runs it itself with `codex exec` (read-only, `-m` the strongest model), giving it
  the PR, head SHA, spec sections, focus and the output format: verdict, then findings with
  id, severity, `path:line` and a failure scenario, in one fenced block. The PM appends the
  answer verbatim to the review record. No paste-ready prompts, no owner relay.
- Fable is available again as a rare backstop for very complex work only, to save Claude
  Code tokens.
