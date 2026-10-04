defmodule Loka.Core.IdSource do
  @moduledoc """
  Deterministic gameplay ids (spec 01 A8; owner decision
  `docs/archive/decisions/owner-decisions-r3-2026-09-24.md`): a UUIDv8 from the first 16 bytes of
  SHA-256 over the canonical JSON `["loka-id-v1", world_context_id, command_id, ordinal]`.

  `command_id/2` derives the stable CommandId (04 §3, 03 §14) the same way from
  `["loka-command-v1", idempotency_scope_id, invocation_id]`; authority placement never enters
  it (owner decision `docs/archive/decisions/owner-decisions-r3-lanes-2026-09-24.md`; rule in
  `docs/spec/conformance/numeric-profile.md`). It is for invocation-derived commands only:
  `job_command_id/2` derives an authority-internal `run_job`'s from
  `["loka-job-command-v1", job_id, occurrence]`, the occurrence being the job's due time.
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

  @doc """
  `:invalid_id` unless the job id is a binary, `:invalid_ordinal` unless the occurrence is an
  integer in `0..2^53-1`, `:invalid_canonical` if the job id is not valid UTF-8.
  """
  @spec job_command_id(term(), term()) ::
          {:ok, String.t()} | {:error, :invalid_id | :invalid_ordinal | :invalid_canonical}
  def job_command_id(job_id, occurrence) do
    cond do
      not is_binary(job_id) -> {:error, :invalid_id}
      not (is_safe_integer(occurrence) and occurrence >= 0) -> {:error, :invalid_ordinal}
      true -> uuid(Canonical.encode(["loka-job-command-v1", job_id, occurrence]))
    end
  end

  @doc "Elapsed authority CommandId, scoped to durable run/world and logical interval (M1-A)."
  @spec elapsed_command_id(term(), term(), term(), term()) ::
          {:ok, String.t()} | {:error, :invalid_id | :invalid_ordinal | :invalid_canonical}
  def elapsed_command_id(run_id, world_context_id, from, until) do
    cond do
      not (is_binary(run_id) and is_binary(world_context_id)) ->
        {:error, :invalid_id}

      not (is_safe_integer(from) and from >= 0 and is_safe_integer(until) and until >= 0) ->
        {:error, :invalid_ordinal}

      true ->
        uuid(Canonical.encode(["loka-elapsed-command-v1", run_id, world_context_id, from, until]))
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
