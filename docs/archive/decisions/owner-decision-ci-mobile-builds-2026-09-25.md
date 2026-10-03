# Owner decision: native mobile builds only when native inputs change — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

## What the PM proposed (summary)

1. Full Android/iOS native builds only when native inputs change (`mobile/app/package.json`,
   `mobile/app/package-lock.json`, `mobile/app/app.json`, `mobile/app/metro.config.js`,
   `mobile/app/android/**`, `mobile/app/ios/**`, `.github/workflows/mobile.yml`), plus on
   every push to main and on manual dispatch (before phone sessions).
2. PRs changing kernel or mobile JS/TS get one fast Linux job that compiles the Hermes
   bundle for both platforms and checks the kernel is in it.
3. The merge rule becomes: every CI job that ran is green on the head. A native break that
   slips through shows up on main within minutes and is fixed straight away.

## Owner's words

> yes please
