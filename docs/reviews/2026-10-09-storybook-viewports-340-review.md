# Review: Storybook current phone and tablet viewports (PR #340)

- PR #340, branch `chore/storybook-viewports`, head `6a1f985c`. Beads loka-s4d. Config-only
  (one data block); short review per [Review stance](../WORKFLOW.md#review-stance), no mutants.
- Governing: brief `br show loka-s4d` (sizes in CSS px portrait, via `device()`, default stays
  iPhone 11, keep `iphone11`/`iphoneSE`/`pixel7`/`ipadMini`, phones before tablets small to large,
  verify Galaxy S25 and Pixel 9/10 and Tab S10 on a source).
- Verdict: **APPROVE WITH NOTES** (one should-fix, data value; nothing blocks).

## Must be true

1. Only the `viewport.options` block of `mobile/app/.storybook/preview.tsx` changes.
2. `initialGlobals.viewport.value` stays `iphone11`; the four old keys still exist.
3. Every size is what a real device reports to a browser in CSS px (the designer sees the
   width a user gets), with tablets typed `tablet`.
4. Order: phones narrow to wide, then tablets narrow to wide.

## Proof

- (1) `git diff main...6a1f985c --stat`: one file, +14 −2, all inside `options`.
- (2) `preview.tsx:29` unchanged; keys at lines 58, 62, 63, 67 (`iphoneSE`, `pixel7`, `iphone11`,
  `ipadMini`).
- (3) Every added value was refetched from its yesviz device page this run (Galaxy S25 360x780,
  Pixel 9 360x808, iPhone 13/14/17e 390x844, 16 393x852, 17 and 17 Pro 402x874, Air 420x912,
  17 Pro Max 440x956, iPad 2025 and Air 11 820x1180, Pro 11 834x1210, Air 13 1024x1366,
  Pro 13 1032x1376). Cross-checked against Chromium DevTools
  `front_end/models/emulation/EmulatedDevices.ts` (main): iPhone 16 393x852, 16e 390x844,
  iPad Pro 13 1032x1376 agree; Pixel 9 does not (finding 1).
- (4) Holds for the listed values; with finding 1 fixed, `pixel9` belongs after `iphone11`.
- PR body claims rerun: "check_all: PASS" is backed by the pre-push hook on the hosted push; the
  `/code-review medium` result is reported (4 findings, dispositions given). "Pixel 9 uses yesviz
  360x808" is true of yesviz and wrong of the device (finding 1).

## Findings

1. **should-fix**, `mobile/app/.storybook/preview.tsx:57`: `pixel9: device('Pixel 9', 360, 808)`.
   yesviz derives 360x808 from a CSS pixel ratio of 3.0, but Google ships the 1080x2424 Pixel 9 at
   420 dpi (ratio 2.625), the same density yesviz itself uses for Pixel 7 and 8 (1080 wide,
   412 CSS px). Chromium DevTools emulates **Pixel 9 at 412x924** and Pixel 10 at 412x924.
   Failure: a designer picks "Pixel 9" and checks a 360 px page; a real Pixel 9 shows 412 px, so a
   break between 400 and 412 px goes unseen, while 360 px is already the Galaxy S25 row. Fix: `412,
   924`, move the row after `iphone11` (414x896) and before `iphoneAir` (420x912).
2. **nit**, `preview.tsx:59`: label `'iPhone 13/14'` drops the 16e the brief named. Chromium lists
   iPhone 16e at 390x844 (yesviz has no 16e page, only 17e). Optional: `'iPhone 13/14/16e'`.

## Suggestions (not code changes; from the brief's "verify" list)

- Pixel 10: Chromium DevTools lists 412x924, same panel as Pixel 9. Either a `pixel10` row or the
  label `'Pixel 9/10'` on the corrected row.
- Galaxy Tab S10: no entry on yesviz or in Chromium's device list (only Tab S4); no reliable CSS
  size found, leaving it out stays right.
- Galaxy S25 360x780: yesviz only (ratio 3, Samsung's FHD+ default); not in Chromium's list.
  Consistent with the S23/S24 panels, kept.
