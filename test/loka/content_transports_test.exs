defmodule Loka.ContentTransportsTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @source "cartridges/ashmere_missing_child"

  # Breaks: authored short transport references survive compilation, so real endpoint actions cannot load.
  test "paired ferry routes, boarding details and free lesson expand their original bindings" do
    {:ok, bytes, _} = Loka.Content.compile(@source)
    c = JSON.decode!(bytes)["cartridge"]
    p = "#{c["manifest"]["id"]}@#{c["manifest"]["version"]}"

    ref = fn kind, key ->
      %{
        "cartridge_id" => c["manifest"]["id"],
        "cartridge_version" => c["manifest"]["version"],
        "kind" => kind,
        "key" => key
      }
    end

    outbound = c["transports"][p <> ":transport/fen_outbound"]
    assert outbound["room"] == ref.("room", "boathouse")
    assert outbound["destination"] == ref.("room", "fen_isle_landing")
    assert outbound["reverse"] == ref.("transport", "fen_return")
    assert outbound["recipient"] == ref.("npc", "sedge")
    assert outbound["currency"] == ref.("resource", "pennies")

    assert c["rooms"][p <> ":room/boathouse"]["details"]["ferry"]["transport"]["route"] ==
             ref.("transport", "fen_outbound")

    assert c["dialogues"][p <> ":dialogue/sedge_swim"]["choices"]["learn"]["sequence"] == [
             %{"op" => "skill.acquire", "skill" => ref.("skill", "swim")}
           ]
  end

  # Breaks: missing reciprocal endpoint, bound money, forged action, bypass exit or unbound free grants enter compiled source.
  test "compiler refuses invalid ferry and free lesson authoring", %{tmp_dir: dir} do
    File.cp_r!(@source, dir)

    for {path, change} <- [
          {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.23")},
          {"transports/fen_return.json", &Map.put(&1, "destination", "missing")},
          {"transports/fen_outbound.json", &Map.put(&1, "recipient", "missing")},
          {"npcs/sedge.json", &Map.delete(&1, "resource_starts")},
          {"rooms/boathouse.json", &put_in(&1, ["exits", "west"], %{"to" => "fen_isle_landing"})},
          {"actions/board_ferry.json", &Map.put(&1, "input", [])},
          {"dialogues/sedge_swim.json", &Map.put(&1, "roles", %{})},
          {"dialogues/sedge_swim.json",
           &put_in(&1, ["choices", "learn", "payment"], %{
             "from" => "teacher",
             "resource" => "pennies",
             "amount" => 1
           })}
        ] do
      original = @source |> Path.join(path) |> File.read!() |> JSON.decode!()
      target = Path.join(dir, path)
      File.write!(target, JSON.encode!(change.(original)))
      assert {:error, _} = Loka.Content.compile(dir), path
      File.write!(target, JSON.encode!(original))
    end

    File.rm!(Path.join(dir, "transports/fen_return.json"))
    assert {:error, _} = Loka.Content.compile(dir)
  end
end
