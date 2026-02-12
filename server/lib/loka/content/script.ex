defmodule Loka.Content.Script do
  @moduledoc """
  Script definition - OOC TypedObject.

  Scripts define Elixir code that can be attached to entities via hooks.
  They are sandboxed and have access to a limited API.

  ## Usage

      # Get script definition
      {:ok, script} = Script.get("greeting_on_enter")

      # Get script source code
      source = Script.source(script)

      # List scripts for a specific hook
      enter_scripts = Script.for_hook(:on_enter)

  ## YAML Structure

      key: greeting_on_enter
      type: script
      name: "Greet on Room Entry"
      tags: [room, greeting]
      data:
        hook: on_enter
        source: |
          if player.level < 5 do
            message(player, "Welcome, newcomer!")
          end
        bindings: [player, message]
        timeout_ms: 1000

  ## Security

  Scripts are validated before execution:
  - Syntax check at load time
  - Sandbox restricts available functions
  - Timeout prevents infinite loops
  - Memory limits prevent resource exhaustion
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @default_timeout_ms 5000

  # Valid binding names to prevent atom table exhaustion
  # These correspond to the API functions available in Loka.Engine.Script.Bindings
  @valid_bindings ~w(
    entity player context room
    quest_active? quest_complete? quest_objective_done?
    has_item? has_flag? get_flag get_stat get_skill get_attribute
    entities_in_room players_in_room entity_present? find_entity find_entities_by_tag
    time_of_day current_hour current_weather is_outdoor? is_dark?
    say emote message announce_room
    set_flag complete_objective start_quest
    give_item remove_item
    spawn_at spawn_npc spawn_item despawn
    move_entity teleport
    damage heal
    apply_effect remove_effect
    set_room_attr lock_exit unlock_exit
    after emit
    chance? roll random pick
    contains? downcase upcase
    any? all? find count first last
    log
    deny default handled continue allow
  )

  @doc """
  Gets a script by key.
  """
  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :script) do
      {:ok, entity} -> Entity.to_typed_object(entity)
      error -> error
    end
  end

  @doc """
  Gets a script by key, raises if not found.
  """
  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, script} -> script
      {:error, :not_found} -> raise "Script not found: #{key}"
    end
  end

  @doc """
  Lists all script definitions.
  """
  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :script, is_prototype: true)
    |> to_typed_objects()
  end

  @doc """
  Lists all published script definitions (excludes drafts).
  """
  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :script, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @doc """
  Lists scripts for a specific hook type.
  """
  @spec for_hook(atom()) :: [TypedObject.t()]
  def for_hook(hook) when is_atom(hook) do
    hook_str = Atom.to_string(hook)

    all()
    |> Enum.filter(fn script ->
      script_hook = hook(script)
      script_hook == hook || script_hook == hook_str
    end)
  end

  @doc """
  Gets the hook type this script handles.
  """
  @spec hook(TypedObject.t()) :: atom() | String.t() | nil
  def hook(%TypedObject{type: :script, data: data}) do
    Map.get(data, "hook") || Map.get(data, :hook)
  end

  @doc """
  Gets the script source code.
  """
  @spec source(TypedObject.t()) :: String.t() | nil
  def source(%TypedObject{type: :script, data: data}) do
    Map.get(data, "source") || Map.get(data, :source)
  end

  @doc """
  Gets the required bindings for the script.

  Only converts known binding names to atoms to prevent atom table exhaustion.
  Unknown bindings are kept as strings and will cause runtime errors if used.
  """
  @spec bindings(TypedObject.t()) :: [atom() | String.t()]
  def bindings(%TypedObject{type: :script, data: data}) do
    bindings = Map.get(data, "bindings") || Map.get(data, :bindings, [])

    Enum.map(bindings, fn
      b when is_binary(b) ->
        # Only convert whitelisted binding names to atoms
        if b in @valid_bindings do
          String.to_atom(b)
        else
          # Keep as string to prevent atom exhaustion
          # This will cause a runtime error if the script tries to use it
          b
        end

      b when is_atom(b) ->
        b
    end)
  end

  @doc """
  Gets the execution timeout in milliseconds.
  """
  @spec timeout_ms(TypedObject.t()) :: non_neg_integer()
  def timeout_ms(%TypedObject{type: :script, data: data}) do
    Map.get(data, "timeout_ms") || Map.get(data, :timeout_ms, @default_timeout_ms)
  end

  @doc """
  Gets the config schema for behavior scripts.

  The config schema defines validation rules for behavior configs:
  - Required fields
  - Types (string, integer, list, etc.)
  - Default values
  - Min/max constraints

  Returns nil if no schema is defined.
  """
  @spec config_schema(TypedObject.t()) :: map() | nil
  def config_schema(%TypedObject{type: :script, data: data}) do
    Map.get(data, "config_schema") || Map.get(data, :config_schema)
  end

  @doc """
  Checks if the script source is syntactically valid Elixir.
  """
  @spec valid_syntax?(TypedObject.t()) :: boolean()
  def valid_syntax?(%TypedObject{} = script) do
    case source(script) do
      nil -> false
      src -> match?({:ok, _}, Code.string_to_quoted(src))
    end
  end

  @doc """
  Validates a script definition.
  """
  @spec validate(TypedObject.t()) :: :ok | {:error, [String.t()]}
  def validate(%TypedObject{type: :script} = script) do
    errors =
      []
      |> validate_has_source(script)
      |> validate_has_hook(script)
      |> validate_syntax(script)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  def validate(%TypedObject{type: type}) do
    {:error, ["Expected script type, got: #{type}"]}
  end

  defp validate_has_source(errors, script) do
    case source(script) do
      nil -> ["script must have source code" | errors]
      "" -> ["script source cannot be empty" | errors]
      _ -> errors
    end
  end

  defp validate_has_hook(errors, script) do
    case hook(script) do
      nil -> ["script must specify a hook" | errors]
      _ -> errors
    end
  end

  defp validate_syntax(errors, script) do
    case source(script) do
      nil ->
        errors

      src ->
        case Code.string_to_quoted(src) do
          {:ok, _} -> errors
          {:error, {_line, msg, _}} -> ["syntax error: #{msg}" | errors]
        end
    end
  end

  defp to_typed_objects(entities) do
    entities
    |> Enum.flat_map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, typed_object} -> [typed_object]
        {:error, _} -> []
      end
    end)
  end
end
