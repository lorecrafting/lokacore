defmodule Loka.Core.Int do
  @moduledoc """
  Checked rule-critical integer arithmetic (`docs/spec/conformance/numeric-profile.md`).
  Operands and results stay in [-(2^53 - 1), 2^53 - 1]; an operand or result outside it,
  or an operand that is not an integer, is `:integer_overflow`, never wraparound. BEAM
  integers are exact, so results are checked after computing.
  """

  @safe 9_007_199_254_740_991

  defguardp safe(n) when is_integer(n) and abs(n) <= @safe

  @spec add(term(), term()) :: {:ok, integer()} | {:error, :integer_overflow}
  def add(a, b) when safe(a) and safe(b), do: check(a + b)
  def add(_, _), do: {:error, :integer_overflow}

  @spec sub(term(), term()) :: {:ok, integer()} | {:error, :integer_overflow}
  def sub(a, b) when safe(a) and safe(b), do: check(a - b)
  def sub(_, _), do: {:error, :integer_overflow}

  @spec mul(term(), term()) :: {:ok, integer()} | {:error, :integer_overflow}
  def mul(a, b) when safe(a) and safe(b), do: check(a * b)
  def mul(_, _), do: {:error, :integer_overflow}

  @doc "Quotient truncated toward zero and remainder `a - q*b`; a zero divisor is `:division_by_zero`."
  @spec divide(term(), term()) ::
          {:ok, integer(), integer()} | {:error, :integer_overflow | :division_by_zero}
  def divide(a, b) when not (safe(a) and safe(b)), do: {:error, :integer_overflow}
  def divide(_a, 0), do: {:error, :division_by_zero}
  # div/rem truncate toward zero; the range is symmetric, so no quotient overflows.
  def divide(a, b), do: {:ok, div(a, b), rem(a, b)}

  defp check(n) when abs(n) <= @safe, do: {:ok, n}
  defp check(_), do: {:error, :integer_overflow}
end
