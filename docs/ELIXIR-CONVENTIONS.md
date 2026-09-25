# Elixir, Ecto and ExUnit conventions

Applies to every Elixir change. Read the vendored Phoenix usage rules first:
[Elixir](conventions/phoenix/elixir.md) and [Ecto](conventions/phoenix/ecto.md). They
apply as written, except where this page overrides them. They are copied verbatim from
Phoenix; refresh them with `elixir bin/sync_phoenix_rules.exs` (newest stable tag, or
name one) and review `git diff docs/conventions/phoenix` against the overrides below.
Phoenix's `phoenix.md`, `liveview.md` and `html.md` are vendored when the web/transport
app lands (document 07: Phoenix is transport and sessions only).

## Overrides of the upstream rules

Carried from Foundry's reviewed adaptation
([record](https://github.com/lorecrafting/foundry/blob/main/docs/ELIXIR-CONVENTIONS.md)).

- **Nested modules.** Prefer one module per file; existing nested helper modules are allowed.
- **`Task.async_stream/3`.** Bounded concurrency and an explicit timeout; `timeout: :infinity`
  only with another justified lifecycle bound.
- **Dependencies.** Add none without the owner's approval. Lock every Hex package in `mix.lock`.

## Loka additions

- **Pure kernels.** Domain rules never call Ecto, Repo, Phoenix, PubSub, the filesystem,
  HTTP, the wall clock or process-global randomness (spec document 01). Rules return a
  proposal; the host commits it (ADR-072).
- **All public functions have `@spec`.**
- **Temporary directories.** Never hardcode `/private/tmp` (macOS only); use
  `System.tmp_dir!()`. Shell out through `/bin/sh`: CI runs on Ubuntu.
- Before each commit: `mix format` and `mix compile --warnings-as-errors`.
