defmodule Loka.Core.ComposeTarget do
  @moduledoc "Mutation targets for portable delta operations."
  @doc "The MutationTarget an op writes (04 §5.1)."
  @spec target(map()) :: map()
  def target(%{"op" => "fact.assign"} = op),
    do: Map.put(Map.take(op, ~w(fact scope subject_id)), "kind", "fact")

  def target(%{"op" => "character.select", "character_id" => id}),
    do: %{"kind" => "character", "character_id" => id}

  def target(%{"op" => "entity.create", "identity" => %{"id" => e}}),
    do: %{"kind" => "entity", "entity_id" => e}

  def target(%{"op" => "entity.transfer", "entity_id" => e}),
    do: %{"kind" => "containment", "entity_id" => e}

  def target(%{"op" => "quest." <> _, "instance_id" => i}),
    do: %{"kind" => "quest", "instance_id" => i}

  def target(%{"op" => "choice." <> _, "continuation_id" => c}),
    do: %{"kind" => "choice", "continuation_id" => c}

  def target(%{"op" => "job." <> _, "job_id" => j}), do: %{"kind" => "job", "job_id" => j}

  def target(%{"op" => "bleed.transition", "body_id" => b}),
    do: %{"kind" => "bleed", "body_id" => b}

  def target(%{"op" => "encounter." <> _, "encounter_id" => e}),
    do: %{"kind" => "encounter", "encounter_id" => e}

  def target(%{"op" => "patrol.transition", "quest_instance_id" => q}),
    do: %{"kind" => "patrol", "quest_instance_id" => q}

  def target(%{"op" => "expedition.transition", "quest_instance_id" => q}),
    do: %{"kind" => "expedition", "quest_instance_id" => q}

  def target(%{"op" => "population.control", "plan" => p}),
    do: %{"kind" => "population_plan", "plan" => p}

  def target(%{"op" => "population.slot", "plan" => p, "slot" => s}),
    do: %{"kind" => "population_slot", "plan" => p, "slot" => s}

  def target(%{"op" => "crow.transition", "plan" => p, "slot" => s}),
    do: %{"kind" => "crow", "plan" => p, "slot" => s}

  def target(%{"op" => "water.transition", "actor_id" => a}),
    do: %{"kind" => "water", "actor_id" => a}

  def target(%{"op" => "escort.transition", "actor_id" => a}),
    do: %{"kind" => "escort", "actor_id" => a}

  def target(%{"op" => "liquid.set", "item_id" => i}),
    do: %{"kind" => "liquid", "item_id" => i}

  def target(%{"op" => "time.advance"}), do: %{"kind" => "clock"}

  def target(%{"op" => "fuel.set", "item_id" => i}), do: %{"kind" => "fuel", "item_id" => i}

  def target(%{"op" => "resource.adjust"} = op),
    do: Map.put(Map.take(op, ~w(resource entity_id)), "kind", "resource")

  def target(%{"op" => "resource.initialize"} = op),
    do: Map.put(Map.take(op, ~w(resource entity_id)), "kind", "resource")

  def target(%{"op" => "cooldown.start"} = op),
    do: Map.put(Map.take(op, ~w(actor_id action)), "kind", "cooldown")

  def target(%{"op" => "barrier.transition", "barrier" => b}),
    do: %{"kind" => "barrier", "barrier" => b}

  @doc "Canonical text of a mutation target or DefinitionRef."
  def key(value) do
    {:ok, text} = Loka.Core.Canonical.encode(value)
    text
  end
end
