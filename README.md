# Loka v3

Offline-first story engine: Elixir/OTP server, TypeScript kernel on Hermes (React Native).

This repository starts at R2. History, the R1 spike and its evidence: [lorecrafting/lokacore-v2-legacy](https://github.com/lorecrafting/lokacore-v2-legacy) (archived, commit `997a7a8`).

Agents: start with [AGENTS.md](AGENTS.md).

## Where things are

- [docs/ROADMAP.md](docs/ROADMAP.md): where the work stands and what comes next.
- [docs/system/](docs/system/README.md): what the code does now, checked against the code and tests (the source of truth with `protocol/` and the fixtures); [owner decisions](docs/decisions/README.md).
- [Builder's guide](docs/BUILDERS-GUIDE.md): today's cartridge and blueprint authoring workflow, examples and installed limits.
- [docs/spec/](docs/spec/README.md): frozen fixtures, release scope, the import record. [docs/archive/](docs/archive/README.md): the cited specification packet and in-force older decisions.
- [docs/WORKFLOW.md](docs/WORKFLOW.md): how a slice is built and reviewed; [review records](docs/reviews/README.md).
- [protocol/](protocol/README.md): the frozen contracts both kernels validate against.
- `lib/`: the Elixir application (`lib/loka/core` is the Elixir kernel); `test/`.
- `kernel/ts/`: the TypeScript kernel.
- `mobile/`: the Expo app (`app/`), authorities, features and shared packages.
- `bin/`: checks and generators; `bin/check_all.sh` runs them all.
- [docs/design/room-view/](docs/design/room-view/README.md): the chosen touch UI direction (informative).
- [docs/design/ui-exploration/](docs/design/ui-exploration/README.md): the mock playable chapter one and other UI explorations (informative).
