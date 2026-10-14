defmodule Loka.Content.LeafRefs do
  @moduledoc """
  Each policy leaf's reference fields, each mapped to the definition kind a short ref expands
  to (mechanics.md policy leaf set). Twin of LEAF_REFS in kernel/ts/src/content/cartridge_leaf_refs.ts;
  kernel/ts/test/tags.test.ts checks both against policy.schema.json. `steps/0`: the same for
  each sequence step op (reactions, recipes, dialogue choices). No dependencies: the compiler's
  checks read it at compile time.
  """
  def all,
    do: %{
      "fact_compare" => %{"fact" => "fact", "npc" => "npc", "item" => "item"},
      "has_item" => %{"item" => "item"},
      "quest_state" => %{"quest" => "quest"},
      "escort_state" => %{"quest" => "quest"},
      "barrier_state" => %{"barrier" => "barrier"},
      "stat_compare" => %{"attribute" => "attribute"},
      "resource_compare" => %{"resource" => "resource"},
      "has_tag" => %{"item" => "item", "barrier" => "barrier", "room" => "room"},
      "visited_count" => %{"room" => "room"},
      "status_active" => %{"status" => "status"},
      "npc_present" => %{"npc" => "npc"},
      "population_count" => %{"plan" => "population"},
      "cue_perceived" => %{"npc" => "npc"}
    }

  def steps,
    do: %{
      "fact.assign" => %{"fact" => "fact", "item" => "item", "npc" => "npc"},
      "fact.adjust" => %{"fact" => "fact", "item" => "item", "npc" => "npc"},
      "skill.acquire" => %{"skill" => "skill"},
      "topic.grant" => %{"topic" => "topic"},
      "status.apply" => %{
        "status" => "status",
        "item" => "item",
        "npc" => "npc",
        "room" => "room"
      },
      "status.cure" => %{"status" => "status"},
      "damage" => %{"npc" => "npc"},
      "light.ignite" => %{"item" => "item"},
      "barrier.set" => %{"barrier" => "barrier"},
      "item.move" => %{"room" => "room"},
      "population.spawn" => %{"plan" => "population"},
      "quest.activate" => %{"quest" => "quest"},
      "quest.resolve" => %{"quest" => "quest"},
      "quest.fail" => %{"quest" => "quest"}
    }
end
