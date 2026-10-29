defmodule Loka.PatrolSource do
  @moduledoc """
  The cellar sampler plus an inline patrol: Tobin walks a finite route from a new watch post east of North Gate through a new east gate east of Village Green.
  Call `copy/0` from `setup_all` or a test; the copy is removed when that scope exits.
  """

  def copy do
    dir = Loka.ContentSource.copy("cartridges/cellar_sampler")
    rooms(dir)
    patrol(dir)
    dir
  end

  defp rooms(dir) do
    edit(dir, "cartridge.json", fn c ->
      c
      |> put_in(["requires", "kernel_api", "at_least"], "1.22")
      |> put_in(["requires", "capabilities", "patrol"], 1)
    end)

    edit(dir, "rooms/north_gate.json", &put_in(&1, ["exits", "east"], %{"to" => "watch_post"}))
    edit(dir, "rooms/village_green.json", &put_in(&1, ["exits", "east"], %{"to" => "east_gate"}))

    for {key, back} <- [{"watch_post", "north_gate"}, {"east_gate", "village_green"}] do
      put(dir, "rooms/#{key}.json", %{
        "name" => "room.#{key}.title",
        "description" => "room.#{key}.description",
        "exits" => %{"west" => %{"to" => back}}
      })
    end
  end

  defp patrol(dir) do
    put(dir, "npcs/tobin.json", %{
      "keywords" => ["tobin"],
      "name" => "npc.tobin.short",
      "room_line" => "npc.tobin.room",
      "description" => "npc.tobin.description",
      "room" => "watch_post"
    })

    edit(dir, "facts.json", fn f ->
      put_in(f, ["facts", "watch_gate_trusts_player"], %{
        "version" => 1,
        "value_type" => %{"type" => "bool", "default" => false},
        "scopes" => ["player"],
        "meaning" => "Only patrol completion writes it."
      })
    end)

    put(dir, "quests/watch_rounds.json", %{
      "name" => "quest.watch_rounds.title",
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

    dialogue(dir)
  end

  defp dialogue(dir) do
    put(dir, "dialogues/tobin_watch.json", %{
      "npc" => "tobin",
      "roles" => %{"leader" => %{"role" => "npc", "npc" => "tobin"}},
      "prompt" => "watch.prompt",
      "name" => "watch.talk",
      "choices" => %{
        "start" => Map.put(choice("start"), "accept", "watch_rounds"),
        "continue" => choice("continue"),
        "rejoin" => choice("rejoin"),
        "restart" => choice("restart")
      }
    })

    keys =
      ~w(watch.completed watch.prompt watch.talk watch.start watch.continue watch.rejoin
         watch.restart quest.watch_rounds.title npc.tobin.short npc.tobin.room
         npc.tobin.description room.watch_post.title room.watch_post.description
         room.east_gate.title room.east_gate.description)

    text = Map.put(Map.new(keys, &{&1, &1}), "npc.tobin.room", "[Tobin] keeps watch here.")
    edit(dir, "text.json", &Map.merge(&1, text))
  end

  defp choice(transition) do
    %{
      "label" => "watch.#{transition}",
      "narration" => "watch.#{transition}",
      "patrol" => %{"npc" => "leader", "quest" => "watch_rounds", "transition" => transition}
    }
  end

  defp put(dir, rel, value), do: File.write!(Path.join(dir, rel), JSON.encode!(value))
  defp edit(dir, rel, f), do: put(dir, rel, f.(JSON.decode!(File.read!(Path.join(dir, rel)))))
end
