defmodule Loka.Content.Starters.Templates do
  @moduledoc false
  # One starter per schemas/source kind (test/loka/content_starters_test.exs holds the list to
  # the schema dir). Every line of prose is the `~` placeholder as inline prose, so a starter
  # compiles with no text key to invent; the shapes are the smallest sampler file of each kind.
  import Loka.Content.Starters.Parts
  alias Loka.Content.Starters.World

  @names ~w(actions areas attributes barriers behaviours bleeds dialogues emotes facts items layout liquids npcs populations quests reactions replenish resources rooms scenes services skills statuses structures text topics transports)
  @doc "kind => {capabilities it needs, kinds whose first key it references, name, context -> files}"
  def kinds, do: Map.new(@names, &{&1, kind(&1)})

  defp kind("actions"),
    do: {~w(scripted_action narration inspectable_detail fact), ~w(rooms), &action/2}

  defp kind("areas"), do: {~w(movement), [], &area/2}
  defp kind("attributes"), do: {~w(attribute), [], single("attributes", %{"start" => 8})}
  defp kind("barriers"), do: {~w(barrier), [], &barrier/2}
  defp kind("behaviours"), do: {~w(reaction narration), [], &behaviour/2}
  defp kind("bleeds"), do: {~w(bleed), ~w(resources), &bleed/2}
  defp kind("dialogues"), do: {~w(dialogue), ~w(npcs), &dialogue/2}
  defp kind("emotes"), do: {~w(emote), [], file("emotes", %{"others" => p()})}
  defp kind("facts"), do: {~w(fact), [], single("facts", fact())}
  defp kind("items"), do: {~w(containment), ~w(rooms), &item/2}
  defp kind("layout"), do: {~w(knowledge), ~w(rooms), &layout/2}
  defp kind("liquids"), do: {~w(liquid food), [], &liquid/2}
  defp kind("npcs"), do: {~w(containment), ~w(rooms), &npc/2}

  defp kind("populations"),
    do: {~w(population calendar combat schedule death position), ~w(rooms), &World.population/2}

  defp kind("quests"), do: {~w(quest), ~w(items), &quest/2}
  defp kind("reactions"), do: {~w(reaction narration), ~w(items), &reaction/2}
  defp kind("replenish"), do: {[], ~w(items rooms npcs), &replenish/2}
  defp kind("resources"), do: {~w(resource), [], single("resources", resource())}
  defp kind("rooms"), do: {~w(movement), [], &new_room/2}
  defp kind("scenes"), do: {~w(scene quest), ~w(items), &scene/2}
  defp kind("services"), do: {~w(service), ~w(npcs resources), &service/2}

  defp kind("skills"),
    do: {~w(skill fact policy), [], file("skills", %{"name" => p(), "requirement" => p()})}

  defp kind("statuses"), do: {~w(status), ~w(resources), &status/2}

  defp kind("structures"),
    do: {~w(construction), [], file("structures", room() |> Map.delete("exits"))}

  defp kind("text"), do: {[], [], fn name, _ -> %{"text.json" => %{name => "~"}} end}
  defp kind("topics"), do: {~w(topic fact), [], &topic/2}

  defp kind("transports"),
    do: {~w(transport inspectable_detail), ~w(rooms npcs resources), &World.transport/2}

  @doc "A new cartridge: manifest, one room `start`, nothing else."
  def cartridge(id) do
    %{
      "cartridge.json" => %{
        "api_version" => "loka/v3",
        "id" => id,
        "version" => "0.0.1",
        "title" => "~",
        "entry" => "start",
        "requires" => %{
          "kernel_api" => %{"at_least" => "1.0", "below" => "2.0"},
          "content_schema" => 1,
          "rule_ir" => 1,
          # description_variant owns the look command.
          "capabilities" => %{
            "movement" => 1,
            "containment" => 1,
            "fact" => 1,
            "description_variant" => 1
          },
          "client_features" => []
        },
        "supported_profiles" => ["offline_private"]
      },
      "rooms/start.json" => room()
    }
  end

  defp file(dir, body), do: fn name, _ -> %{"#{dir}/#{name}.json" => body} end
  defp single(kind, body), do: fn name, _ -> %{"#{kind}.json" => %{kind => %{name => body}}} end

  defp area(name, _), do: %{"areas/#{name}.json" => %{"rooms" => %{name => room()}}}

  defp barrier(name, _),
    do: %{
      "barriers/#{name}.json" => %{"keywords" => [name], "name" => p(), "initial" => "closed"}
    }

  defp new_room(name, %{"from" => {from, way, back}}),
    do: %{
      "rooms/#{name}.json" => Map.put(room(), "exits", %{back => %{"to" => from}}),
      "rooms/#{from}.json" => %{"exits" => %{way => %{"to" => name}}}
    }

  defp new_room(name, _), do: %{"rooms/#{name}.json" => room()}

  # The entry when it is a room here, even one in an area bundle.
  defp item(name, c),
    do: %{
      "items/#{name}.json" => Map.put(thing(name), "location", in_room(c["entry"] || c["rooms"]))
    }

  defp npc(name, c),
    do: %{"npcs/#{name}.json" => Map.put(thing(name), "room", c["entry"] || c["rooms"])}

  defp liquid(name, _),
    do: %{
      "liquids/#{name}.json" => %{
        "name" => p(),
        "unit_label" => p(),
        "grams_per_unit" => 10,
        "drink_amount" => 1
      }
    }

  # Its own fact: a topic's fact is unique to it.
  defp topic(name, _),
    do: %{
      "topics/#{name}.json" => %{"name" => p(), "fact" => "#{name}_known"},
      "facts.json" => %{"facts" => %{"#{name}_known" => fact()}}
    }

  defp quest(name, c) do
    objective = %{
      "evidence" => "current_state",
      "policy" => %{"op" => "has_item", "item" => c["items"]}
    }

    %{"quests/#{name}.json" => %{"name" => p(), "objective" => objective}}
  end

  defp dialogue(name, c) do
    npc = c["npcs"]

    %{
      "dialogues/#{name}.json" => %{
        "npc" => npc,
        "prompt" => p(),
        "roles" => %{npc => %{"role" => "npc", "npc" => npc}},
        "choices" => %{"one" => %{"label" => p(), "narration" => p(), "steps" => []}}
      }
    }
  end

  defp scene(name, c) do
    steps = [%{"type" => "narrate", "text" => p()}, %{"type" => "await_ack"}, %{"type" => "end"}]
    # Its own quest: only one scene may start on a quest's outcome.
    on = %{"quest" => "#{name}_quest", "outcome" => "completed"}

    Map.put(
      quest("#{name}_quest", c),
      "scenes/#{name}.json",
      %{"on" => on, "control" => "modal", "steps" => steps}
    )
  end

  defp action(name, c) do
    room = c["rooms"]
    assign = %{"op" => "fact.assign", "fact" => "#{name}_done", "value" => true}
    success = %{"steps" => [assign], "narration" => %{"actor" => p()}}

    %{
      "rooms/#{room}.json" => %{
        "details" => %{name => %{"aliases" => [name], "description" => p()}}
      },
      "facts.json" => %{"facts" => %{"#{name}_done" => fact()}},
      "actions/#{name}.json" => %{
        "name" => p(),
        "aliases" => [name],
        "target" => %{"kind" => "detail", "room" => room, "detail" => name},
        "priority" => 5,
        "outcomes" => %{"success" => success}
      }
    }
  end

  defp reaction(name, c) do
    on = %{"event" => "item_dropped", "item" => c["items"]}
    %{"reactions/#{name}.json" => %{"on" => on, "steps" => [narrate()]}}
  end

  defp behaviour(name, _) do
    on = %{"event" => "item_acquired", "item" => %{"param" => "holder"}}
    taken = %{"on" => on, "steps" => [narrate()]}
    %{"behaviours/#{name}.json" => %{"reactions" => %{"taken" => taken}}}
  end

  defp replenish(name, c) do
    body = %{
      "items" => [c["items"]],
      "from" => %{"in" => "npc", "npc" => c["npcs"]},
      "to" => in_room(c["rooms"]),
      "cap" => 1,
      "count" => 1,
      "every" => 3600
    }

    %{"replenish/#{name}.json" => body}
  end

  defp status(name, c) do
    narration = %{"applied" => p(), "tick" => p(), "expired" => p()}

    body = %{
      "duration" => 300,
      "tick_every" => 100,
      "per_tick" => -1,
      "resource" => c["resources"],
      "name" => p(),
      "narration" => narration
    }

    %{"statuses/#{name}.json" => body}
  end

  defp bleed(name, _) do
    narration = %{"applied" => p(), "refreshed" => p(), "tick" => p(), "expired" => p()}

    %{
      "bleeds/#{name}.json" => %{
        "duration" => 300,
        "tick_every" => 100,
        "hp_loss" => 1,
        "narration" => narration
      }
    }
  end

  defp service(name, c) do
    %{
      "services/#{name}.json" => %{
        "provider" => c["npcs"],
        "currency" => c["resources"],
        "action" => name,
        "name" => p(),
        "narration" => p(),
        "price" => 1,
        "benefit" => %{"op" => "entitlement", "fact" => "#{name}_paid"}
      },
      "facts.json" => %{"facts" => %{"#{name}_paid" => fact()}},
      "npcs/#{c["npcs"]}.json" => Map.merge(stock(c), %{"services" => [name]}),
      "text.json" => %{"service.unaffordable" => "~", "service.already_paid" => "~"},
      "actions/#{name}.json" => %{
        "name" => p(),
        "command" => "use_service",
        "target" => %{"kind" => "entity", "scopes" => ["room_occupants"]},
        "input" => ["service", "quoted_price"],
        "priority" => 0,
        "accessibility" => p()
      }
    }
  end

  # An existing row keeps its coordinates (a removed room's row goes); a new room gets the next x.
  defp layout(_, c) do
    kept = Enum.filter(c["layout"], &(&1["room"] in c["room_list"]))
    %{"layout.json" => with_rows(kept, c["room_list"])}
  end

  @doc "The rows, then one at the next x for each of `rooms` they lack."
  def with_rows(rows, rooms) do
    next = Enum.max(Enum.map(rows, & &1["x"]), fn -> -1 end) + 1

    rows ++
      for {room, i} <- Enum.with_index(rooms -- Enum.map(rows, & &1["room"])),
          do: %{"room" => room, "x" => next + i, "y" => 0, "z" => 0}
  end
end
