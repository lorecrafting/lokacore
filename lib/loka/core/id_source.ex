defmodule Loka.Core.IdSource do
  @moduledoc """
  Deterministic gameplay ids (spec 01 A8; owner decision
  `docs/decisions/owner-decisions-r3-2026-09-24.md`): a UUIDv8 from the first 16 bytes of
  SHA-256 over the canonical JSON `["loka-id-v1", world_context_id, command_id, ordinal]`.

  `command_id/2` derives the stable CommandId (04 §3, 03 §14) the same way from
  `["loka-command-v1", idempotency_scope_id, invocation_id]`; authority placement never enters
  it (owner decision `docs/decisions/owner-decisions-r3-lanes-2026-09-24.md`; rule in
  `docs/spec/conformance/numeric-profile.md`). It is for invocation-derived commands only: an
  authority-internal command such as `run_job` uses a different tag over its own identity.
  """
  import Bitwise
  import Loka.Core.Canonical, only: [is_safe_integer: 1]
  alias Loka.Core.Canonical

  @doc """
  `:invalid_id` unless both ids are binaries, `:invalid_ordinal` unless the ordinal is an
  integer in `0..2^53-1`, `:invalid_canonical` if an id is not valid UTF-8.
  """
  @spec id(term(), term(), term()) ::
          {:ok, String.t()} | {:error, :invalid_id | :invalid_ordinal | :invalid_canonical}
  def id(world_context_id, command_id, ordinal) do
    cond do
      not (is_binary(world_context_id) and is_binary(command_id)) -> {:error, :invalid_id}
      not (is_safe_integer(ordinal) and ordinal >= 0) -> {:error, :invalid_ordinal}
      true -> uuid(Canonical.encode(["loka-id-v1", world_context_id, command_id, ordinal]))
    end
  end

  @doc "`:invalid_id` unless both ids are binaries, `:invalid_canonical` if one is not valid UTF-8."
  @spec command_id(term(), term()) ::
          {:ok, String.t()} | {:error, :invalid_id | :invalid_canonical}
  def command_id(scope_id, invocation_id) when is_binary(scope_id) and is_binary(invocation_id),
    do: uuid(Canonical.encode(["loka-command-v1", scope_id, invocation_id]))

  def command_id(_, _), do: {:error, :invalid_id}

  defp uuid({:error, _} = error), do: error

  defp uuid({:ok, json}) do
    <<a::binary-6, v, b, r, c::binary-7, _::binary>> = :crypto.hash(:sha256, json)
    # Version 8 in byte 6's high nibble, RFC 9562 variant in byte 8's top bits.
    hex =
      Base.encode16(<<a::binary, (v &&& 0x0F) ||| 0x80, b, (r &&& 0x3F) ||| 0x80, c::binary>>,
        case: :lower
      )

    <<p1::binary-8, p2::binary-4, p3::binary-4, p4::binary-4, p5::binary-12>> = hex
    {:ok, Enum.join([p1, p2, p3, p4, p5], "-")}
  end
end
