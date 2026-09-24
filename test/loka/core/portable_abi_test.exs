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
      assert Canonical.encode(value) == {:ok, expected}
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
  # non-ASCII keys, trailing data, missing colon, duplicates spelled with escapes, and
  # a dropped short escape on input.
  test "decode edge cases" do
    assert Canonical.decode(~S(["😀",-9007199254740991])) == {:ok, ["😀", -9_007_199_254_740_991]}

    for text <- [
          ~S(["\udc00"]),
          "[\"\x01\"]",
          "-9007199254740992",
          "01",
          ~S({"é":1}),
          "[1]x",
          ~S({"a":1,"\u0061":2}),
          "[1 2]",
          ~S({"a":1 "b":2}),
          "",
          ~S({"a",1})
        ] do
      assert Canonical.decode(text) == {:error, :invalid_json}, text
    end

    assert Canonical.decode(nil) == {:error, :invalid_json}
    assert Canonical.decode(~S("\b\f\n\r\t\"\\\/")) == {:ok, "\b\f\n\r\t\"\\/"}
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
             {:ok,
              ~S({"10":5,"9":4,"B":2,"a":3,"b":1,"s":"\u0001\u001f\b\t\n\f\r\"\\/) <> "\x7f幻\"}"}
  end

  # Catches relying on map iteration order: Elixir maps over 32 keys are hash-ordered.
  test "encode sorts keys of large maps" do
    keys = for i <- 10..42, do: "k#{i}"
    expected = "{" <> Enum.map_join(keys, ",", &~s("#{&1}":0)) <> "}"
    assert Canonical.encode(Map.new(keys, &{&1, 0})) == {:ok, expected}
  end

  # Catches an encoder that silently emits floats, unsafe integers, invalid UTF-8 or bad keys.
  test "encode rejects values outside the profile" do
    for v <- [1.5, 9_007_199_254_740_992, <<0xFF>>, %{"é" => 1}, %{a: 1}, :atom] do
      assert Canonical.encode(v) == {:error, :invalid_canonical}, inspect(v)
    end
  end

  # Catches a missing or off-by-one depth limit: without one, how deep a value may nest
  # depends on the host's stack, and the two kernels disagree.
  test "nesting is limited to 128 containers" do
    nest = fn n -> String.duplicate("[", n) <> String.duplicate("]", n) end
    assert {:ok, deepest} = Canonical.decode(nest.(128))
    assert Canonical.encode(deepest) == {:ok, nest.(128)}
    assert Canonical.decode(nest.(129)) == {:error, :invalid_json}
    assert Canonical.encode([deepest]) == {:error, :invalid_canonical}
    assert Canonical.encode(%{"a" => deepest}) == {:error, :invalid_canonical}
  end

  # Expected: printf '%s' '<canonical>' | shasum -a 256
  test "hash is lowercase SHA-256 of the canonical bytes" do
    # '{"a":"x","b":1}'
    assert Canonical.hash(%{"b" => 1, "a" => "x"}) ==
             {:ok, "cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246"}

    # '["é幻😀𠀋",-7]': 2-, 3- and 4-byte UTF-8, above U+1FFFF too
    assert Canonical.hash(["é幻😀𠀋", -7]) ==
             {:ok, "6770c1e57b41f706835d6999cca3df572ac681152db03d185adf8916be83fed6"}

    # 55 bytes: the largest message whose padding fits one block
    assert Canonical.hash(String.duplicate("a", 53)) ==
             {:ok, "2ae89a8121a3f9d2709899b414da4c60234316951093ce35f41ce954a09533f4"}

    # a 56-byte message: padding spills into a second block
    assert Canonical.hash(String.duplicate("a", 54)) ==
             {:ok, "9b68496ab8c784a9ed22d25a7e3aada1736d7097061bb3149f3d66f1e22ceeef"}

    # 120 bytes: one whole block read in place, then a padded tail
    assert Canonical.hash(String.duplicate("a", 118)) ==
             {:ok, "decf5e51fc0969aa2a06512dde0d3521a7ecd297ea81212ca626a65d2d4a1716"}
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

  # Catches a crash (or a different code than TypeScript) on operands that are not safe
  # integers, including the operand check running after the zero-divisor check.
  test "unsafe operands are integer_overflow" do
    for {a, b} <- [{9_007_199_254_740_992, 1}, {1, 1.5}, {true, 1}] do
      for op <- [&Int.add/2, &Int.sub/2, &Int.mul/2, &Int.divide/2] do
        assert op.(a, b) == {:error, :integer_overflow}, inspect({op, a, b})
      end
    end

    assert Int.divide(1.5, 0) == {:error, :integer_overflow}
  end

  # Catches the kernels diverging at the contract edge: a bad budget must be a typed
  # error (same code as TypeScript), not a crash or an immediate budget exhaustion.
  test "uniform rejects a bad draw budget" do
    for budget <- [-1, 1.5, true, nil] do
      assert Rng.uniform([1, 2, 3, 4], 10, budget) == {:error, :invalid_rng_budget},
             inspect(budget)
    end
  end

  # Catches non-string ids crashing, or hashing to an id, instead of TypeScript's typed error.
  test "IdSource rejects non-string ids" do
    assert IdSource.id(1, "c-1", 0) == {:error, :invalid_id}
    assert IdSource.id("w-1", nil, 0) == {:error, :invalid_id}
  end

  # Catches an unsafe ordinal crashing or hashing instead of the typed error TypeScript uses.
  test "IdSource rejects a bad ordinal" do
    for ordinal <- [-1, 9_007_199_254_740_992, 1.0, true] do
      assert IdSource.id("w-1", "c-1", ordinal) == {:error, :invalid_ordinal}, inspect(ordinal)
    end
  end

  # Expected values, computed independently with Python:
  #   python3 -c 'import hashlib,json,sys; w,c,o=sys.argv[1],sys.argv[2],int(sys.argv[3]);
  #   h=bytearray(hashlib.sha256(json.dumps(["loka-id-v1",w,c,o],separators=(",",":"),
  #   ensure_ascii=False).encode()).digest()[:16]); h[6]=h[6]&15|128; h[8]=h[8]&63|128;
  #   x=h.hex(); print("-".join([x[:8],x[8:12],x[12:16],x[16:20],x[20:]]))' w-1 c-1 0
  test "IdSource ids" do
    assert IdSource.id("w-1", "c-1", 0) == {:ok, "eab7cf24-f843-8907-ab7a-610cf750dbe5"}
    assert IdSource.id("w-1", "c-1", 1) == {:ok, "c47e5589-bb15-82c7-8492-7c392ee99f8d"}

    assert IdSource.id("世界", "c\"1", 9_007_199_254_740_991) ==
             {:ok, "1711b795-4ff1-81d8-a547-80b2011ee4d1"}
  end
end
