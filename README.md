# Loka v3

Offline-first story engine: Elixir/OTP server, TypeScript kernel on Hermes (React Native).

This repository starts at R2. History, the R1 spike and its evidence: [lorecrafting/lokacore-v2-legacy](https://github.com/lorecrafting/lokacore-v2-legacy) (archived, commit `997a7a8`).

Agents: start with [AGENTS.md](AGENTS.md).

## Where things are

- [docs/ROADMAP.md](docs/ROADMAP.md): where the work stands and what comes next.
- [docs/spec/](docs/spec/README.md): the specification (source of truth); [decisions](docs/decisions/README.md) since R0.
- [docs/WORKFLOW.md](docs/WORKFLOW.md): how a slice is built and reviewed; [review records](docs/reviews/README.md).
- [protocol/](protocol/README.md): the frozen contracts both kernels validate against.
- `lib/`: the Elixir application (`lib/loka/core` is the Elixir kernel); `test/`.
- `kernel/ts/`: the TypeScript kernel.
- `mobile/`: the Expo app (`app/`), authorities, features and shared packages.
- `bin/`: checks and generators; `bin/check_all.sh` runs them all.
- [docs/design/room-view/](docs/design/room-view/README.md): the chosen touch UI direction (informative).
