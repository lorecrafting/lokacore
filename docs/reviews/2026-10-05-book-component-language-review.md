# Book component language — independent review

Reviewed exact local head `6b70d493b2585ab716b22fc3ddb9c848cd81053c`.

Requirements derived before the diff: [Book UI](../system/book-ui.md) remains
normative; the guide maps actual shared components; [delivery](../WORKFLOW.md#book-interaction-delivery)
requires same-slice interaction amendments and immediate correctness fixes; E3
adds visual consistency work without overriding the [mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md)
or blur carry.

**CHANGES REQUIRED** — one should-fix.

- **BCL-1**, `docs/BOOK-UI-COMPONENTS.md:50` (also :36): dreams are mapped to
  Scene/chapter foreground pages with choices and Close/Resume. The selected
  [B9 contract](../system/book-ui.md#b9-bed-and-resumable-dream-details) instead
  requires a bed-local detail with local Close, optional Resume and ordinary
  navigation available. A developer following this row could put the dream into
  modal `view.scene`, hiding return/Contents and forcing its foreground on reopen.
  Current `ScenePage` renders a line and Continue, not choices or Close/Resume;
  `Book.tsx` suppresses navigation for `view.scene`. Separate the modal scene/chapter
  pattern from the selected ordinary dream detail, mark its source pending, and
  describe the current scene component accurately.

Other requirements pass: listed symbols exist, durable delivery pointers are
present, E3 does not defer introduced correctness defects, mobile/blur deferral
remains explicit. Ponytail Review: Lean already. Ship after BCL-1 closes.

Validation: `mise exec -- elixir bin/check_docs.exs` passed (553 docs, zero broken
links/unreachable documents); AGENTS is 1397 words within 1400. `git diff --check`
passed. Docs-only review; no implementation, native proof or mutation testing claimed.

## Scoped fix recheck

**APPROVE** at exact source head `aa988906468258a6b92cbe262474b33c1b6d5fa4`.
BCL-1 is closed: the current scene component now accurately describes modal
continuation; B9 has a separate ordinary bed→dream detail pattern, explicitly
unbuilt and linked to its selected canonical rule, with local Close, Resume after
reopen and World access. The changed guide no longer presents the current
`ScenePage` as providing dream choices or local navigation. Only that guide changed
since the original reviewed head; no source implementation changed.

Scoped validation: `git diff --check` passed; normal commit hooks reran the
Markdown link/reachability and AGENTS budget checks successfully. No open findings.
