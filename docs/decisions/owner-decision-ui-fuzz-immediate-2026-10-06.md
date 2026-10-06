# Owner decision: address fuzzy Book text now — 2026-10-06

Owner direction (paraphrased): make a ticket for the intermittent UI blur, stop deferring it,
and remove the page turn for now. Issue [UI-FUZZ-01](https://github.com/lorecrafting/lokacore/issues/254)
tracks this work. This supersedes only the UI-FUZZ-01 timing in the
[C1 UI deferral](owner-decision-c1-gate-ui-deferral-2026-10-03.md); UI-PHONE-01 stays pending.

Remove the Book page-turn perspective and rotation as an immediate mitigation. The observed
blur before Take and the iOS scroll-edge behavior do not establish a single native cause.
Keep native before/after verification and owner feedback pending under the
[mobile pause](owner-decision-web-first-mobile-pause-2026-10-05.md). Preserve the owner save.
