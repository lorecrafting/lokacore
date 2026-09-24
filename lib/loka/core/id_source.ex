defmodule Loka.Core.IdSource do
  @moduledoc """
  Deterministic gameplay ids (spec 01 A8; owner decision
  `docs/decisions/owner-decisions-r3-2026-09-24.md`): a UUIDv8 from the first 16 bytes of
  SHA-256 over the canonical JSON `["loka-id-v1", world_context_id, command_id, ordinal]`.
  """
  import Bitwise
  alias Loka.Core.Canonical

  @safe 9_007_199_254_740_991

  @doc """
  `:invalid_id` unless both ids are binaries, `:invalid_ordinal` unless the ordinal is an
  integer in `0..2^53-1`, `:invalid_canonical` if an id is not valid UTF-8.
  """
  @spec id(term(), term(), term()) ::
          {:ok, String.t()} | {:error, :invalid_id | :invalid_ordinal | :invalid_canonical}
  def id(world_context_id, command_id, ordinal) do
    cond do
      not (is_binary(world_context_id) and is_binary(command_id)) -> {:error, :invalid_id}
      not (is_integer(ordinal) and ordinal in 0..@safe) -> {:error, :invalid_ordinal}
      true -> uuid(Canonical.encode(["loka-id-v1", world_context_id, command_id, ordinal]))
    end
  end

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
