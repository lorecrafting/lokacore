defmodule Loka.Components.Cooldowns do
  @moduledoc """
  Typed access to the `cooldowns` component.

  Stores action cooldowns as a map of key => Unix timestamp (UTC seconds).
  Persists in entity components via EntityServer auto-save.

  ## Data Shape

      entity.components["cooldowns"] = %{
        "heal_spell" => 1739712600,
        "shrine_pray" => 1739712900
      }

  ## Usage

      alias Loka.Components.Cooldowns

      Cooldowns.ready?(entity, "heal_spell")
      Cooldowns.remaining(entity, "heal_spell")
      entity = Cooldowns.set(entity, "heal_spell", 60)
      entity = Cooldowns.clear(entity, "heal_spell")
  """

  @component_key "cooldowns"

  alias Loka.Engine.Entity

  @doc "Returns the raw cooldowns map or empty map."
  @spec get(Entity.t()) :: map()
  def get(entity), do: Map.get(entity.components, @component_key, %{})

  @doc "Returns true if the entity has a cooldowns component."
  @spec has?(Entity.t()) :: boolean()
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  @doc "Sets the entire cooldowns map on the entity."
  @spec put(Entity.t(), map()) :: Entity.t()
  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  @doc "Returns the component key string."
  @spec component_key() :: String.t()
  def component_key, do: @component_key

  @doc """
  Checks if a cooldown is ready (expired or never set).

  Returns `true` if the action can be performed.
  """
  @spec ready?(Entity.t(), String.t()) :: boolean()
  def ready?(entity, key) do
    key = to_string(key)

    case get(entity) do
      %{^key => expiry} when is_integer(expiry) ->
        System.os_time(:second) >= expiry

      _ ->
        true
    end
  end

  @doc """
  Gets the remaining cooldown time in seconds.

  Returns 0 if the cooldown is ready or was never set.
  """
  @spec remaining(Entity.t(), String.t()) :: non_neg_integer()
  def remaining(entity, key) do
    key = to_string(key)

    case get(entity) do
      %{^key => expiry} when is_integer(expiry) ->
        max(0, expiry - System.os_time(:second))

      _ ->
        0
    end
  end

  @doc """
  Sets a cooldown on an entity. Returns the updated entity.

  Duration is in seconds.
  """
  @spec set(Entity.t(), String.t(), pos_integer()) :: Entity.t()
  def set(entity, key, duration_seconds)
      when is_integer(duration_seconds) and duration_seconds > 0 do
    key = to_string(key)
    expiry = System.os_time(:second) + duration_seconds
    cooldowns = get(entity)
    put(entity, Map.put(cooldowns, key, expiry))
  end

  @doc "Clears a specific cooldown. Returns the updated entity."
  @spec clear(Entity.t(), String.t()) :: Entity.t()
  def clear(entity, key) do
    key = to_string(key)
    cooldowns = get(entity)
    put(entity, Map.delete(cooldowns, key))
  end

  @doc "Clears all cooldowns. Returns the updated entity."
  @spec clear_all(Entity.t()) :: Entity.t()
  def clear_all(entity) do
    put(entity, %{})
  end

  @doc """
  Lists all active (non-expired) cooldowns.

  Returns a list of `%{key: String.t(), remaining: non_neg_integer()}`.
  """
  @spec list_active(Entity.t()) :: [%{key: String.t(), remaining: non_neg_integer()}]
  def list_active(entity) do
    now = System.os_time(:second)

    get(entity)
    |> Enum.map(fn {key, expiry} ->
      %{key: key, remaining: max(0, expiry - now)}
    end)
    |> Enum.filter(fn %{remaining: r} -> r > 0 end)
  end

  @doc "Removes expired cooldown entries. Returns the updated entity."
  @spec sweep_expired(Entity.t()) :: Entity.t()
  def sweep_expired(entity) do
    now = System.os_time(:second)

    cleaned =
      get(entity)
      |> Enum.reject(fn {_key, expiry} -> expiry < now end)
      |> Map.new()

    put(entity, cleaned)
  end
end
