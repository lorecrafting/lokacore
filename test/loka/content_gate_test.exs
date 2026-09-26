defmodule Loka.ContentGateTest do
  # Barriers in the compiler (R5 S7; room.schema.json BarrierDefinition, Connection.barrier;
  # policy.schema.json barrier_state). Expected diagnostics are hand-written from
  # protocol/cartridge.schema.json DiagnosticCode, with the loader's paths in
  # kernel/ts/test/barriers.test.ts; the known answer is
  # protocol/fixtures/cartridge_gate_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_gate_hash.json"))
  @src "cartridges/ashmere_gate"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  # ashmere_gate's source with `files` merged over it (nil removes a file).
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
  defp edit(rel, path, v), do: %{rel => put_in(src(rel), path, v)}

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "ashmere_gate",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

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

  defp variant, do: ["details", "oak_door", "variants", Access.at(0), "when", "root", "barrier"]

  # Breaks: a barrier, an exit's barrier, a key_item or a barrier_state dropped or reshaped.
  test "ashmere_gate compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a short barrier or key_item reference left short (the loader would reject it).
  test "full barrier, key_item and barrier_state references compile to the same artifact",
       %{tmp_dir: dir} do
    gatehouse =
      src("rooms/gatehouse.json")
      |> put_in(["exits", "north", "barrier"], ref("barrier", "oak_door"))
      |> put_in(variant(), ref("barrier", "oak_door"))

    files = %{
      "rooms/gatehouse.json" => gatehouse,
      "barriers/cell_door.json" =>
        put_in(src("barriers/cell_door.json"), ["key_item"], ref("item", "iron_key"))
    }

    assert compile(dir, files) == {:ok, @expected, []}
  end

  # Breaks: the key_item expansion catching a details map with a detail keyed key_item (its
  # siblings' short references then stay short).
  test "a detail keyed key_item leaves its siblings' references expanded", %{tmp_dir: dir} do
    sill = %{"aliases" => ["sill"], "description" => "detail.oak_door"}

    {:ok, a, _touch_link_warning} =
      compile(dir, edit("rooms/gatehouse.json", ["details", "key_item"], sill))

    room = JSON.decode!(a)["cartridge"]["rooms"]["ashmere_gate@0.0.1:room/gatehouse"]
    assert get_in(room, variant()) == ref("barrier", "oak_door")
  end

  # Breaks: an exit, key_item or barrier_state naming what the cartridge lacks compiles (the
  # loader rejects it).
  test "an unknown barrier or key item is UNRESOLVED_REFERENCE", %{tmp_dir: dir} do
    trapdoor = %{"target" => "ashmere_gate@0.0.1:barrier/trapdoor"}
    courtyard = edit("rooms/courtyard.json", ["exits", "south", "barrier"], "trapdoor")
    gatehouse = put_in(src("rooms/gatehouse.json"), ["exits", "north", "barrier"], "trapdoor")

    assert compile(
             Path.join(dir, "a"),
             Map.put(courtyard, "rooms/gatehouse.json", gatehouse)
           ) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "rooms/courtyard.exits.south.barrier", trapdoor),
                d("UNRESOLVED_REFERENCE", "rooms/gatehouse.exits.north.barrier", trapdoor)
              ]}

    assert compile(
             Path.join(dir, "b"),
             edit("barriers/cell_door.json", ["key_item"], ref("room", "cell"))
           ) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "barriers/cell_door.key_item", %{
                  "target" => "ashmere_gate@0.0.1:room/cell"
                })
              ]}

    assert compile(Path.join(dir, "c"), edit("rooms/gatehouse.json", variant(), "trapdoor")) ==
             {:error,
              [
                d(
                  "UNRESOLVED_REFERENCE",
                  "rooms/gatehouse.details.oak_door.variants[0].when.root.barrier",
                  trapdoor
                )
              ]}

    assert compile(Path.join(dir, "d"), %{
             "text.json" => Map.delete(src("text.json"), "barrier.oak_door.short")
           }) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "barriers/oak_door.short", %{
                  "target" => "barrier.oak_door.short"
                })
              ]}
  end

  # Breaks: two faces of one passage with independent state (one names another barrier, or
  # none) compile, so a door is closed from one side and open from the other.
  test "both faces of a passage name one barrier (BARRIER_MISMATCH)", %{tmp_dir: dir} do
    assert compile(
             Path.join(dir, "a"),
             edit("rooms/cell.json", ["exits", "west", "barrier"], "oak_door")
           ) ==
             {:error,
              [
                d("BARRIER_MISMATCH", "rooms/cell.exits.west"),
                d("BARRIER_MISMATCH", "rooms/gatehouse.exits.east")
              ]}

    courtyard = src("rooms/courtyard.json")

    open = %{
      "rooms/courtyard.json" =>
        update_in(courtyard, ["exits", "south"], &Map.delete(&1, "barrier"))
    }

    assert compile(Path.join(dir, "b"), open) ==
             {:error,
              [
                d("BARRIER_MISMATCH", "rooms/courtyard.exits.south"),
                d("BARRIER_MISMATCH", "rooms/gatehouse.exits.north")
              ]}
  end

  # Breaks: a barrier or barrier_state compiling without barrier@1 in the manifest.
  test "a barrier needs barrier@1 (UNDECLARED_CAPABILITY)", %{tmp_dir: dir} do
    m = src("cartridge.json")

    files = %{
      "cartridge.json" => update_in(m, ["requires", "capabilities"], &Map.delete(&1, "barrier"))
    }

    undeclared = &d("UNDECLARED_CAPABILITY", &1, %{"capability" => "barrier"}, ["barrier@1"])

    assert compile(dir, files) ==
             {:error,
              [
                undeclared.("barriers/cell_door"),
                undeclared.("barriers/oak_door"),
                undeclared.("rooms/gatehouse.details.oak_door.variants[0].when.root.op")
              ]}
  end

  # Review #50 A2/N2. Breaks: faces paired by destination room rather than by connection (room and
  # opposite direction), so two passages between the same rooms cannot carry two doors.
  test "two passages between the same rooms may carry different barriers", %{tmp_dir: dir} do
    blue = %{"keywords" => ["hatch"], "short" => "barrier.oak_door.short", "initial" => "open"}
    way = fn b -> %{"to" => "courtyard", "barrier" => b} end
    back = fn b -> %{"to" => "gatehouse", "barrier" => b} end

    files = fn b ->
      %{
        "barriers/blue.json" => blue,
        "rooms/gatehouse.json" =>
          put_in(src("rooms/gatehouse.json"), ["exits", "west"], way.("blue")),
        # and Opus N2's chute: a way back with no reciprocal face and no barrier
        "rooms/courtyard.json" =>
          src("rooms/courtyard.json")
          |> put_in(["exits", "east"], back.(b))
          |> put_in(["exits", "down"], %{"to" => "gatehouse"})
      }
    end

    assert {:ok, _, []} = compile(Path.join(dir, "a"), files.("blue"))

    assert compile(Path.join(dir, "b"), files.("oak_door")) ==
             {:error,
              [
                d("BARRIER_MISMATCH", "rooms/courtyard.exits.east"),
                d("BARRIER_MISMATCH", "rooms/gatehouse.exits.west")
              ]}
  end

  # Review #50 A1. Breaks: a locked door whose key lies only behind it (or that has no key)
  # compiling into a cartridge no one can finish. ashmere_gate itself is the passing case: the
  # iron key lies past the oak door, which starts closed, not locked.
  test "a locked barrier whose key is out of reach is BARRIER_UNREACHABLE_KEY", %{tmp_dir: dir} do
    behind = edit("items/iron_key.json", ["location", "room"], "cell")
    stuck = {:error, [d("BARRIER_UNREACHABLE_KEY", "barriers/cell_door")]}
    assert compile(Path.join(dir, "a"), behind) == stuck

    keyless = %{
      "barriers/cell_door.json" => Map.delete(src("barriers/cell_door.json"), "key_item")
    }

    assert compile(Path.join(dir, "b"), keyless) == stuck

    oak = edit("barriers/oak_door.json", ["initial"], "locked")

    assert compile(Path.join(dir, "c"), oak) ==
             {:error,
              [
                # the key the oak door now hides: the cell door is out of reach too
                d("BARRIER_UNREACHABLE_KEY", "barriers/cell_door"),
                d("BARRIER_UNREACHABLE_KEY", "barriers/oak_door")
              ]}
  end
end
