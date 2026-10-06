# D1 TypeScript CI compiler setup — 2026-10-06

Scoped fix source: `f06f89a0385d10b3e75bb61af57e57bac1d6a2e4`.
Governing [workflow](../../WORKFLOW.md) and
[authored-source proof](../2026-10-06-d1-ferry-isle-publication/README.md).
The game source/pins remain the integrated D1 source `4e217f60`, v030/API1.26,
hash `dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9`,
149 IDs. No save/protocol/runtime/cartridge source or oracle changes.

The normal pre-push gate and initial push of `8de184ee` passed; its direct output
is retained. [PR231](https://github.com/lorecrafting/lokacore/pull/231) then exposed
[TypeScript CI failure](https://github.com/lorecrafting/lokacore/actions/runs/37464149355/job/112270908492):
645/646 cases passed, but the authored-source fixture spawned `mise`, which that
Node-only job does not install. The failed hosted output is retained, not called green.

The minimal fix invokes `mix` directly and adds the same pinned Beam setup already
used by the Elixir job, `MIX_ENV=test` and `mix deps.get --check-locked` to the
TypeScript job. It keeps real source compilation; no duplicated artifact, custom
compiler framework or extra dependency is introduced.

Controlled proof used the pinned Node/Elixir/Erlang executable directories and
standard OS tools with **mise absent, mix present**. The original fixture fails
at `spawnSync mise ENOENT` (Node exit1); the restored direct-mix fixture passes all
six transport cases in that same environment (Node exit0). Both logs are retained.
An initial control PATH still included Homebrew mise; its setup assertion rejected
that environment before claiming proof. Source edits were restored before green.
Normal formatting and diff checks pass. Fresh primary scoped recheck of these two
harness/workflow edits is pending; save/protocol carryover needs no source recheck.

The final fix-head hook and hosted checks remain separate evidence. All retained
output is redacted before hashing, with SHA verification separate. No preview,
native build, device or owner save was used.
