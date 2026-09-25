# Contract lessons

Hard-won lessons for `protocol/` schemas, fixtures and canonical encoding (R3).

- Every `required` entry and every bound (`minItems`, `maximum`, `pattern`, `const`, ...)
  needs a fixture that fails when it is removed. A scripted sweep that drops one entry or
  bound at a time and reruns the fixtures found survivors in three R3 PRs (6a, 3, 4b); run
  it on new schemas before handoff.
- Elixir maps with 32 keys or fewer iterate in sorted key order, so a key-order test with
  fewer keys passes even when the encoder never sorts. Use more than 32 keys.
