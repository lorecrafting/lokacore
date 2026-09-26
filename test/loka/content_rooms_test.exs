defmodule Loka.ContentRoomsTest do
  # Rooms, exits, the entry room and the text catalog (R5 S1; 05 §17, §18; 21 §5). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode; the known
  # answer is protocol/fixtures/cartridge_rooms_hash.json (Python), decoded with the stdlib JSON.
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_rooms_hash.json"))
  @details_kat JSON.decode!(File.read!("protocol/fixtures/cartridge_details_hash.json"))
  @facts_kat JSON.decode!(File.read!("protocol/fixtures/cartridge_facts_hash.json"))

  defp ref(key, kind \\ "room"),
    do: %{"cartridge_id" => "c", "cartridge_version" => "1.0.0", "kind" => kind, "key" => key}

  @manifest %{
    "api_version" => "loka/v3",
    "id" => "c",
    "version" => "1.0.0",
    "title" => "t",
    "requires" => %{
      "kernel_api" => %{"at_least" => "1.0", "below" => "2.0"},
      "content_schema" => 1,
      "rule_ir" => 1,
      "capabilities" => %{"movement" => 1, "inspectable_detail" => 1},
      "client_features" => []
    },
    "supported_profiles" => ["offline_private"]
  }

  defp room(exits), do: %{"title" => "r.t", "description" => "r.d", "exits" => exits}

  # A two-room source (a north to b), with `files` merged over it; nil removes a file.
  defp compile(dir, files) do
    base = %{
      "cartridge.json" => Map.put(@manifest, "entry", ref("a")),
      "rooms/a.json" => room(%{"north" => %{"to" => ref("b")}}),
      "rooms/b.json" => room(%{}),
      "text.json" => %{"r.t" => "Room", "r.d" => "A room."}
    }

    for {rel, v} <- Map.merge(base, files), v != nil do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
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

  # Breaks if the v2 payload drops or renames a field, or keys rooms wrongly.
  test "ashmere_rooms compiles to the Python known answer" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_rooms") == {:ok, expected}
  end

  test "a two-room source compiles to v2 with its entry and text", %{tmp_dir: dir} do
    assert {:ok, bytes} = compile(dir, %{})
    %{"cartridge" => c} = JSON.decode!(bytes)
    assert c["format"] == "loka-cartridge-v2"
    assert Map.keys(c["rooms"]) == ["c@1.0.0:room/a", "c@1.0.0:room/b"]
    assert c["rooms"]["c@1.0.0:room/a"]["key"] == "a"
    assert c["entry"] == ref("a")
    refute Map.has_key?(c["manifest"], "entry")
  end

  test "an exit or entry naming no room is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    files = %{
      "cartridge.json" => Map.put(@manifest, "entry", ref("nowhere")),
      "rooms/a.json" =>
        room(%{"north" => %{"to" => ref("x")}, "up" => %{"to" => ref("b", "fact")}})
    }

    assert compile(dir, files) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "cartridge.entry", %{"target" => "c@1.0.0:room/nowhere"}),
                d("UNRESOLVED_REFERENCE", "rooms/a.exits.north.to", %{
                  "target" => "c@1.0.0:room/x"
                }),
                d("UNRESOLVED_REFERENCE", "rooms/a.exits.up.to", %{"target" => "c@1.0.0:fact/b"})
              ]}
  end

  # Short references (owner decision 2026-09-25); ashmere_details' known answer covers the
  # resolved case. Break: a short exit or entry is expanded to another kind or not checked.
  test "a short exit or entry naming no room is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    files = %{
      "cartridge.json" => Map.put(@manifest, "entry", "nowhere"),
      "rooms/a.json" => room(%{"north" => %{"to" => "b"}, "up" => %{"to" => "x"}})
    }

    assert compile(dir, files) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "cartridge.entry", %{"target" => "c@1.0.0:room/nowhere"}),
                d("UNRESOLVED_REFERENCE", "rooms/a.exits.up.to", %{"target" => "c@1.0.0:room/x"})
              ]}
  end

  test "a room without movement required is UNDECLARED_CAPABILITY", %{tmp_dir: dir} do
    m = put_in(@manifest, ["requires", "capabilities"], %{"fact" => 1})

    assert compile(dir, %{"cartridge.json" => Map.put(m, "entry", ref("a"))}) ==
             {:error,
              [
                d("UNDECLARED_CAPABILITY", "rooms/a", %{"capability" => "movement"}, [
                  "movement@1"
                ]),
                d("UNDECLARED_CAPABILITY", "rooms/b", %{"capability" => "movement"}, [
                  "movement@1"
                ])
              ]}
  end

  test "a text key without a catalog entry is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    assert compile(dir, %{"text.json" => %{"r.t" => "Room"}}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/a.description", %{"target" => "r.d"}),
                d("UNRESOLVED_REFERENCE", "rooms/b.description", %{"target" => "r.d"})
              ]}
  end

  test "rooms without an entry, a bad direction and empty text are rejected", %{tmp_dir: dir} do
    files = %{
      "cartridge.json" => @manifest,
      "rooms/b.json" => room(%{"northeast" => %{"to" => ref("a")}}),
      "text.json" => %{"r.t" => "Room", "r.d" => ""}
    }

    assert compile(dir, files) ==
             {:error,
              [
                d("SCHEMA_VIOLATION", "cartridge.entry", %{"error" => "missing_property"}),
                d("UNKNOWN_FIELD", "rooms/b.exits.northeast"),
                d("SCHEMA_VIOLATION", "text[\"r.d\"]", %{"error" => "too_short"})
              ]}
  end

  # Breaks: an entry reported missing when cartridge.json was rejected (it may hold one).
  test "a rejected manifest does not also report the entry missing", %{tmp_dir: dir} do
    m = @manifest |> Map.delete("title") |> Map.put("entry", ref("a"))

    assert compile(dir, %{"cartridge.json" => m}) ==
             {:error,
              [d("SCHEMA_VIOLATION", "cartridge.title", %{"error" => "missing_property"})]}
  end

  # Review F5. Breaks: a v2 action label or accessibility key reaches the player unresolved.
  test "an action text key without a catalog entry is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    talk = %{
      "label" => "act.talk",
      "target" => %{"kind" => "none"},
      "command" => "move",
      "priority" => 0,
      "input" => [],
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}},
      "accessibility" => "r.t"
    }

    m = put_in(@manifest, ["requires", "capabilities", "policy"], 1)

    assert compile(dir, %{
             "cartridge.json" => Map.put(m, "entry", ref("a")),
             "actions/go.json" => talk
           }) ==
             {:error, [d("UNRESOLVED_REFERENCE", "actions/go.label", %{"target" => "act.talk"})]}
  end

  # Review F6. Breaks: v2 keyed on rooms alone, so text.json or an entry is silently dropped.
  test "text.json or an entry without rooms is still v2 and fails for its missing room",
       %{tmp_dir: dir} do
    no_rooms = %{"rooms/a.json" => nil, "rooms/b.json" => nil}

    assert compile(dir, Map.put(no_rooms, "cartridge.json", @manifest)) ==
             {:error,
              [d("SCHEMA_VIOLATION", "cartridge.entry", %{"error" => "missing_property"})]}

    assert compile(dir, Map.put(no_rooms, "text.json", nil)) ==
             {:error,
              [d("UNRESOLVED_REFERENCE", "cartridge.entry", %{"target" => "c@1.0.0:room/a"})]}
  end

  # R5 S2. Breaks: details dropped or reshaped in the artifact.
  test "ashmere_details compiles to its Python known answer" do
    expected =
      ~s({"cartridge":#{@details_kat["canonical"]},"content_hash":"#{@details_kat["sha256"]}"})

    assert Loka.Content.compile("cartridges/ashmere_details") == {:ok, expected}
  end

  defp detail(aliases, text \\ "r.d"), do: %{"aliases" => aliases, "description" => text}

  # Breaks: a detail's description key unchecked (the player reads the raw key), or a detail
  # whose first alias (its name in "Which do you mean") is shared or untypable accepted; a
  # shared later alias must stay valid.
  test "a detail's missing text is UNRESOLVED_REFERENCE; one without its own alias is UNREACHABLE_DETAIL",
       %{tmp_dir: dir} do
    details = %{
      "bell" => detail(["the_bell", "bell"]),
      "gap" => detail(["x__y"]),
      "lamp" => detail(["post", "lamp"]),
      "notice" => detail(["notice", "post"], "d.missing"),
      "post" => detail(["mooring_post", "post"])
    }

    assert compile(dir, %{"rooms/b.json" => Map.put(room(%{}), "details", details)}) ==
             {:error,
              [
                d("UNREACHABLE_DETAIL", "rooms/b.details.bell"),
                d("UNREACHABLE_DETAIL", "rooms/b.details.gap"),
                d("UNREACHABLE_DETAIL", "rooms/b.details.lamp"),
                d("UNRESOLVED_REFERENCE", "rooms/b.details.notice.description", %{
                  "target" => "d.missing"
                })
              ]}

    shared = Map.drop(details, ~w(bell gap lamp)) |> put_in(["notice", "description"], "r.d")
    assert {:ok, _} = compile(dir, %{"rooms/b.json" => Map.put(room(%{}), "details", shared)})
  end

  # R5 S3. Breaks: variants dropped or reshaped, facts not keyed, or a short fact reference in a
  # room's or detail's variant left short (owner decision 2026-09-25; the loader would reject it).
  test "ashmere_facts compiles to its Python known answer" do
    expected =
      ~s({"cartridge":#{@facts_kat["canonical"]},"content_hash":"#{@facts_kat["sha256"]}"})

    assert Loka.Content.compile("cartridges/ashmere_facts") == {:ok, expected}
  end

  defp variant(root, text \\ "r.d"),
    do: %{"when" => %{"policy_version" => 1, "root" => root}, "description" => text}

  defp bell(equals), do: %{"op" => "fact_compare", "fact" => "bell", "equals" => equals}

  @bell %{
    "facts" => %{
      "bell" => %{
        "version" => 1,
        "value_type" => %{"type" => "bool", "default" => false},
        "scopes" => ["instance"],
        "meaning" => "m"
      }
    }
  }

  # Breaks: a variant's text key, a short fact reference in a room's or a detail's variant, or
  # a compared value's type goes unchecked (the player reads a raw key, or the kernel reads no
  # fact).
  test "a variant's missing text or fact is UNRESOLVED_REFERENCE; a wrong value FACT_TYPE_MISMATCH",
       %{tmp_dir: dir} do
    m =
      put_in(@manifest, ["requires", "capabilities"], %{
        "movement" => 1,
        "inspectable_detail" => 1,
        "description_variant" => 1,
        "fact" => 1
      })

    nope = %{"op" => "fact_compare", "fact" => "nope", "equals" => true}
    lamp = %{"aliases" => ["lamp"], "description" => "r.d", "variants" => [variant(nope)]}

    b =
      room(%{})
      |> Map.put("variants", [variant(bell(true), "d.gone"), variant(bell("yes"))])
      |> Map.put("details", %{"lamp" => lamp})

    files = %{
      "cartridge.json" => Map.put(m, "entry", ref("a")),
      "facts.json" => @bell,
      "rooms/b.json" => b
    }

    assert compile(dir, files) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/b.details.lamp.variants[0].when.root.fact", %{
                  "target" => "c@1.0.0:fact/nope"
                }),
                d("UNRESOLVED_REFERENCE", "rooms/b.variants[0].description", %{
                  "target" => "d.gone"
                }),
                d("FACT_TYPE_MISMATCH", "rooms/b.variants[1].when.root.equals")
              ]}
  end

  # Breaks: a detail or a variant (on a room or a detail) compiles without its owning
  # capability required, or a variant condition's op without its owner (05 §6).
  test "details, variants and their ops without their owners are UNDECLARED_CAPABILITY",
       %{tmp_dir: dir} do
    m = put_in(@manifest, ["requires", "capabilities"], %{"movement" => 1})
    lamp = %{"aliases" => ["lamp"], "description" => "r.d", "variants" => [variant(bell(true))]}

    b =
      room(%{})
      |> Map.put("variants", [variant(%{"op" => "not", "item" => bell(true)})])
      |> Map.put("details", %{"lamp" => lamp})

    files = %{
      "cartridge.json" => Map.put(m, "entry", ref("a")),
      "facts.json" => @bell,
      "rooms/b.json" => b
    }

    undeclared = fn path, cap ->
      d("UNDECLARED_CAPABILITY", path, %{"capability" => cap}, [cap <> "@1"])
    end

    assert compile(dir, files) ==
             {:error,
              [
                undeclared.("rooms/b.details.lamp", "inspectable_detail"),
                undeclared.("rooms/b.details.lamp.variants[0]", "description_variant"),
                undeclared.("rooms/b.details.lamp.variants[0].when.root.op", "fact"),
                undeclared.("rooms/b.variants[0]", "description_variant"),
                undeclared.("rooms/b.variants[0].when.root.item.op", "fact"),
                undeclared.("rooms/b.variants[0].when.root.op", "policy")
              ]}
  end

  # Review F1. Breaks: expand/2 takes a details map with a detail keyed exits (and title) for a
  # room and crashes, or skips expanding inside that detail's variant condition.
  test "details keyed exits and title compile, their short references expanded", %{tmp_dir: dir} do
    m =
      put_in(@manifest, ["requires", "capabilities"], %{
        "movement" => 1,
        "inspectable_detail" => 1,
        "description_variant" => 1,
        "fact" => 1
      })

    exits = %{"aliases" => ["exits"], "description" => "r.d", "variants" => [variant(bell(true))]}
    title = %{"aliases" => ["title"], "description" => "r.t"}
    b = Map.put(room(%{}), "details", %{"exits" => exits, "title" => title})

    files = %{
      "cartridge.json" => Map.put(m, "entry", ref("a")),
      "facts.json" => @bell,
      "rooms/b.json" => b
    }

    assert {:ok, bytes} = compile(dir, files)
    %{"cartridge" => c} = JSON.decode!(bytes)
    [v] = c["rooms"]["c@1.0.0:room/b"]["details"]["exits"]["variants"]
    assert v["when"]["root"]["fact"] == ref("bell", "fact")
  end
end
