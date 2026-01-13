defmodule Loka.Framework.Resources.FormulaEvaluator do
  @moduledoc """
  Safe formula evaluator for resource max values and other calculations.

  Evaluates simple mathematical expressions with variable substitution.
  Supports basic arithmetic operations and entity stats as variables.

  ## Supported Operations

  - Addition: `+`
  - Subtraction: `-`
  - Multiplication: `*`
  - Division: `/`
  - Parentheses: `(`, `)`

  ## Variable Substitution

  Variables are substituted from the provided bindings map:

      FormulaEvaluator.evaluate("level * 10 + sta * 2", %{level: 5, sta: 12})
      #=> {:ok, 74}

  ## Safety

  This evaluator does NOT use `Code.eval_string` or any dynamic code execution.
  It uses a simple tokenizer and recursive descent parser that only supports
  arithmetic operations.

  ## Usage

      alias Loka.Framework.Resources.FormulaEvaluator

      # Simple number
      {:ok, 100} = FormulaEvaluator.evaluate("100", %{})

      # With variables
      {:ok, 74} = FormulaEvaluator.evaluate("level * 10 + sta * 2", %{level: 5, sta: 12})

      # Unknown variable defaults to 0
      {:ok, 50} = FormulaEvaluator.evaluate("level * 10", %{})  # level = 0
  """

  alias Loka.Utils.MapHelpers

  @doc """
  Evaluates a formula string with the given variable bindings.

  Returns `{:ok, result}` or `{:error, reason}`.
  """
  def evaluate(formula, bindings) when is_binary(formula) and is_map(bindings) do
    # Normalize bindings to atom keys
    normalized_bindings = normalize_bindings(bindings)

    try do
      tokens = tokenize(formula)
      {result, []} = parse_expression(tokens, normalized_bindings)
      {:ok, trunc(result)}
    rescue
      e -> {:error, {:evaluation_error, Exception.message(e)}}
    catch
      :throw, {:parse_error, reason} -> {:error, {:parse_error, reason}}
    end
  end

  def evaluate(formula, _bindings) when not is_binary(formula) do
    {:error, {:invalid_formula, "formula must be a string"}}
  end

  @doc """
  Evaluates a formula, returning the result or a default value on error.
  """
  def evaluate!(formula, bindings, default \\ 0) do
    case evaluate(formula, bindings) do
      {:ok, result} -> result
      {:error, _} -> default
    end
  end

  # =============================================================================
  # Tokenizer
  # =============================================================================

  defp tokenize(formula) do
    formula
    |> String.trim()
    |> String.graphemes()
    |> tokenize_chars([])
    |> Enum.reverse()
    |> Enum.reject(&(&1 == :whitespace))
  end

  defp tokenize_chars([], tokens), do: tokens

  defp tokenize_chars([" " | rest], tokens) do
    tokenize_chars(rest, [:whitespace | tokens])
  end

  defp tokenize_chars(["\t" | rest], tokens) do
    tokenize_chars(rest, [:whitespace | tokens])
  end

  defp tokenize_chars(["+" | rest], tokens) do
    tokenize_chars(rest, [{:op, :+} | tokens])
  end

  defp tokenize_chars(["-" | rest], tokens) do
    tokenize_chars(rest, [{:op, :-} | tokens])
  end

  defp tokenize_chars(["*" | rest], tokens) do
    tokenize_chars(rest, [{:op, :*} | tokens])
  end

  defp tokenize_chars(["/" | rest], tokens) do
    tokenize_chars(rest, [{:op, :/} | tokens])
  end

  defp tokenize_chars(["(" | rest], tokens) do
    tokenize_chars(rest, [:lparen | tokens])
  end

  defp tokenize_chars([")" | rest], tokens) do
    tokenize_chars(rest, [:rparen | tokens])
  end

  defp tokenize_chars([c | rest], tokens) do
    cond do
      digit?(c) ->
        {num, remaining} = collect_number([c | rest])
        tokenize_chars(remaining, [{:number, num} | tokens])

      letter?(c) or c == "_" ->
        {var, remaining} = collect_identifier([c | rest])
        tokenize_chars(remaining, [{:var, var} | tokens])

      true ->
        throw({:parse_error, "unexpected character: #{c}"})
    end
  end

  defp collect_number(chars) do
    {num_chars, rest} = Enum.split_while(chars, &(digit?(&1) or &1 == "."))
    num_str = Enum.join(num_chars)

    num =
      if String.contains?(num_str, ".") do
        String.to_float(num_str)
      else
        String.to_integer(num_str)
      end

    {num, rest}
  end

  defp collect_identifier(chars) do
    {id_chars, rest} = Enum.split_while(chars, &(letter?(&1) or digit?(&1) or &1 == "_"))
    {Enum.join(id_chars), rest}
  end

  defp digit?(c), do: c >= "0" and c <= "9"
  defp letter?(c), do: (c >= "a" and c <= "z") or (c >= "A" and c <= "Z")

  # =============================================================================
  # Parser (Recursive Descent)
  # =============================================================================

  # Expression: Term (('+' | '-') Term)*
  defp parse_expression(tokens, bindings) do
    {left, rest} = parse_term(tokens, bindings)
    parse_expression_rest(left, rest, bindings)
  end

  defp parse_expression_rest(left, [{:op, :+} | rest], bindings) do
    {right, remaining} = parse_term(rest, bindings)
    parse_expression_rest(left + right, remaining, bindings)
  end

  defp parse_expression_rest(left, [{:op, :-} | rest], bindings) do
    {right, remaining} = parse_term(rest, bindings)
    parse_expression_rest(left - right, remaining, bindings)
  end

  defp parse_expression_rest(left, rest, _bindings), do: {left, rest}

  # Term: Factor (('*' | '/') Factor)*
  defp parse_term(tokens, bindings) do
    {left, rest} = parse_factor(tokens, bindings)
    parse_term_rest(left, rest, bindings)
  end

  defp parse_term_rest(left, [{:op, :*} | rest], bindings) do
    {right, remaining} = parse_factor(rest, bindings)
    parse_term_rest(left * right, remaining, bindings)
  end

  defp parse_term_rest(left, [{:op, :/} | rest], bindings) do
    {right, remaining} = parse_factor(rest, bindings)
    # Avoid division by zero
    divisor = if right == 0, do: 1, else: right
    parse_term_rest(left / divisor, remaining, bindings)
  end

  defp parse_term_rest(left, rest, _bindings), do: {left, rest}

  # Factor: Number | Variable | '(' Expression ')'
  defp parse_factor([{:number, n} | rest], _bindings), do: {n, rest}

  defp parse_factor([{:var, name} | rest], bindings) do
    # Look up variable using safe atom conversion, default to 0 if not found
    value =
      case MapHelpers.safe_to_existing_atom(name) do
        nil -> Map.get(bindings, name, 0)
        key -> Map.get(bindings, key, 0)
      end

    {value, rest}
  end

  defp parse_factor([:lparen | rest], bindings) do
    {value, remaining} = parse_expression(rest, bindings)

    case remaining do
      [:rparen | after_paren] -> {value, after_paren}
      _ -> throw({:parse_error, "expected closing parenthesis"})
    end
  end

  # Handle unary minus
  defp parse_factor([{:op, :-} | rest], bindings) do
    {value, remaining} = parse_factor(rest, bindings)
    {-value, remaining}
  end

  defp parse_factor([], _bindings) do
    throw({:parse_error, "unexpected end of expression"})
  end

  defp parse_factor([token | _], _bindings) do
    throw({:parse_error, "unexpected token: #{inspect(token)}"})
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp normalize_bindings(bindings) do
    bindings
    |> Enum.map(fn
      {k, v} when is_binary(k) ->
        # Use safe atom conversion, keep as string if atom doesn't exist
        key = MapHelpers.safe_to_existing_atom(k) || k
        {key, ensure_number(v)}

      {k, v} when is_atom(k) ->
        {k, ensure_number(v)}
    end)
    |> Map.new()
  end

  defp ensure_number(v) when is_number(v), do: v
  defp ensure_number(v) when is_binary(v), do: String.to_integer(v)
  defp ensure_number(_), do: 0
end
