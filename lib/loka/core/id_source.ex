defmodule Loka.Core.IdSource do
  @moduledoc """
  Deterministic gameplay ids (spec 01 A8; owner decision
  `docs/decisions/owner-decisions-r3-2026-09-24.md`): a UUIDv8 from the first 16 bytes of
  SHA-256 over the canonical JSON `["loka-id-v1", world_context_id, command_id, ordinal]`.
  """
  import Bitwise
  alias Loka.Core.Canonical

  @spec id(String.t(), String.t(), non_neg_integer()) :: String.t()
  def id(world_context_id, command_id, ordinal)
      when is_binary(world_context_id) and is_binary(command_id) and is_integer(ordinal) and
             ordinal >= 0 do
    json = Canonical.encode(["loka-id-v1", world_context_id, command_id, ordinal])
    <<a::binary-6, v, b, r, c::binary-7, _::binary>> = :crypto.hash(:sha256, json)
    # Version 8 in byte 6's high nibble, RFC 9562 variant in byte 8's top bits.
    hex =
      Base.encode16(<<a::binary, (v &&& 0x0F) ||| 0x80, b, (r &&& 0x3F) ||| 0x80, c::binary>>,
        case: :lower
      )

    <<p1::binary-8, p2::binary-4, p3::binary-4, p4::binary-4, p5::binary-12>> = hex
    Enum.join([p1, p2, p3, p4, p5], "-")
  end
end
