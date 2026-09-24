defmodule Loka.Core.Canonical do
  @moduledoc """
  Strict JSON parser, canonical encoder and SHA-256 for the portable profile
  (`docs/spec/conformance/numeric-profile.md`).

  Values are `nil`, booleans, safe integers, UTF-8 binaries, lists and maps with ASCII
  binary keys. Both directions are linear in the input size.
  """
  @safe 9_007_199_254_740_991

  @type value :: nil | boolean() | integer() | binary() | [value()] | %{binary() => value()}

  @doc """
  Parses JSON text. Rejects duplicate or non-ASCII keys, fractions, exponents, NaN and
  Infinity, integers outside the safe range, lone surrogates, invalid UTF-8 and trailing
  data. `-0` parses as `0`.
  """
  @spec decode(binary()) :: {:ok, value()} | {:error, :invalid_json}
  def decode(text) when is_binary(text) do
    # String.valid? also rejects UTF-8-encoded surrogates.
    with true <- String.valid?(text), {v, rest} <- value(ws(text)), "" <- ws(rest) do
      {:ok, v}
    else
      _ -> {:error, :invalid_json}
    end
  catch
    :invalid -> {:error, :invalid_json}
  end

  @doc "Canonical text: sorted keys, no whitespace. Raises `ArgumentError` on a value outside the profile."
  @spec encode(value()) :: binary()
  def encode(value), do: :binary.list_to_bin([enc(value)])

  @doc "Lowercase hex SHA-256 of the canonical encoding."
  @spec hash(value()) :: String.t()
  def hash(value), do: :crypto.hash(:sha256, encode(value)) |> Base.encode16(case: :lower)

  # ---- parser ----

  defp ws(<<c, rest::binary>>) when c in ~c" \t\n\r", do: ws(rest)
  defp ws(rest), do: rest

  defp value(<<?{, rest::binary>>), do: object(ws(rest), %{})
  defp value(<<?[, rest::binary>>), do: array(ws(rest), [])
  defp value(<<?", rest::binary>>), do: string(rest, rest, 0, [])
  defp value(<<"true", rest::binary>>), do: {true, rest}
  defp value(<<"false", rest::binary>>), do: {false, rest}
  defp value(<<"null", rest::binary>>), do: {nil, rest}
  defp value(<<?-, rest::binary>>), do: number(rest, -1)
  defp value(rest), do: number(rest, 1)

  defp object(<<?}, rest::binary>>, acc) when acc == %{}, do: {acc, rest}

  defp object(<<?", rest::binary>>, acc) do
    {key, rest} = string(rest, rest, 0, [])
    if Map.has_key?(acc, key) or not ascii?(key), do: throw(:invalid)

    {v, rest} =
      case ws(rest) do
        <<?:, rest::binary>> -> value(ws(rest))
        _ -> throw(:invalid)
      end

    acc = Map.put(acc, key, v)

    case ws(rest) do
      <<?,, rest::binary>> -> object(ws(rest), acc)
      <<?}, rest::binary>> -> {acc, rest}
      _ -> throw(:invalid)
    end
  end

  defp object(_, _), do: throw(:invalid)

  defp array(<<?], rest::binary>>, []), do: {[], rest}

  defp array(text, acc) do
    {v, rest} = value(text)

    case ws(rest) do
      <<?,, rest::binary>> -> array(ws(rest), [v | acc])
      <<?], rest::binary>> -> {Enum.reverse([v | acc]), rest}
      _ -> throw(:invalid)
    end
  end

  defp ascii?(key), do: not String.match?(key, ~r/[^\x00-\x7f]/)

  # `run` holds the pending literal bytes; they are copied in one piece at the next escape
  # or the closing quote.
  defp string(<<?", rest::binary>>, run, n, acc),
    do: {:binary.list_to_bin([acc | binary_part(run, 0, n)]), rest}

  defp string(<<?\\, rest::binary>>, run, n, acc) do
    {char, rest} = escape(rest)
    string(rest, rest, 0, [acc, binary_part(run, 0, n) | char])
  end

  defp string(<<c, rest::binary>>, run, n, acc) when c >= 0x20, do: string(rest, run, n + 1, acc)
  defp string(_, _, _, _), do: throw(:invalid)

  defp escape(<<?u, h::binary-4, rest::binary>>) do
    case {hex(h), rest} do
      {hi, <<"\\u", l::binary-4, rest::binary>>} when hi in 0xD800..0xDBFF ->
        lo = hex(l)
        if lo not in 0xDC00..0xDFFF, do: throw(:invalid)
        <<cp::utf16>> = <<hi::16, lo::16>>
        {<<cp::utf8>>, rest}

      {cp, _} when cp in 0xD800..0xDFFF ->
        throw(:invalid)

      {cp, _} ->
        {<<cp::utf8>>, rest}
    end
  end

  defp escape(<<c, rest::binary>>) when c in ~c'"\\/', do: {<<c>>, rest}
  defp escape(<<?b, rest::binary>>), do: {"\b", rest}
  defp escape(<<?f, rest::binary>>), do: {"\f", rest}
  defp escape(<<?n, rest::binary>>), do: {"\n", rest}
  defp escape(<<?r, rest::binary>>), do: {"\r", rest}
  defp escape(<<?t, rest::binary>>), do: {"\t", rest}
  defp escape(_), do: throw(:invalid)

  defp hex(digits) do
    if digits =~ ~r/\A[0-9a-fA-F]{4}\z/, do: String.to_integer(digits, 16), else: throw(:invalid)
  end

  # A fraction or exponent is left as trailing data, which every caller rejects. The
  # digit-count cap keeps String.to_integer off huge inputs.
  defp number(text, sign) do
    {digits, rest} =
      case text do
        <<?0, rest::binary>> -> {"0", rest}
        <<c, _::binary>> when c in ?1..?9 -> digits(text, text, 0)
        _ -> throw(:invalid)
      end

    n = if byte_size(digits) <= 16, do: sign * String.to_integer(digits), else: throw(:invalid)
    if abs(n) > @safe, do: throw(:invalid), else: {n, rest}
  end

  defp digits(<<c, rest::binary>>, all, n) when c in ?0..?9, do: digits(rest, all, n + 1)
  defp digits(rest, all, n), do: {binary_part(all, 0, n), rest}

  # ---- encoder ----

  defp enc(nil), do: "null"
  defp enc(true), do: "true"
  defp enc(false), do: "false"
  defp enc(n) when is_integer(n) and abs(n) <= @safe, do: Integer.to_string(n)

  defp enc(s) when is_binary(s) do
    if String.valid?(s), do: [?", esc(s, s, 0, []), ?"], else: invalid(s)
  end

  defp enc(l) when is_list(l), do: [?[, Enum.map_intersperse(l, ?,, &enc/1), ?]]

  defp enc(m) when is_map(m) and not is_struct(m) do
    pairs =
      m
      |> Enum.sort()
      |> Enum.map_intersperse(?,, fn
        {k, v} when is_binary(k) -> if ascii?(k), do: [enc(k), ?:, enc(v)], else: invalid(k)
        {k, _} -> invalid(k)
      end)

    [?{, pairs, ?}]
  end

  defp enc(other), do: invalid(other)

  defp invalid(v), do: raise(ArgumentError, "not a canonical JSON value: #{inspect(v)}")

  # Same run-copying as the parser: literal bytes leave in one piece.
  defp esc(<<>>, run, n, acc), do: [acc | binary_part(run, 0, n)]

  defp esc(<<c, rest::binary>>, run, n, acc) when c < 0x20 or c in ~c'"\\',
    do: esc(rest, rest, 0, [acc, binary_part(run, 0, n) | esc_char(c)])

  defp esc(<<_, rest::binary>>, run, n, acc), do: esc(rest, run, n + 1, acc)

  defp esc_char(?"), do: "\\\""
  defp esc_char(?\\), do: "\\\\"
  defp esc_char(?\b), do: "\\b"
  defp esc_char(?\t), do: "\\t"
  defp esc_char(?\n), do: "\\n"
  defp esc_char(?\f), do: "\\f"
  defp esc_char(?\r), do: "\\r"
  defp esc_char(c), do: ["\\u00" | Base.encode16(<<c>>, case: :lower)]
end
