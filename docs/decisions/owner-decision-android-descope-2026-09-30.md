# Owner decision: one phone until release, Android deferred — 2026-09-30

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the wording is
smoothed, not quoted. No checker can verify it against the chat.

Owner (paraphrased): only one physical device is needed for now, the owner's iPhone 11.
Android is descoped until the final, fully finished release; the owner does not want to
spend time on a second device.

Effect ([spec amendment](../spec/IMPORT.md#amendments-since-import), home of the rule:
[envelope §4](../spec/r1-acceptance-envelope.md#4-physical-devices-and-reproducible-setup)):

- R6, R6P and every gate before the first free product gate
  ([14 Shipping rule](../spec/14-implementation-plan.md#shipping-rule)) need Node plus iOS
  Hermes on the iPhone 11. No Android device, Android Hermes host or Android build is
  required evidence there.
- Android evidence is deferred, not dropped: the Android Hermes host pair, the Android
  qualification device and the Android release smoke are required at the first free product
  gate.
- This is an assurance reduction added to the one in
  [ADR-074 §3](adr-074-ts-first-proposal.md#3-the-proposal): an Android-only failure (for
  example the expo-sqlite double-open fault in the [mobile lessons](../lessons/mobile.md))
  can pass R6P unseen until that gate. The owner accepts it.
