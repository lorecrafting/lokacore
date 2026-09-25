# ADR-073 — One Mix application with strict boundaries, not an umbrella

**Status: Accepted — entered [document 16](../spec/16-decision-register.md) 2026-09-24.** Amends [document 02 §1](../spec/02-beam-runtime-architecture.md#1-proposed-repository-shape)
and [document 14 §R2](../spec/14-implementation-plan.md#r2--fresh-repository-foundation) in place.

**Owner decision (verbatim):** asked "umbrella or flatten?" for the project overall, the
owner answered:
> yes please amend to flatten and not use umbrella

**Decision.** The server is one Mix application, `:loka`. The seven areas of document 02
§1 are top-level boundaries (`Loka.Core`, `Loka.Content`, `Loka.Store`, `Loka.Platform`,
`Loka.Runtime`, `Loka.Builder`, `LokaWeb`) checked by `boundary` in strict mode, so calls
between areas, and into external applications such as Ecto or Phoenix, must be declared.
The dependency rules of document 02 §1 are unchanged. The enforcement clause of 02 §1 is
strengthened from SHOULD to MUST (compile-time checks, each rule with a planted violation).
Document 14's suggested shape now names `kernel/ts/` (document 02's `kernel/`) instead of
`portable/`. Strict `boundary` does not police Elixir/OTP standard modules (for example
`:erlang`, `Application`); kernel purity against those rests on the ast-grep rule
`lint/rules/elixir-kernel-pure.yml`.

**Why.**
- The umbrella's one unique guarantee, leaving builder code out of the production release,
  does not hold here: `loka_web` depends on `loka_builder` for the Builder API.
- Strict `boundary` already enforces direction and external libraries, and adds export
  control that umbrella dependencies lack.
- One `mix.exs`, one dependency list, one test tree and one xref graph: fewer places for a
  solo developer or an agent to get wrong.
- Reversible: a boundary can become its own application if a separate deployable appears.

**Cost.** Mix no longer enforces the direction a second time; `boundary` alone does, with a
planted violation per rule in `bin/red_controls.exs`.
