# Owner decision: pause mobile development and verification — 2026-10-05

Owner direction (paraphrased): do not use a mobile simulator; pause Android and iOS development,
builds and verification until further notice. Disable mobile CI checks and builds. Keep the
headless TypeScript game simulator (`kernel/ts/test/sim.ts`), because it exercises engine
correctness on Node and does not need a phone or mobile simulator.

The current PR gates remain the Elixir and TypeScript kernels, the Node simulator, contracts,
content checks and documentation. Mobile app typechecking and tests, mobile lint/format/size
checks, native builds and Hermes mobile bundles are deferred. The two dedicated mobile
workflows have only manual triggers in source and are disabled in GitHub until the owner
resumes mobile work. Manual triggers preserve the procedures for later use; they are not
approval to run them during the pause.

Browser work may supply the owner's preview while native work is paused. The exact browser
preview and its checks are a separate slice. The existing phone architecture, historical
evidence and deferred mobile quality obligations remain recorded; the pause does not claim
mobile behavior has been verified.

This temporary direction supersedes earlier simulator-first and local Debug Simulator
routing where they require mobile sessions now. Restore relevant checks and update the
workflow when the owner resumes mobile development.
