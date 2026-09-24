defmodule Loka.Core.Rng do
  @moduledoc """
  The `xoshiro128ss-1.1` gameplay RNG and bounded uniform draws
  (`docs/spec/conformance/numeric-profile.md`). Not for keys, tokens or signatures.

  Adapted from xoshiro128** 1.1 by David Blackman and Sebastiano Vigna
  (https://prng.di.unimi.it/xoshiro128starstar.c), dedicated to the public domain.

  State is four unsigned 32-bit words, not all zero. Functions return the next state and
  never mutate; the host persists it.
  """
  import Bitwise

  @u32 0xFFFFFFFF
  @two32 0x1_0000_0000

  @type state :: [non_neg_integer()]

  @spec next(term()) :: {:ok, non_neg_integer(), state()} | {:error, :invalid_rng_state}
  def next(state) do
    if valid?(state), do: step(state), else: {:error, :invalid_rng_state}
  end

  @doc """
  Uniform integer in `[0, bound)`, `1 <= bound <= 2^32`, by rejection sampling. Rejected
  draws advance the state. A `max_draws` that is not a non-negative integer is
  `:invalid_rng_budget`; more than `max_draws` draws is `:rng_budget_exhausted`, and the
  caller discards the whole decision.
  """
  @spec uniform(term(), term(), term()) ::
          {:ok, non_neg_integer(), state()}
          | {:error,
             :invalid_bound | :invalid_rng_budget | :invalid_rng_state | :rng_budget_exhausted}
  def uniform(state, bound, max_draws) do
    cond do
      not is_integer(bound) or bound < 1 or bound > @two32 -> {:error, :invalid_bound}
      not is_integer(max_draws) or max_draws < 0 -> {:error, :invalid_rng_budget}
      not valid?(state) -> {:error, :invalid_rng_state}
      true -> draw(state, bound, @two32 - rem(@two32, bound), max_draws)
    end
  end

  defp draw(_state, _bound, _limit, 0), do: {:error, :rng_budget_exhausted}

  defp draw(state, bound, limit, left) do
    {:ok, raw, state} = step(state)
    if raw < limit, do: {:ok, rem(raw, bound), state}, else: draw(state, bound, limit, left - 1)
  end

  defp step([s0, s1, s2, s3]) do
    raw = rotl(s1 * 5 &&& @u32, 7) * 9 &&& @u32
    t = s1 <<< 9 &&& @u32
    s2 = bxor(s2, s0)
    s3 = bxor(s3, s1)
    s1 = bxor(s1, s2)
    s0 = bxor(s0, s3)
    {:ok, raw, [s0, s1, bxor(s2, t), rotl(s3, 11)]}
  end

  defp rotl(x, k), do: (x <<< k ||| x >>> (32 - k)) &&& @u32

  defp valid?([_, _, _, _] = s),
    do: Enum.all?(s, &(is_integer(&1) and &1 in 0..@u32)) and s != [0, 0, 0, 0]

  defp valid?(_), do: false
end
