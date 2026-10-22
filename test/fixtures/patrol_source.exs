defmodule Loka.PatrolSource do
  @moduledoc """
  The cellar sampler plus an inline patrol: Tobin walks a finite route from a new watch post east of North Gate through a new east gate east of Village Green.
  Call `copy/0` from `setup_all` or a test; the copy is removed when that scope exits.
  """

  def copy do
    dir = Loka.ContentSource.copy("cartridges/cellar_sampler")
    put = fn rel, value -> File.write!(Path.join(dir, rel), JSON.encode!(value)) end
    edit = fn rel, f -> put.(rel, f.(JSON.decode!(File.read!(Path.join(dir, rel))))) end

    choice = fn transition ->
      %{
        "label" => "watch.#{transition}",
        "narration" => "watch.#{transition}",
        "patrol" => %{"npc" => "leader", "quest" => "watch_rounds", "transition" => transition}
      }
    end

    edit.("cartridge.json", fn c ->
      c
      |> put_in(["requires", "kernel_api", "at_least"], "1.22")
      |> put_in(["requires", "capabilities", "patrol"], 1)
    end)

    edit.("rooms/north_gate.json", &put_in(&1, ["exits", "east"], %{"to" => "watch_post"}))
    edit.("rooms/village_green.json", &put_in(&1, ["exits", "east"], %{"to" => "east_gate"}))

    for {key, back} <- [{"watch_post", "north_gate"}, {"east_gate", "village_green"}] do
      put.("rooms/#{key}.json", %{
        "title" => "room.#{key}.title",
        "description" => "room.#{key}.description",
        "exits" => %{"west" => %{"to" => back}}
      })
    end

    put.("npcs/tobin.json", %{
      "keywords" => ["tobin"],
      "short" => "npc.tobin.short",
      "room_line" => "npc.tobin.room",
      "description" => "npc.tobin.description",
      "room" => "watch_post"
    })

    edit.("facts.json", fn f ->
      put_in(f, ["facts", "watch_gate_trusts_player"], %{
        "version" => 1,
        "value_type" => %{"type" => "bool", "default" => false},
        "scopes" => ["player"],
        "meaning" => "Only patrol completion writes it."
      })
    end)

    put.("quests/watch_rounds.json", %{
      "title" => "quest.watch_rounds.title",
      "objective" => %{"evidence" => "patrol"},
      "patrol" => %{
        "npc" => "tobin",
        "route" => ~w(watch_post north_gate village_green east_gate village_green north_gate),
        "initial_cursor" => 0,
        "checkpoints" => ~w(north_gate village_green east_gate watch_post),
        "required" => 4,
        "trust_fact" => "watch_gate_trusts_player",
        "narration" => "watch.completed"
      },
      "journal" =>
        Map.new(~w(active objectives_met resolved failed abandoned), &{&1, "watch.completed"})
    })

    put.("dialogues/tobin_watch.json", %{
      "npc" => "tobin",
      "roles" => %{"leader" => %{"role" => "npc", "npc" => "tobin"}},
      "policy" => %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}},
      "prompt" => "watch.prompt",
      "label" => "watch.talk",
      "choices" => %{
        "start" => Map.put(choice.("start"), "accept", "watch_rounds"),
        "continue" => choice.("continue"),
        "rejoin" => choice.("rejoin"),
        "restart" => choice.("restart")
      }
    })

    keys =
      ~w(watch.completed watch.prompt watch.talk watch.start watch.continue watch.rejoin
         watch.restart quest.watch_rounds.title npc.tobin.short npc.tobin.room
         npc.tobin.description room.watch_post.title room.watch_post.description
         room.east_gate.title room.east_gate.description)

    text = Map.put(Map.new(keys, &{&1, &1}), "npc.tobin.room", "[Tobin] keeps watch here.")
    edit.("text.json", &Map.merge(&1, text))
    dir
  end
end
