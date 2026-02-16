defmodule Loka.Engine.EntityBehavior do
  @moduledoc """
  Behaviour callbacks for V2 entity behaviors.

  Behaviors are attached to entities and respond to lifecycle events:

  - `on_init/1` — Called when the EntityServer starts. Set up initial state.
  - `on_tick/1` — Called periodically (interval from `components["tick"]`).
  - `on_event/3` — Called for each event dispatched through `dispatch_event/3`.
  - `on_terminate/2` — Called when the EntityServer stops.

  All callbacks are optional. Behaviors that don't implement a callback are
  simply skipped during dispatch.

  ## Usage

      defmodule MyBehavior do
        @behaviour Loka.Engine.EntityBehavior

        @impl true
        def on_event(entity, :damage, %{amount: amount}) do
          health = entity.components["health"] || 100
          {:ok, Entity.add_component(entity, "health", health - amount)}
        end

        def on_event(entity, _event, _payload), do: {:ok, entity}
      end

  ## Return Values

  - `{:ok, entity}` — Continue the behavior chain with updated entity
  - `{:ok, entity, payload}` — Continue with updated entity AND modified payload
  - `{:halt, entity}` — Stop the behavior chain (no further behaviors run)

  No `on_save` callback — saves are infrastructure, not behavior concerns.
  """

  alias Loka.Engine.Entity
  alias Loka.Engine.StateMachine

  @npc_ai_machine StateMachine.new(%{
                    initial: "idle",
                    transitions: %{
                      "idle" => ["patrolling", "alert"],
                      "patrolling" => ["alert", "idle"],
                      "alert" => ["pursuing", "idle"],
                      "pursuing" => ["attacking", "returning"],
                      "attacking" => ["pursuing", "returning", "idle"],
                      "returning" => ["idle", "alert"]
                    }
                  })

  def npc_ai_machine, do: @npc_ai_machine

  @callback on_init(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_tick(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_event(entity :: Entity.t(), event_name :: atom(), payload :: map()) ::
              {:ok, Entity.t()} | {:ok, Entity.t(), map()} | {:halt, Entity.t()}
  @callback on_terminate(entity :: Entity.t(), reason :: term()) :: :ok

  @optional_callbacks [on_init: 1, on_tick: 1, on_event: 3, on_terminate: 2]
end
