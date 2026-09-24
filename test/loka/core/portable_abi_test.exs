defmodule Loka.Core.PortableAbiTest do
  # Frozen fixtures from docs/spec/IMPORT.md, read in place and decoded with the stdlib JSON
  # so expected values never pass through the code under test.
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, IdSource, Int, Rng}

  fixture = fn path, sha ->
    bytes = File.read!(path)
    actual = :crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower)
    if actual != sha, do: raise("#{path} hash #{actual}, expected #{sha} (docs/spec/IMPORT.md)")
    JSON.decode!(bytes)
  end

  @vectors fixture.(
             "docs/spec/conformance/numeric-vectors.json",
             "85472ae4e7626ca7326b881766e21ae23dd253c82b5c9d4c8d0c86f89ee168c9"
           )
  @adverse fixture.(
             "docs/spec/conformance/adverse-cases.json",
             "1b699cf2ce71181a2b09a596ed2253c06caa435aad4b5eb8a8ea9601fbadf5b1"
           )

  test "numeric-vectors: rng_steps from initial_rng" do
    Enum.reduce(@vectors["rng_steps"], @vectors["initial_rng"], fn %{
                                                                     "raw" => raw,
                                                                     "state" => next
                                                                   },
                                                                   state ->
      assert Rng.next(state) == {:ok, raw, next}
      next
    end)
  end

  test "numeric-vectors: division" do
    for %{"a" => a, "b" => b, "q" => q, "r" => r} <- @vectors["division"] do
      assert Int.divide(a, b) == {:ok, q, r}, "#{a} / #{b}"
    end
  end

  test "numeric-vectors: invalid_json" do
    for text <- @vectors["invalid_json"],
        do: assert(Canonical.decode(text) == {:error, :invalid_json}, text)
  end

  test "numeric-vectors: canonical" do
    for %{"input" => input, "expected" => expected} <- @vectors["canonical"] do
      assert {:ok, value} = Canonical.decode(input)
      assert Canonical.encode(value) == expected
    end
  end

  test "adverse-cases: uniform" do
    for row <- @adverse["uniform"] do
      expected =
        case row do
          %{"error" => e} -> {:error, String.to_atom(e)}
          %{"value" => v, "next_state" => s} -> {:ok, v, s}
        end

      assert Rng.uniform(row["state"], row["bound"], row["max_draws"]) == expected, inspect(row)
    end
  end

  # Catches an off-by-one that rejects the top bound 2^32, where every draw is accepted:
  # the answer is the first raw draw and state of numeric-vectors rng_steps.
  test "uniform accepts bound 2^32" do
    assert Rng.uniform([1, 2, 3, 4], 4_294_967_296, 1) == {:ok, 11520, [7, 0, 1026, 12288]}
  end

  # Catches missing strictness the fixtures do not reach: lowercase surrogate-pair escapes,
  # lone low surrogates, raw control characters, negative range edge, leading zeros,
  # non-ASCII keys, trailing data.
  test "decode edge cases" do
    assert Canonical.decode(~S(["😀",-9007199254740991])) == {:ok, ["😀", -9_007_199_254_740_991]}

    for text <- [
          ~S(["\udc00"]),
          "[\"\x01\"]",
          "-9007199254740992",
          "01",
          ~S({"é":1}),
          "[1]x",
          "",
          ~S({"a" 1})
        ] do
      assert Canonical.decode(text) == {:error, :invalid_json}, text
    end
  end

  # Catches wrong escapes (uppercase hex, \u0008 for \b, escaping / or non-ASCII) and key
  # order that is not ordinal (numeric-looking keys first, case-insensitive).
  test "encode escapes and key order" do
    value = %{
      "b" => 1,
      "B" => 2,
      "a" => 3,
      "9" => 4,
      "10" => 5,
      "s" => "\x01\x1f\b\t\n\f\r\"\\/\x7f幻"
    }

    assert Canonical.encode(value) ==
             ~S({"10":5,"9":4,"B":2,"a":3,"b":1,"s":"\u0001\u001f\b\t\n\f\r\"\\/) <> "\x7f幻\"}"
  end

  # Catches relying on map iteration order: Elixir maps over 32 keys are hash-ordered.
  test "encode sorts keys of large maps" do
    keys = for i <- 10..42, do: "k#{i}"
    expected = "{" <> Enum.map_join(keys, ",", &~s("#{&1}":0)) <> "}"
    assert Canonical.encode(Map.new(keys, &{&1, 0})) == expected
  end

  # Catches an encoder that silently emits floats, unsafe integers, invalid UTF-8 or bad keys.
  test "encode rejects values outside the profile" do
    for v <- [1.5, 9_007_199_254_740_992, <<0xFF>>, %{"é" => 1}, %{a: 1}, :atom] do
      assert_raise ArgumentError, fn -> Canonical.encode(v) end
    end
  end

  # Expected: printf '%s' '<canonical>' | shasum -a 256
  test "hash is lowercase SHA-256 of the canonical bytes" do
    # '{"a":"x","b":1}'
    assert Canonical.hash(%{"b" => 1, "a" => "x"}) ==
             "cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246"

    # '["é幻😀",-7]': 2-, 3- and 4-byte UTF-8
    assert Canonical.hash(["é幻😀", -7]) ==
             "6416a19771baa45dc6d75fa8729efce39f1f0168ee11e76808d86d2bdc6c1463"

    # a 56-byte message: padding spills into a second block
    assert Canonical.hash(String.duplicate("a", 54)) ==
             "9b68496ab8c784a9ed22d25a7e3aada1736d7097061bb3149f3d66f1e22ceeef"
  end

  test "checked integers overflow as a typed error" do
    max = 9_007_199_254_740_991
    assert Int.add(max, 0) == {:ok, max}
    assert Int.add(max, 1) == {:error, :integer_overflow}
    assert Int.sub(-max, 1) == {:error, :integer_overflow}
    assert Int.mul(-max, -1) == {:ok, max}
    assert Int.mul(94_906_266, 94_906_266) == {:error, :integer_overflow}
    assert Int.divide(1, 0) == {:error, :division_by_zero}
  end

  # Expected values, computed independently with Python:
  #   python3 -c 'import hashlib,json,sys; w,c,o=sys.argv[1],sys.argv[2],int(sys.argv[3]);
  #   h=bytearray(hashlib.sha256(json.dumps(["loka-id-v1",w,c,o],separators=(",",":"),
  #   ensure_ascii=False).encode()).digest()[:16]); h[6]=h[6]&15|128; h[8]=h[8]&63|128;
  #   x=h.hex(); print("-".join([x[:8],x[8:12],x[12:16],x[16:20],x[20:]]))' w-1 c-1 0
  test "IdSource ids" do
    assert IdSource.id("w-1", "c-1", 0) == "eab7cf24-f843-8907-ab7a-610cf750dbe5"
    assert IdSource.id("w-1", "c-1", 1) == "c47e5589-bb15-82c7-8492-7c392ee99f8d"

    assert IdSource.id("世界", "c\"1", 9_007_199_254_740_991) ==
             "1711b795-4ff1-81d8-a547-80b2011ee4d1"
  end
end
