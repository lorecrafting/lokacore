defmodule Loka.ContentRewardStorageTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/reward_storage_hash.json"))

  defp update(dir, rel, fun) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(fun.(JSON.decode!(File.read!(path)))))
  end

  defp source(dir) do
    File.cp_r!("cartridges/ashmere_sampler", dir)
    File.cp_r!("test/fixtures/reward_storage", dir)
    File.rm!(Path.join(dir, "README.md"))

    update(dir, "cartridge.json", fn m ->
      m
      |> Map.merge(%{
        "id" => "reward_storage",
        "version" => "0.0.1",
        "title" => "Controlled reward/storage",
        "entry" => "lantern_cellar"
      })
      |> put_in(["requires", "kernel_api", "at_least"], "1.7")
      |> put_in(["world", "combat", "player_attack"], %{
        "chance" => 100,
        "damage_min" => 1,
        "damage_max" => 1
      })
    end)

    for n <- 1..5 do
      update(dir, "npcs/cellar_rat_#{n}.json", fn npc ->
        npc
        |> put_in(["hp"], %{"minimum" => 0, "maximum" => 1, "start" => 1, "gain" => 0})
        |> put_in(["attack", "chance"], 0)
      end)
    end

    update(dir, "facts.json", fn f ->
      update_in(
        f,
        ["facts"],
        &Map.merge(&1, %{
          "maud_trust" => %{
            "version" => 1,
            "scopes" => ["player"],
            "value_type" => %{
              "type" => "int",
              "minimum" => -100,
              "maximum" => 100,
              "default" => 0
            },
            "meaning" => "Controlled trust"
          },
          "inn_cellar_cleared" => %{
            "version" => 1,
            "scopes" => ["instance"],
            "value_type" => %{"type" => "bool", "default" => false},
            "meaning" => "Controlled completion"
          }
        })
      )
    end)

    update(
      dir,
      "text.json",
      &Map.merge(&1, %{
        "fixture.maud.room" => "[Maud]",
        "fixture.reward_key.room" => "[reward_key]",
        "fixture.reward_chest.room" => "[reward_chest]",
        "fixture.maud" => "Maud",
        "fixture.reward_key" => "Test key",
        "fixture.reward_chest" => "Test chest",
        "fixture.quest" => "Test quest",
        "fixture.offer" => "Test offer",
        "fixture.accept" => "Accept test quest",
        "fixture.accepted" => "Test quest accepted.",
        "fixture.turn_in" => "Test reward",
        "fixture.done" => "Receive test reward",
        "fixture.completed" => "Test reward received.",
        "action.put" => "Put"
      })
    )

    dir
  end

  # Breaks: new short fact refs fail expansion, or the compiler drops/reshapes a reward/Put contract.
  test "controlled source extends real M6 and compiles to the independent API1.7 known answer", %{
    tmp_dir: dir
  } do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert {:ok, actual, []} = Loka.Content.compile(source(dir))
    assert actual == expected
  end

  # Breaks: malformed incoming roles, non-bounded adjustments or reserved writes reach runtime.
  test "authoring guards reject invalid controlled rewards", %{tmp_dir: dir} do
    source(dir)
    path = Path.join(dir, "dialogues/maud_turn_in.json")
    original = JSON.decode!(File.read!(path))
    corpus = JSON.decode!(File.read!("protocol/fixtures/reward_storage_invalid.json"))

    for %{"path" => at, "value" => value, "code" => code} <- corpus do
      changed = put_in(original, Enum.map(at, &Access.key(&1)), value)
      File.write!(path, JSON.encode!(changed))
      assert {:error, errors} = Loka.Content.compile(dir)
      assert Enum.any?(errors, &(&1["code"] == code)), inspect(errors)
    end
  end

  # Breaks: static key checking ignores direct receive custody or reachable speaker rooms.
  test "receive-key potential retains lockout guards and requires bounded adjustments", %{
    tmp_dir: dir
  } do
    source(dir)

    for field <- ["minimum", "maximum"] do
      path = Path.join(dir, "facts.json")
      original = File.read!(path)

      update(
        dir,
        "facts.json",
        &update_in(&1, ["facts", "maud_trust", "value_type"], fn t -> Map.delete(t, field) end)
      )

      assert {:error, errors} = Loka.Content.compile(dir)
      assert Enum.any?(errors, &(&1["code"] == "FACT_TYPE_MISMATCH"))
      File.write!(path, original)
    end

    for {rel, change} <- [
          {"items/reward_key.json", &put_in(&1, ["location", "npc"], "bram")},
          {"dialogues/maud_turn_in.json", &Map.put(&1, "npc", "bram")},
          {"npcs/maud.json", &Map.put(&1, "room", "inn_attic")}
        ] do
      path = Path.join(dir, rel)
      original = File.read!(path)
      bram = Path.join(dir, "npcs/bram.json")
      original_bram = File.read!(bram)

      if rel == "items/reward_key.json",
        do: update(dir, "npcs/bram.json", &Map.put(&1, "room", "drowned_lantern"))

      rooms = Path.join(dir, "rooms/inn_rooms.json")
      original_room = File.read!(rooms)

      if rel == "npcs/maud.json",
        do:
          update(
            dir,
            "rooms/inn_rooms.json",
            &update_in(&1, ["exits"], fn e -> Map.delete(e, "up") end)
          )

      update(dir, rel, change)
      assert {:error, errors} = Loka.Content.compile(dir)
      assert Enum.any?(errors, &(&1["code"] == "BARRIER_UNREACHABLE_KEY")), inspect(errors)
      File.write!(path, original)
      File.write!(rooms, original_room)
      File.write!(bram, original_bram)
    end
  end
end
