defmodule Loka.ContentTest do
  # The R4 cartridge compiler (14 §R4; 05 §3-§8, §11, §20; 15 CAR-02, CAR-04). Expected
  # diagnostics are hand-written literals from protocol/cartridge.schema.json; the known
  # answer is protocol/fixtures/cartridge_hash.json (Python), decoded with the stdlib JSON.
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Contracts}

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_hash.json"))
  @hello_artifact ~s({"cartridge":) <>
                    @kat["canonical"] <> ~s(,"content_hash":"#{@kat["sha256"]}"})

  @manifest %{
    "api_version" => "loka/v3",
    "id" => "c",
    "version" => "1.0.0",
    "title" => "t",
    "requires" => %{
      "kernel_api" => %{"at_least" => "1.0", "below" => "2.0"},
      "content_schema" => 1,
      "rule_ir" => 1,
      "capabilities" => %{"fact" => 1, "policy" => 1, "target_resolution" => 1, "dialogue" => 1},
      "client_features" => []
    },
    "supported_profiles" => ["offline_private"]
  }
  @fact %{
    "version" => 1,
    "value_type" => %{"type" => "bool", "default" => false},
    "scopes" => ["instance"],
    "meaning" => "m"
  }
  @present %{"op" => "target_present"}
  @talk %{
    "label" => "a",
    "target" => %{"kind" => "none"},
    "command" => "talk",
    "priority" => 0,
    "input" => [],
    "policy" => %{"policy_version" => 1, "root" => @present},
    "accessibility" => "a"
  }

  # Writes the base source (manifest, fact a.b, action talk) with `files` merged over it:
  # a value is encoded, {:raw, text} is written as is, nil removes the file.
  defp source(dir, files) do
    base = %{
      "cartridge.json" => @manifest,
      "facts.json" => %{"facts" => %{"a.b" => @fact}},
      "actions/talk.json" => @talk
    }

    for {rel, v} <- Map.merge(base, files), v != nil do
      path = Path.join(dir, rel)
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, with({:raw, text} <- v, do: text, else: (_ -> JSON.encode!(v))))
    end

    dir
  end

  defp errors(dir, files) do
    assert {:error, diags} = dir |> source(files) |> Loka.Content.compile()
    for d <- diags, do: assert(Contracts.validate("Diagnostic", d) == :ok, inspect(d))
    diags
  end

  defp d(code, path, data \\ %{}, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp ref(kind, key, version \\ "1.0.0"),
    do: %{"cartridge_id" => "c", "cartridge_version" => version, "kind" => kind, "key" => key}

  defp policy(root), do: %{"policy_version" => 1, "root" => root}
  defp manifest(path, value), do: put_in(@manifest, path, value)

  # Break: wrong key mapping, key order, hash input or artifact framing.
  test "the hello subset source compiles to the Python known answer" do
    assert Loka.Content.compile("cartridges/ashmere_hello") == {:ok, @hello_artifact}
  end

  describe "determinism (CAR-04)" do
    # Break: the canonical encoder's key sort skipped (maps over 32 keys iterate unsorted),
    # or the output depends on authored key order.
    test "reordered keys, in a map of 40, give identical bytes; a changed byte does not",
         %{tmp_dir: tmp} do
      names = for i <- 10..49, do: "f.#{i}"
      obj = &("{" <> Enum.map_join(&1, ",", fn {k, v} -> JSON.encode!(k) <> ":" <> v end) <> "}")
      facts = &obj.([{"facts", obj.(for n <- &1, do: {n, JSON.encode!(&2)})}])
      manifest = @manifest |> Enum.reverse() |> Enum.map(fn {k, v} -> {k, JSON.encode!(v)} end)

      compile = fn dir, files ->
        assert {:ok, bytes} = Loka.Content.compile(source(Path.join(tmp, dir), files))
        bytes
      end

      a = compile.("a", %{"facts.json" => {:raw, facts.(names, @fact)}})
      assert Loka.Content.compile(Path.join(tmp, "a")) == {:ok, a}

      b =
        compile.("b", %{
          "facts.json" => {:raw, facts.(Enum.reverse(names), @fact)},
          "cartridge.json" => {:raw, obj.(manifest)}
        })

      changed =
        compile.("c", %{"facts.json" => {:raw, facts.(names, %{@fact | "meaning" => "n"})}})

      assert a == b
      assert changed != a
    end
  end

  describe "one diagnostic per code" do
    test "INVALID_JSON: unparsable text or trailing data", %{tmp_dir: tmp} do
      assert errors(tmp, %{"facts.json" => {:raw, "{"}}) == [d("INVALID_JSON", "facts")]
      assert errors(tmp, %{"facts.json" => {:raw, "{} x"}}) == [d("INVALID_JSON", "facts")]
    end

    # Break: Elixir's JSON keeps the first of a repeated key silently.
    test "DUPLICATE_KEY at the repeated member, reported once", %{tmp_dir: tmp} do
      text =
        String.replace(
          JSON.encode!(@talk),
          ~s("kind":"none"),
          ~s("kind":"none","kind":"a","kind":"b")
        )

      assert errors(tmp, %{"actions/talk.json" => {:raw, text}}) ==
               [d("DUPLICATE_KEY", "actions/talk.target.kind")]
    end

    test "UNKNOWN_FIELD: a stray .json file, an authored key, an unregistered field",
         %{tmp_dir: tmp} do
      assert errors(tmp, %{
               "polices/x.json" => policy(@present),
               "actions/talk.json" => Map.put(@talk, "key", "talk"),
               "cartridge.json" => Map.put(@manifest, "entry", %{})
             }) == [
               d("UNKNOWN_FIELD", "actions/talk.key"),
               d("UNKNOWN_FIELD", "cartridge.entry"),
               d("UNKNOWN_FIELD", "polices/x")
             ]
    end

    test "SCHEMA_VIOLATION carries the ErrorCode; array steps and literal sources",
         %{tmp_dir: tmp} do
      assert errors(tmp, %{
               "actions/talk.json" => %{@talk | "input" => ["bogus"]},
               "policies/Bad Name.json" => policy(@present)
             }) == [
               d("SCHEMA_VIOLATION", ~S("policies/Bad Name.json"), %{
                 "error" => "pattern_mismatch"
               }),
               d("SCHEMA_VIOLATION", "actions/talk.input[0]", %{"error" => "not_in_enum"})
             ]
    end

    # IMPORT.md: the 64-character limit applies after each . becomes _.
    test "SCHEMA_VIOLATION: a fact name of 65 characters after mapping", %{tmp_dir: tmp} do
      ok = String.duplicate("a", 31) <> "." <> String.duplicate("b", 32)
      long = ok <> "c"

      assert errors(tmp, %{"facts.json" => %{"facts" => %{ok => @fact, long => @fact}}}) ==
               [d("SCHEMA_VIOLATION", ~s(facts.facts["#{long}"]), %{"error" => "too_long"})]
    end

    test "MISSING_MANIFEST", %{tmp_dir: tmp} do
      assert errors(tmp, %{"cartridge.json" => nil}) == [d("MISSING_MANIFEST", "cartridge")]
    end

    test "FACT_NAME_COLLISION at every name mapping to one key", %{tmp_dir: tmp} do
      assert errors(tmp, %{"facts.json" => %{"facts" => %{"a.b" => @fact, "a_b" => @fact}}}) ==
               [
                 d("FACT_NAME_COLLISION", "facts.facts.a_b"),
                 d("FACT_NAME_COLLISION", ~s(facts.facts["a.b"]))
               ]
    end

    test "FACT_DEFAULT_INVALID: enum default not a value, int default out of bounds",
         %{tmp_dir: tmp} do
      enum = %{@fact | "value_type" => %{"type" => "enum", "values" => ["x"], "default" => "y"}}
      int = %{@fact | "value_type" => %{"type" => "int", "maximum" => 3, "default" => 4}}
      ok = %{@fact | "value_type" => %{"type" => "int", "minimum" => 4, "default" => 4}}

      assert errors(tmp, %{"facts.json" => %{"facts" => %{"e" => enum, "i" => int, "k" => ok}}}) ==
               [
                 d("FACT_DEFAULT_INVALID", "facts.facts.e.value_type.default"),
                 d("FACT_DEFAULT_INVALID", "facts.facts.i.value_type.default")
               ]
    end

    # CAR-02: a missing reference names its file and field path.
    test "UNRESOLVED_REFERENCE: a missing fact, another version, an unfrozen kind",
         %{tmp_dir: tmp} do
      root = %{
        "op" => "all",
        "items" => [
          %{"op" => "fact_compare", "fact" => ref("fact", "missing"), "equals" => true},
          %{"op" => "fact_compare", "fact" => ref("fact", "a_b", "2.0.0"), "equals" => true},
          %{"op" => "fact_compare", "fact" => ref("fact", "a_b"), "equals" => true}
        ]
      }

      talk = %{@talk | "policy" => policy(%{"op" => "has_item", "item" => ref("item", "x")})}
      caps = Map.put(@manifest["requires"]["capabilities"], "containment", 1)

      assert errors(tmp, %{
               "policies/p.json" => policy(root),
               "actions/talk.json" => talk,
               "cartridge.json" => manifest(["requires", "capabilities"], caps)
             }) == [
               d("UNRESOLVED_REFERENCE", "actions/talk.policy.root.item", %{
                 "target" => "c@1.0.0:item/x"
               }),
               d("UNRESOLVED_REFERENCE", "policies/p.root.items[0].fact", %{
                 "target" => "c@1.0.0:fact/missing"
               }),
               d("UNRESOLVED_REFERENCE", "policies/p.root.items[1].fact", %{
                 "target" => "c@2.0.0:fact/a_b"
               })
             ]
    end

    test "UNKNOWN_COMMAND", %{tmp_dir: tmp} do
      assert errors(tmp, %{"actions/talk.json" => %{@talk | "command" => "fly"}}) ==
               [d("UNKNOWN_COMMAND", "actions/talk.command")]
    end

    test "FACT_TYPE_MISMATCH: wrong JSON type, enum value not listed", %{tmp_dir: tmp} do
      enum = %{@fact | "value_type" => %{"type" => "enum", "values" => ["x"], "default" => "x"}}
      compare = &%{"op" => "fact_compare", "fact" => ref("fact", &1), "equals" => &2}

      assert errors(tmp, %{
               "facts.json" => %{"facts" => %{"a.b" => @fact, "e" => enum}},
               "policies/p.json" => policy(compare.("a_b", "true")),
               "policies/q.json" => policy(compare.("e", "y")),
               "policies/r.json" => policy(compare.("e", "x"))
             }) == [
               d("FACT_TYPE_MISMATCH", "policies/p.root.equals"),
               d("FACT_TYPE_MISMATCH", "policies/q.root.equals")
             ]
    end

    test "UNKNOWN_CAPABILITY: an unregistered key or version", %{tmp_dir: tmp} do
      caps = Map.merge(@manifest["requires"]["capabilities"], %{"weather" => 1, "fact" => 2})

      assert errors(tmp, %{"cartridge.json" => manifest(["requires", "capabilities"], caps)}) == [
               d("UNKNOWN_CAPABILITY", "cartridge.requires.capabilities.fact"),
               d("UNKNOWN_CAPABILITY", "cartridge.requires.capabilities.weather")
             ]
    end

    # C4: an offline_private cartridge may not require a server_only capability; the
    # protocol registry has none yet, so the test injects one.
    test "SERVER_ONLY_CAPABILITY under offline_private only", %{tmp_dir: tmp} do
      server = %{"key" => "trade", "version" => 1, "portability" => "server_only"}
      registry = [server | JSON.decode!(File.read!("protocol/capability_registry.json"))]
      caps = Map.put(@manifest["requires"]["capabilities"], "trade", 1)
      m = manifest(["requires", "capabilities"], caps)

      online =
        source(Path.join(tmp, "online"), %{
          "cartridge.json" => %{m | "supported_profiles" => ["online_private"]}
        })

      assert {:ok, _} = Loka.Content.compile(online, registry: registry)

      offline = source(Path.join(tmp, "offline"), %{"cartridge.json" => m})

      assert Loka.Content.compile(offline, registry: registry) ==
               {:error, [d("SERVER_ONLY_CAPABILITY", "cartridge.requires.capabilities.trade")]}
    end

    # Break: comparing versions as strings ("1.10" < "1.9").
    test "KERNEL_API_RANGE_INVALID: empty or reversed range", %{tmp_dir: tmp} do
      for {low, high} <- [{"2.0", "2.0"}, {"1.10", "1.9"}] do
        range = %{"at_least" => low, "below" => high}
        files = %{"cartridge.json" => manifest(["requires", "kernel_api"], range)}

        assert errors(tmp, files) == [
                 d("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api")
               ]
      end

      range = %{"at_least" => "1.9", "below" => "1.10"}

      assert {:ok, _} =
               Loka.Content.compile(
                 source(tmp, %{"cartridge.json" => manifest(["requires", "kernel_api"], range)})
               )
    end

    test "PINNED_VERSION_UNSUPPORTED", %{tmp_dir: tmp} do
      assert errors(tmp, %{"cartridge.json" => manifest(["requires", "rule_ir"], 2)}) == [
               d("PINNED_VERSION_UNSUPPORTED", "cartridge.requires.rule_ir", %{
                 "field" => "rule_ir",
                 "declared" => 2,
                 "supported" => 1
               })
             ]
    end

    test "UNDECLARED_CAPABILITY: an action's command and a policy op", %{tmp_dir: tmp} do
      caps = %{"fact" => 1, "policy" => 1}

      assert errors(tmp, %{"cartridge.json" => manifest(["requires", "capabilities"], caps)}) == [
               %{
                 "severity" => "error",
                 "code" => "UNDECLARED_CAPABILITY",
                 "path" => "actions/talk.command",
                 "message_key" => "diagnostics.undeclared_capability",
                 "data" => %{"capability" => "dialogue"},
                 "suggested_capabilities" => ["dialogue@1"]
               },
               d(
                 "UNDECLARED_CAPABILITY",
                 "actions/talk.policy.root.op",
                 %{"capability" => "target_resolution"},
                 ["target_resolution@1"]
               )
             ]
    end

    # loka-numeric-v1 nests at most 128 containers. The artifact, its cartridge and the
    # policies map hold 3; a policy file holds 2 plus one per not: 123 nots fill it exactly.
    test "NESTING_TOO_DEEP at the definition; one level less compiles and decodes",
         %{tmp_dir: tmp} do
      nots = fn n ->
        Enum.reduce(1..n, @present, fn _, acc -> %{"op" => "not", "item" => acc} end)
      end

      ok = source(Path.join(tmp, "ok"), %{"policies/p.json" => policy(nots.(123))})
      assert {:ok, bytes} = Loka.Content.compile(ok)
      assert {:ok, _} = Canonical.decode(bytes)

      assert errors(Path.join(tmp, "deep"), %{"policies/p.json" => policy(nots.(124))}) ==
               [d("NESTING_TOO_DEEP", "policies/p", %{"maximum" => 128})]
    end

    test "ARTIFACT_TOO_LARGE above the cap, never at it" do
      size = byte_size(@hello_artifact)

      assert Loka.Content.compile("cartridges/ashmere_hello", max_bytes: size) ==
               {:ok, @hello_artifact}

      assert Loka.Content.compile("cartridges/ashmere_hello", max_bytes: size - 1) ==
               {:error, [d("ARTIFACT_TOO_LARGE", "", %{"bytes" => size, "maximum" => size - 1})]}
    end
  end

  # Break: the task writes other bytes than compile/2 returns, or writes on error.
  test "mix loka.compile writes the artifact, and nothing on error", %{tmp_dir: tmp} do
    out = Path.join(tmp, "hello.json")
    Mix.Tasks.Loka.Compile.run(["cartridges/ashmere_hello", out])
    assert File.read!(out) == @hello_artifact

    bad = source(Path.join(tmp, "bad"), %{"cartridge.json" => nil})
    missing = Path.join(tmp, "bad.json")

    ExUnit.CaptureIO.capture_io(:stderr, fn ->
      assert catch_exit(Mix.Tasks.Loka.Compile.run([bad, missing])) == {:shutdown, 1}
    end)

    refute File.exists?(missing)
  end

  # Break: sorting by file, by code first, or not at all.
  test "diagnostics from several files come in path, then code order", %{tmp_dir: tmp} do
    assert errors(tmp, %{
             "facts.json" => %{"facts" => %{"A.b" => @fact, "A_b" => @fact}},
             "actions/talk.json" => %{@talk | "command" => "fly"},
             "cartridge.json" => manifest(["requires", "rule_ir"], 2),
             "polices/x.json" => {:raw, "{"}
           }) == [
             d("UNKNOWN_COMMAND", "actions/talk.command"),
             d("PINNED_VERSION_UNSUPPORTED", "cartridge.requires.rule_ir", %{
               "field" => "rule_ir",
               "declared" => 2,
               "supported" => 1
             }),
             d("FACT_NAME_COLLISION", ~s(facts.facts["A.b"])),
             d("SCHEMA_VIOLATION", ~s(facts.facts["A.b"]), %{"error" => "pattern_mismatch"}),
             d("FACT_NAME_COLLISION", ~s(facts.facts["A_b"])),
             d("SCHEMA_VIOLATION", ~s(facts.facts["A_b"]), %{"error" => "pattern_mismatch"}),
             d("UNKNOWN_FIELD", "polices/x")
           ]
  end
end
