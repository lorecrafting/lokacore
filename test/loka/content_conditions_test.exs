defmodule Loka.ContentConditionsTest do
  # Named conditions (K1: conditions/<key>.json, {"op": "named", "key": "<k>"} substituted at
  # compile; docs/system/cartridge.md, Source shortcuts, Named conditions). Expected diagnostics are
  # hand-written from protocol/cartridge.schema.json DiagnosticCode. The byte-identical test is the
  # K1 ruling's: the compiler writes no trace of the leaf, so two sites naming one condition build
  # the same bytes as the cartridge with the condition written out at both.
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/facts_sampler")}
  @src "cartridges/facts_sampler"

  # The leaf the conditions name: fen.tracks_found is a bool defaulting false.
  @leaf %{"op" => "fact_compare", "fact" => "fen_tracks_found", "equals" => true}
  @named %{"op" => "named", "key" => "found_tracks"}

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

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

  # village_green's and reed_path's one variant each, gated on `when`.
  defp gated(when_policy) do
    %{
      "rooms/village_green.json" =>
        Map.put(src("rooms/village_green.json"), "variants", [
          %{"when" => when_policy, "description" => "room.village_green.celebration"}
        ]),
      "rooms/reed_path.json" =>
        Map.put(src("rooms/reed_path.json"), "variants", [
          %{"when" => when_policy, "description" => "room.reed_path.flooded"}
        ])
    }
  end

  # Break: the compiler inlines named conditions and leaves a trace of where, or inlines only the
  # first site, so a cartridge reading one condition at two gates differs from the same cartridge
  # written out by hand. Both artifacts must be the same bytes.
  test "two sites naming one condition build the hand-inlined artifact byte for byte", %{
    dir: dir
  } do
    named = compile(dir, Map.merge(gated(@named), %{"conditions/found_tracks.json" => @leaf}))
    hand = compile(dir, Map.new(gated(@leaf)))

    assert {:ok, bytes, warnings} = named
    assert named == hand
    assert is_binary(bytes) and is_list(warnings)
  end

  # Break: a condition reaches itself through named through another condition and the traversal
  # stops at a repeat of the first key only, so the pair expands forever or passes silently.
  test "a condition that reaches itself through another is CONDITION_CYCLE at both files", %{
    dir: dir
  } do
    files =
      Map.merge(gated(%{"op" => "named", "key" => "trusts"}), %{
        "conditions/found_tracks.json" => %{"op" => "named", "key" => "trusts"},
        "conditions/trusts.json" => %{"op" => "named", "key" => "found_tracks"}
      })

    assert {:error, ds} = compile(dir, files)

    assert ds == [
             d("CONDITION_CYCLE", "conditions/found_tracks"),
             d("CONDITION_CYCLE", "conditions/trusts")
           ]
  end

  # Break: a reduce over distinct keys catches a pair but not one key naming itself, so the
  # traversal recurses on its own key and a self-referential condition expands forever.
  test "a condition naming itself is CONDITION_CYCLE at its file", %{dir: dir} do
    files =
      Map.merge(gated(%{"op" => "named", "key" => "trusts"}), %{
        "conditions/trusts.json" => %{"op" => "named", "key" => "trusts"}
      })

    assert {:error, ds} = compile(dir, files)
    assert ds == [d("CONDITION_CYCLE", "conditions/trusts")]
  end

  # Break: a cycle reached only through a Policy's own arguments is missed, because a map iterates
  # as {key, value} pairs and a pair handed to the leaf-walker whole matches nothing, so the walk
  # finds no names and the pair inlines forever. The flat cycles above still pass with that break.
  test "a cycle reached only through a nested op is CONDITION_CYCLE at both files", %{dir: dir} do
    files =
      Map.merge(gated(%{"op" => "named", "key" => "trusts"}), %{
        "conditions/found_tracks.json" => %{
          "op" => "any",
          "items" => [@leaf, %{"op" => "named", "key" => "trusts"}]
        },
        "conditions/trusts.json" => %{
          "op" => "all",
          "items" => [%{"op" => "named", "key" => "found_tracks"}]
        }
      })

    assert {:error, ds} = compile(dir, files)

    assert ds == [
             d("CONDITION_CYCLE", "conditions/found_tracks"),
             d("CONDITION_CYCLE", "conditions/trusts")
           ]
  end

  # Break: two conditions files claim one key and the later read silently replaces the earlier, so a
  # cartridge whose author split one name across two files compiles with whichever file the loader
  # happened to read last, and the other is never reported. The area holds a room of its own, so no
  # area_empty fault joins the two.
  test "two files claiming one condition key are DUPLICATE_DEFINITION at both", %{dir: dir} do
    files =
      Map.merge(gated(@named), %{
        "conditions/found_tracks.json" => @leaf,
        "areas/fen/rooms/reed_bank.json" => %{
          "name" => "room.reed_path.title",
          "description" => "room.reed_path.description",
          "exits" => %{"north" => %{"to" => "reed_path"}}
        },
        "areas/fen/conditions/found_tracks.json" => %{
          "op" => "fact_compare",
          "fact" => "fen_tracks_found",
          "equals" => false
        }
      })

    assert {:error, ds} = compile(dir, files)

    assert ds == [
             d("DUPLICATE_DEFINITION", "areas/fen/conditions/found_tracks"),
             d("DUPLICATE_DEFINITION", "conditions/found_tracks")
           ]
  end

  # Break: an unknown condition name is dropped (reads as no condition) instead of refused, so a
  # gate the author meant to write silently always holds.
  test "a named leaf naming no condition is UNRESOLVED_REFERENCE at the use site", %{dir: dir} do
    files =
      Map.merge(gated(%{"op" => "named", "key" => "trusts"}), %{
        "conditions/found_tracks.json" => @leaf
      })

    assert {:error, ds} = compile(dir, files)

    assert ds == [
             d("UNRESOLVED_REFERENCE", "rooms/reed_path.variants[0].when.key", %{
               "target" => "trusts"
             }),
             d("UNRESOLVED_REFERENCE", "rooms/village_green.variants[0].when.key", %{
               "target" => "trusts"
             })
           ]
  end

  # Break: a conditions file is read as JSON and substituted with no check, so a file that is not a
  # Policy reaches a site and the artifact carries an op the kernel cannot fire.
  test "a conditions file that is no Policy is SCHEMA_VIOLATION at its own field", %{dir: dir} do
    files =
      Map.merge(gated(@named), %{
        "conditions/found_tracks.json" => %{"op" => "troths", "fact" => "fen_tracks_found"}
      })

    assert {:error, ds} = compile(dir, files)

    assert ds == [
             d("SCHEMA_VIOLATION", "conditions/found_tracks.op", %{"error" => "unknown_variant"})
           ]
  end

  # Break: substitution is one level deep, so a condition naming a condition is left as a named
  # leaf at the site and the artifact differs from the cartridge with both written out.
  test "a condition naming a condition inlines through both levels", %{dir: dir} do
    nested =
      compile(
        dir,
        Map.merge(gated(@named), %{
          "conditions/found_tracks.json" => %{"op" => "named", "key" => "tracks"},
          "conditions/tracks.json" => @leaf
        })
      )

    assert nested == compile(dir, Map.new(gated(@leaf)))
  end
end
