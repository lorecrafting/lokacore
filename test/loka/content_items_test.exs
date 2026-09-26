defmodule Loka.ContentItemsTest do
  # Items, NPCs and touch links in the compiler (R5 S4; entity.schema.json; owner decision
  # 2026-09-25, Q1 and Q3). Expected diagnostics are hand-written from protocol/cartridge.schema.json
  # DiagnosticCode; the known answer is protocol/fixtures/cartridge_items_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_items_hash.json"))
  @src "cartridges/ashmere_items"

  # ashmere_items' source with `files` merged over it (nil removes a file).
  defp compile(dir, files) do
    base =
      for rel <- Path.wildcard("#{@src}/**/*.json"),
          not String.contains?(rel, "transcripts"),
          into: %{},
          do: {Path.relative_to(rel, @src), JSON.decode!(File.read!(rel))}

    for {rel, v} <- Map.merge(base, files), v != nil do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))
  defp text(changes), do: Map.merge(src("text.json"), changes)

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

  defp warn(path, target),
    do: %{d("TOUCH_LINK_MISSING", path, %{"target" => target}) | "severity" => "warning"}

  defp full(kind, key),
    do: %{
      "cartridge_id" => "ashmere_items",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  # Breaks: items or NPCs dropped or reshaped, short location, room or has_item references left
  # short, or a warning where every text links what it must.
  test "ashmere_items compiles to its Python known answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile(@src) == {:ok, expected, []}
  end

  # Owner decision 2026-09-25 (short references). Breaks: full references rejected or
  # compiled differently from short ones.
  test "full location and room references compile to the same artifact", %{tmp_dir: dir} do
    lamp = put_in(src("items/lamp_oil.json"), ["location", "item"], full("item", "satchel"))
    bram = %{src("npcs/bram.json") | "room" => full("room", "ferry_landing")}
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

    assert compile(dir, %{"items/lamp_oil.json" => lamp, "npcs/bram.json" => bram}) ==
             {:ok, expected, []}
  end

  # Breaks: a location or NPC room naming nothing, or of the wrong kind, compiles.
  test "a location or NPC room naming no definition of its kind is UNRESOLVED_REFERENCE",
       %{tmp_dir: dir} do
    lamp = put_in(src("items/lamp_oil.json"), ["location"], %{"in" => "npc", "npc" => "satchel"})
    bram = %{src("npcs/bram.json") | "room" => "river"}

    assert compile(dir, %{"items/lamp_oil.json" => lamp, "npcs/bram.json" => bram}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "items/lamp_oil.location.npc", %{
                  "target" => "ashmere_items@0.0.1:npc/satchel"
                }),
                d("UNRESOLVED_REFERENCE", "npcs/bram.room", %{
                  "target" => "ashmere_items@0.0.1:room/river"
                })
              ]}
  end

  # Breaks: a starting cycle or an overfull holder compiles (invariant containment_acyclic).
  test "a starting cycle is CONTAINMENT_CYCLE and an overfull holder CAPACITY_EXCEEDED",
       %{tmp_dir: dir} do
    in_item = &%{"in" => "item", "item" => &1}
    satchel = %{src("items/satchel.json") | "location" => in_item.("lamp_oil")}
    lantern = %{src("items/lantern.json") | "location" => %{"in" => "npc", "npc" => "bram"}}
    oil_too = %{src("items/lamp_oil.json") | "location" => %{"in" => "npc", "npc" => "bram"}}

    assert compile(dir, %{"items/satchel.json" => satchel}) ==
             {:error,
              [
                d("CONTAINMENT_CYCLE", "items/lamp_oil.location.item"),
                d("CONTAINMENT_CYCLE", "items/satchel.location.item")
              ]}

    assert compile(dir, %{
             "items/lantern.json" => lantern,
             "items/lamp_oil.json" => oil_too
           }) ==
             {:error,
              [d("CAPACITY_EXCEEDED", "npcs/bram.capacity", %{"capacity" => 1, "held" => 2})]}
  end

  # Breaks: items or NPCs compiling without containment, or their text keys unchecked.
  test "items and NPCs need containment and catalog entries", %{tmp_dir: dir} do
    m = src("cartridge.json")
    caps = Map.delete(m["requires"]["capabilities"], "containment")
    manifest = put_in(m, ["requires", "capabilities"], caps)
    t = Map.delete(src("text.json"), "npc.bram.short")

    undeclared =
      &d("UNDECLARED_CAPABILITY", &1, %{"capability" => "containment"}, ["containment@1"])

    assert compile(dir, %{"cartridge.json" => manifest, "text.json" => t}) ==
             {:error,
              [
                undeclared.("items/lamp_oil"),
                undeclared.("items/lantern"),
                undeclared.("items/lantern.room_line_variants[0].when.root.op"),
                undeclared.("items/satchel"),
                undeclared.("npcs/bram"),
                d("UNRESOLVED_REFERENCE", "npcs/bram.short", %{"target" => "npc.bram.short"})
              ]}
  end

  # Owner decision Q3. Breaks: a link target that names nothing, a bare link in a room's own
  # text, or a detail linked from an item's text compiles.
  test "a touch link naming no detail, item or NPC it may name is UNRESOLVED_REFERENCE",
       %{tmp_dir: dir} do
    t =
      text(%{
        "room.ferry_landing.description" =>
          "A [mooring post](mooring_post) and a [crate](crate) by the [water].",
        "item.satchel.room" => "A [satchel] by the [post](mooring_post) and [Bram](bram).",
        "detail.mooring_post" => "The [post] and a [lantern](lantern)."
      })

    assert compile(dir, %{"text.json" => t}) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "items/satchel.room_line", %{"target" => "mooring_post"}),
                d("UNRESOLVED_REFERENCE", "rooms/ferry_landing.description", %{
                  "target" => "[water]"
                }),
                d("UNRESOLVED_REFERENCE", "rooms/ferry_landing.description", %{
                  "target" => "crate"
                })
              ]}
  end

  # Owner decision Q3. Breaks: a room text without a link to one of its details, or a room line
  # without a link to its item or NPC, passes silently or fails the build.
  test "a missing touch link is a TOUCH_LINK_MISSING warning and the build succeeds",
       %{tmp_dir: dir} do
    variant = %{
      "when" => %{"policy_version" => 1, "root" => %{"op" => "has_item", "item" => "lantern"}},
      "description" => "room.ferry_landing.title"
    }

    green = Map.put(src("rooms/ferry_landing.json"), "variants", [variant])

    t = text(%{"npc.bram.room" => "Bram stands here.", "item.lantern.room_oil" => "A lantern."})

    assert {:ok, _, warnings} =
             compile(dir, %{"rooms/ferry_landing.json" => green, "text.json" => t})

    assert warnings == [
             warn("items/lantern.room_line_variants[0].description", "lantern"),
             warn("npcs/bram.room_line", "bram"),
             warn("rooms/ferry_landing.variants[0].description", "mooring_post")
           ]
  end

  # Breaks: items in a source without rooms compiled to v1 and silently dropped.
  test "items without rooms still compile as v2 and need an entry", %{tmp_dir: dir} do
    assert {:error, diags} =
             compile(dir, %{
               "cartridge.json" => Map.delete(src("cartridge.json"), "entry"),
               "rooms/ferry_landing.json" => nil,
               "rooms/village_green.json" => nil
             })

    assert d("SCHEMA_VIOLATION", "cartridge.entry", %{"error" => "missing_property"}) in diags
  end
end
