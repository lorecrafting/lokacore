defmodule Loka.Core.ComposeTarget do
  @moduledoc "Mutation targets for portable delta operations."
  @doc "The MutationTarget an op writes (04 §5.1)."
  @spec target(map()) :: map()
  def target(%{"op" => "fact.assign"} = op),
    do: Map.put(Map.take(op, ~w(fact scope subject_id)), "kind", "fact")

  def target(%{"op" => "entity.create", "identity" => %{"id" => e}}),
    do: %{"kind" => "entity", "entity_id" => e}

  def target(%{"op" => "entity.transfer", "entity_id" => e}),
    do: %{"kind" => "containment", "entity_id" => e}

  def target(%{"op" => "quest." <> _, "instance_id" => i}),
    do: %{"kind" => "quest", "instance_id" => i}

  def target(%{"op" => "choice." <> _, "continuation_id" => c}),
    do: %{"kind" => "choice", "continuation_id" => c}

  def target(%{"op" => "job." <> _, "job_id" => j}), do: %{"kind" => "job", "job_id" => j}

  def target(%{"op" => "encounter." <> _, "encounter_id" => e}),
    do: %{"kind" => "encounter", "encounter_id" => e}

  def target(%{"op" => "escort.transition", "actor_id" => a}),
    do: %{"kind" => "escort", "actor_id" => a}

  def target(%{"op" => "time.advance"}), do: %{"kind" => "clock"}

  def target(%{"op" => "resource.adjust"} = op),
    do: Map.put(Map.take(op, ~w(resource entity_id)), "kind", "resource")

  def target(%{"op" => "cooldown.start"} = op),
    do: Map.put(Map.take(op, ~w(actor_id action)), "kind", "cooldown")

  def target(%{"op" => "barrier.transition", "barrier" => b}),
    do: %{"kind" => "barrier", "barrier" => b}
end
