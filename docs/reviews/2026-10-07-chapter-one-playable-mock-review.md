# Chapter one playable mock restore: independent review

- PR: [#293](https://github.com/lorecrafting/lokacore/pull/293), branch `docs/chapter-one-playable-mock`, exact head `fd9939e7`.
- Scope: docs only (`README.md`, `docs/design/ui-exploration/README.md`, `chapter-one-playable.html`). Governing: [AGENTS.md](../../AGENTS.md) privacy rules, [room view README](../archive/design/room-view/README.md), [Book UI](../system/book-ui.md).
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. The HTML is the owner's published artifact, unchanged.
2. It carries no secrets, machine paths, device identifiers or personal data.
3. The README is marked informative, says nothing the HTML or `docs/system` contradicts, and does not compete with the room view as the chosen direction.
4. `elixir bin/check_docs.exs` passes.

## Checks

1. 281,533 bytes, `<title>Loka Chapter One</title>`, UTF-8, no CR, sha256 `cc2b1dab…1668a`. The reviewer had no Artifact read tool, so the byte comparison with the live artifact is not independently proved (size and title only).
2. Grep for `/Users/`, `/home/`, `~/dev`, owner name/email, UDID/UUID, serial, API key, `sk-`, `ghp_`, `AKIA`, 40-hex, emails, IPs: none. `token`/`secret` hits are game content (`ferry_token`, the `{secret|…}` invisible-ink markup). External loads only Google Fonts and cdnjs html2canvas 1.4.1, as the README says. `localStorage` is used for the in-page save only.
3. The README starts "Informative only", defers to the room view and the Book UI spec, and says the rules are not the engine's. Its "57 rooms" claim matches the 57 top-level `ROOMS` entries and the "of 57 places" contents line. The root README line is labelled informative.
4. `check_docs`: 270 docs, 0 broken, 0 unreachable, exit 0.

## Findings

- Question: `docs/design/ui-exploration/README.md:7-8`. "last updated 2026-10-01" and "effects lab from rounds 7–12" do not appear in the HTML. Owner memory dates the build 2026-09-25 and says "the room-view artifact stays the effects lab". The page does contain an effects panel (with the round-12 "Archive, not in v1" group), so the wording is defensible. Confirm the 10-01 date with the owner, or drop it.

Disposition: no blocker. Owner approval still required to merge.
