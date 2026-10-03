# Owner decision: agent-device in UI-slice reviews — 2026-10-01

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the wording is
smoothed, not quoted. No checker can verify it against the chat.

Owner (paraphrased): after a trial, use agent-device (Callstack, open source) on the iOS
Simulator in UI-slice reviews, starting with slice G. Fix the iOS 27 simulator launch crash
first.

Effect:

- A UI-slice review drives the app with agent-device on the iOS Simulator: a dev build
  plus Metro, `snapshot -i` for refs and `press --settle` for actions; never `--json`.
- Trial cost: about 1.1k tokens per run.
- Nothing paid: agent-device is open source and runs locally on the owner's M1.
