defmodule Loka.Content.Starters.World do
  @moduledoc false
  # The starters that bundle several files: a transport pair and a population with the combat,
  # death and calendar settings the engine requires of it (Templates.kinds lists them).
  import Loka.Content.Starters.Parts

  # A pair of routes between the first room and a new far room, each behind a detail.
  def transport(name, c) do
    [here, far, there] = [c["rooms"], "#{name}_far", "#{name}_back"]

    route = fn from, to, key, back ->
      %{"transports/#{key}.json" => leg(from, to, key, back, name, c)}
    end

    detail = fn key ->
      %{
        "details" => %{
          name => %{
            "aliases" => [name],
            "description" => p(),
            "transport" => %{"route" => key, "title" => p()}
          }
        }
      }
    end

    %{
      "rooms/#{far}.json" => Map.merge(room(), detail.(there)),
      "rooms/#{here}.json" => detail.(name),
      "npcs/#{c["npcs"]}.json" => stock(c),
      "text.json" => %{"transport.unaffordable" => "~"}
    }
    |> Map.merge(route.(here, far, name, there))
    |> Map.merge(route.(far, here, there, name))
    |> Map.merge(ride(name))
    |> Map.merge(ride(there))
  end

  defp leg(from, to, key, back, detail, c) do
    %{
      "room" => from,
      "detail" => detail,
      "destination" => to,
      "reverse" => back,
      "recipient" => c["npcs"],
      "currency" => c["resources"],
      "fare" => 1,
      "recovery_rooms" => [to],
      "action" => key,
      "name" => p(),
      "narration" => p()
    }
  end

  defp ride(key) do
    %{
      "actions/#{key}.json" => %{
        "name" => p(),
        "command" => "use_transport",
        "target" => %{"kind" => "entity", "scopes" => ["inspectable_details"]},
        "input" => ["route", "quoted_fare"],
        "priority" => 0,
        "accessibility" => p()
      }
    }
  end

  # A template NPC, its corpse and a second reciprocal room, as encounter_sampler does, with the
  # combat, death and calendar settings a population needs.
  def population(name, c) do
    [home, camp] = [c["rooms"], "#{name}_camp"]

    Map.merge(bodies(name, home), %{
      "resources.json" => %{"resources" => %{"hp" => resource(), "mv" => resource()}},
      "rooms/#{camp}.json" => Map.put(room(), "exits", %{"west" => %{"to" => home}}),
      "rooms/#{home}.json" => %{"exits" => %{"east" => %{"to" => camp}}},
      "cartridge.json" => %{
        "calendar" => calendar(),
        "world" => %{"combat" => combat(), "death" => death(name, home)}
      },
      "text.json" => Map.new(combat_lines(), &{"combat.#{&1}", "~"}),
      "populations/#{name}.json" => %{
        "npc" => "#{name}_npc",
        "item" => "#{name}_item",
        "corpse" => "#{name}_corpse",
        "home" => home,
        "area" => [home, camp],
        "cap" => 1,
        "day_target" => 1,
        "night_target" => 1,
        "night_start" => 20,
        "night_end" => 6,
        "replacement_delay" => 3600,
        "wander_interval" => 3600
      }
    })
  end

  # The member NPC, both corpses (containers) and the loot item, all templates.
  defp bodies(name, home) do
    member = %{
      "room" => home,
      "spawn_template" => true,
      "hp" => resource(),
      "attack" => %{"chance" => 50, "damage_min" => 1, "damage_max" => 1}
    }

    corpse = fn key ->
      thing(key)
      |> Map.merge(%{"location" => %{"in" => "template"}, "mass_grams" => 0, "container" => true})
    end

    %{
      "npcs/#{name}_npc.json" => Map.merge(thing("#{name}_npc"), member),
      "items/#{name}_corpse.json" => corpse.("#{name}_corpse"),
      "items/#{name}_player_corpse.json" => corpse.("#{name}_player_corpse"),
      "items/#{name}_item.json" =>
        Map.put(thing("#{name}_item"), "location", %{"in" => "template"})
    }
  end

  defp death(name, home),
    do: %{
      "player_corpse" => "#{name}_player_corpse",
      "npc_corpse" => "#{name}_corpse",
      "shrine" => home,
      "restore" => %{"hp" => 10, "mv" => 10}
    }

  defp combat do
    narration = Map.new(combat_lines(), &{&1, "combat.#{&1}"})

    %{
      "player_attack" => %{"chance" => 100, "damage_min" => 1, "damage_max" => 1},
      "interval" => 150,
      "sleep_multiplier" => 2,
      "flee_multiplier" => 2,
      "narration" => narration
    }
  end

  defp calendar do
    solar =
      for {at, phase} <- [{18_000, "dawn"}, {25_200, "day"}, {64_800, "dusk"}, {72_000, "night"}],
          do: %{"at" => at, "phase" => phase}

    %{
      "start" => 28_800,
      "units_per_hour" => 3600,
      "hours_per_day" => 24,
      "subdivisions_per_hour" => 60,
      "solar" => solar
    }
  end
end
