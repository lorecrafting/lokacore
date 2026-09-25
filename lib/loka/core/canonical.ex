defmodule Loka.Core.Canonical do
  @moduledoc """
  Strict JSON parser, canonical encoder and SHA-256 for the portable profile
  (`docs/spec/conformance/numeric-profile.md`).

  Values are `nil`, booleans, safe integers, UTF-8 binaries, lists and maps with ASCII
  binary keys. Both directions are linear in the input size.
  """
  @safe 9_007_199_254_740_991
  @max_depth 128

  @type value :: nil | boolean() | integer() | binary() | [value()] | %{binary() => value()}

  @doc "An integer in the profile's safe range, [-(2^53 - 1), 2^53 - 1]."
  defguard is_safe_integer(n) when is_integer(n) and abs(n) <= @safe

  @doc """
  Parses JSON text. Rejects duplicate or non-ASCII keys, fractions, exponents, NaN and
  Infinity, integers outside the safe range, lone surrogates, invalid UTF-8, nesting deeper
  than #{@max_depth} and trailing data. `-0` parses as `0`.
  """
  @spec decode(term()) :: {:ok, value()} | {:error, :invalid_json}
  def decode(text) when is_binary(text) do
    # String.valid? also rejects UTF-8-encoded surrogates.
    with true <- String.valid?(text), {v, rest} <- value(ws(text), 0), "" <- ws(rest) do
      {:ok, v}
    else
      _ -> {:error, :invalid_json}
    end
  catch
    :invalid -> {:error, :invalid_json}
  end

  def decode(_), do: {:error, :invalid_json}

  @doc "Canonical text: sorted keys, no whitespace. `:invalid_canonical` for a value outside the profile."
  @spec encode(term()) :: {:ok, binary()} | {:error, :invalid_canonical}
  def encode(value) do
    {:ok, :binary.list_to_bin([enc(value, 0)])}
  catch
    :invalid -> {:error, :invalid_canonical}
  end

  @doc "Lowercase hex SHA-256 of the canonical encoding."
  @spec hash(term()) :: {:ok, String.t()} | {:error, :invalid_canonical}
  def hash(value) do
    with {:ok, bytes} <- encode(value),
         do: {:ok, :crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower)}
  end

  # ---- parser ----
  # `depth` counts the containers already open around the value being parsed.

  defp ws(<<c, rest::binary>>) when c in ~c" \t\n\r", do: ws(rest)
  defp ws(rest), do: rest

  defp value(<<c, _::binary>>, @max_depth) when c in ~c"{[", do: throw(:invalid)
  defp value(<<?{, rest::binary>>, depth), do: object(ws(rest), %{}, depth + 1)
  defp value(<<?[, rest::binary>>, depth), do: array(ws(rest), [], depth + 1)
  defp value(<<?", rest::binary>>, _), do: string(rest, rest, 0, [])
  defp value(<<"true", rest::binary>>, _), do: {true, rest}
  defp value(<<"false", rest::binary>>, _), do: {false, rest}
  defp value(<<"null", rest::binary>>, _), do: {nil, rest}
  defp value(<<?-, rest::binary>>, _), do: number(rest, -1)
  defp value(rest, _), do: number(rest, 1)

  defp object(<<?}, rest::binary>>, acc, _) when acc == %{}, do: {acc, rest}

  defp object(<<?", rest::binary>>, acc, depth) do
    {key, rest} = key(rest, acc)
    {v, rest} = value(colon(ws(rest)), depth)
    acc = Map.put(acc, key, v)

    case ws(rest) do
      <<?,, rest::binary>> -> object(ws(rest), acc, depth)
      <<?}, rest::binary>> -> {acc, rest}
      _ -> throw(:invalid)
    end
  end

  defp object(_, _, _), do: throw(:invalid)

  # Duplicates are detected after escape decoding.
  defp key(text, acc) do
    {key, rest} = string(text, text, 0, [])
    if Map.has_key?(acc, key) or not ascii?(key), do: throw(:invalid), else: {key, rest}
  end

  defp colon(<<?:, rest::binary>>), do: ws(rest)
  defp colon(_), do: throw(:invalid)

  defp array(<<?], rest::binary>>, [], _), do: {[], rest}

  defp array(text, acc, depth) do
    {v, rest} = value(text, depth)

    case ws(rest) do
      <<?,, rest::binary>> -> array(ws(rest), [v | acc], depth)
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
    if is_safe_integer(n), do: {n, rest}, else: throw(:invalid)
  end

  defp digits(<<c, rest::binary>>, all, n) when c in ?0..?9, do: digits(rest, all, n + 1)
  defp digits(rest, all, n), do: {binary_part(all, 0, n), rest}

  # ---- encoder ----

  defp enc(nil, _), do: "null"
  defp enc(true, _), do: "true"
  defp enc(false, _), do: "false"
  defp enc(n, _) when is_safe_integer(n), do: Integer.to_string(n)

  defp enc(s, _) when is_binary(s) do
    if String.valid?(s), do: [?", esc(s, s, 0, []), ?"], else: throw(:invalid)
  end

  defp enc(v, @max_depth) when is_list(v) or is_map(v), do: throw(:invalid)

  defp enc(l, depth) when is_list(l),
    do: [?[, Enum.map_intersperse(l, ?,, &enc(&1, depth + 1)), ?]]

  defp enc(m, depth) when is_map(m) and not is_struct(m) do
    pairs =
      m
      |> Enum.sort()
      |> Enum.map_intersperse(?,, fn
        {k, v} when is_binary(k) ->
          if ascii?(k), do: [enc(k, depth), ?:, enc(v, depth + 1)], else: throw(:invalid)

        _ ->
          throw(:invalid)
      end)

    [?{, pairs, ?}]
  end

  defp enc(_, _), do: throw(:invalid)

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
