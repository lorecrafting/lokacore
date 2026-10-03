# Owner decision: per-slice device rows run on the iOS Simulator — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the owner wants testing on the Simulator for now, so it
runs unattended; the owner agreed to the PM's proposal below.

- **Every slice** that reruns the automated P6 device rows (the Node/Hermes byte compare, cartridge load,
  crash and kill safety, lost reply, luck replay, damaged save) runs them on the iOS Simulator, with the
  same drivers and red controls, on a **Release** Simulator build (Hermes bytecode, as on the phone; a dev
  build skips the bytecode compile and would hide a mismatch it causes). The Simulator then runs the same
  Hermes and expo-sqlite versions, arm64 on the owner's M1 Mac.
- **The physical iPhone 11** is used only at gates and before a release, and when a slice touches native
  code, performance or touch handling: real timing (row 2), touch feel, airplane mode, memory and heat,
  and iOS behaviour that differs on hardware (for example the bottom-edge gesture deferral, #115).
- The phone run for the Quest from dialogue slice (M1), already under way on 2026-10-02, finishes on the phone.

Effect: [owner rules](../system/owner-rules.md), [mobile lessons](../lessons/mobile.md).
