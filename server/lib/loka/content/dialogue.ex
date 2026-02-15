defmodule Loka.Content.Dialogue do
  @moduledoc """
  Dialogue tree - OOC Entity.

  Dialogues define conversation trees for NPCs:
  - Nodes with text and choices
  - Conditions for showing/hiding options
  - Actions triggered by choices

  Referenced by NPCs, not spawned directly.

  ## Usage

      # Get dialogue definition
      {:ok, dialogue} = Dialogue.get("elder_greeting")

      # Get a specific node
      node = Dialogue.get_node(dialogue, "greeting")

      # Get all dialogues for an NPC
      dialogues = Dialogue.for_entity("village_elder")

  ## YAML Structure

      key: elder_greeting
      type: dialogue
      data:
        entity_key: village_elder
        trigger: on_talk
        entry_node: greeting
        nodes:
          greeting:
            text: "Greetings, traveler."
            choices:
              - text: "Tell me more."
                next: explain
              - text: "Goodbye."
                next: farewell
  """

  alias Loka.Engine.{Entity, Entities}

  @type dialogue_node :: %{
          text: String.t(),
          choices: [choice()],
          conditions: map() | nil,
          action: map() | nil
        }

  @type choice :: %{
          text: String.t(),
          next: String.t(),
          conditions: map() | nil,
          action: map() | nil
        }

  @doc """
  Gets a dialogue by key.
  """
  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Entities.find_one(key: key, type: :dialogue)
  end

  @doc """
  Gets a dialogue by key, raises if not found.
  """
  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, dialogue} -> dialogue
      {:error, :not_found} -> raise "Dialogue not found: #{key}"
    end
  end

  @doc """
  Lists all dialogue definitions.
  """
  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :dialogue, is_prototype: true)
  end

  @doc """
  Lists all published dialogue definitions (excludes drafts).
  """
  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :dialogue, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @doc """
  Lists dialogues for a specific entity.
  """
  @spec for_entity(String.t()) :: [Entity.t()]
  def for_entity(entity_key) when is_binary(entity_key) do
    all()
    |> Enum.filter(fn dialogue ->
      entity_key(dialogue) == entity_key
    end)
  end

  @doc """
  Lists published dialogues for a specific entity.
  """
  @spec for_entity_published(String.t()) :: [Entity.t()]
  def for_entity_published(entity_key) when is_binary(entity_key) do
    all_published()
    |> Enum.filter(fn dialogue ->
      entity_key(dialogue) == entity_key
    end)
  end

  @doc """
  Gets the entity key this dialogue belongs to.
  """
  @spec entity_key(Entity.t()) :: String.t() | nil
  def entity_key(%Entity{type: :dialogue} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "entity_key") || Map.get(data, :entity_key)
  end

  @doc """
  Gets the trigger type for this dialogue.
  """
  @spec trigger(Entity.t()) :: String.t()
  def trigger(%Entity{type: :dialogue} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "trigger") || Map.get(data, :trigger, "on_talk")
  end

  @doc """
  Gets the entry node key.
  """
  @spec entry_node(Entity.t()) :: String.t()
  def entry_node(%Entity{type: :dialogue} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "entry_node") || Map.get(data, :entry_node, "greeting")
  end

  @doc """
  Gets all nodes in the dialogue.
  """
  @spec nodes(Entity.t()) :: map()
  def nodes(%Entity{type: :dialogue} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "nodes") || Map.get(data, :nodes, %{})
  end

  @doc """
  Gets a specific node by key.
  """
  @spec get_node(Entity.t(), String.t()) :: map() | nil
  def get_node(%Entity{} = dialogue, node_key) when is_binary(node_key) do
    nodes(dialogue)
    |> Map.get(node_key, Map.get(nodes(dialogue), String.to_atom(node_key)))
  end

  @doc """
  Gets dialogue conditions (global conditions for the whole dialogue).
  """
  @spec conditions(Entity.t()) :: map()
  def conditions(%Entity{type: :dialogue} = entity) do
    data = entity.components["data"] || %{}
    Map.get(data, "conditions") || Map.get(data, :conditions, %{})
  end

  @doc """
  Lists available choices for a node.
  """
  @spec choices(Entity.t(), String.t()) :: [map()]
  def choices(%Entity{} = dialogue, node_key) when is_binary(node_key) do
    case get_node(dialogue, node_key) do
      nil -> []
      node -> Map.get(node, "choices") || Map.get(node, :choices, [])
    end
  end

  @doc """
  Gets text for a node.
  """
  @spec node_text(Entity.t(), String.t()) :: String.t() | nil
  def node_text(%Entity{} = dialogue, node_key) when is_binary(node_key) do
    case get_node(dialogue, node_key) do
      nil -> nil
      node -> Map.get(node, "text") || Map.get(node, :text)
    end
  end

  @doc """
  Validates a dialogue definition.
  """
  @spec validate(Entity.t()) :: :ok | {:error, [String.t()]}
  def validate(%Entity{type: :dialogue} = dialogue) do
    errors =
      []
      |> validate_has_nodes(dialogue)
      |> validate_entry_node(dialogue)
      |> validate_node_links(dialogue)

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  def validate(%Entity{type: type}) do
    {:error, ["Expected dialogue type, got: #{type}"]}
  end

  defp validate_has_nodes(errors, dialogue) do
    if map_size(nodes(dialogue)) == 0 do
      ["dialogue must have at least one node" | errors]
    else
      errors
    end
  end

  defp validate_entry_node(errors, dialogue) do
    entry = entry_node(dialogue)
    node_map = nodes(dialogue)

    if Map.has_key?(node_map, entry) or Map.has_key?(node_map, String.to_atom(entry)) do
      errors
    else
      ["entry_node '#{entry}' not found in nodes" | errors]
    end
  end

  defp validate_node_links(errors, dialogue) do
    node_map = nodes(dialogue)
    node_keys = MapSet.new(Map.keys(node_map) |> Enum.map(&to_string/1))

    # Check all choice 'next' references exist
    broken_links =
      node_map
      |> Enum.flat_map(fn {_key, node} ->
        node_choices = Map.get(node, "choices") || Map.get(node, :choices, [])

        Enum.flat_map(node_choices, fn choice ->
          next = Map.get(choice, "next") || Map.get(choice, :next)

          if next && !MapSet.member?(node_keys, to_string(next)) do
            [to_string(next)]
          else
            []
          end
        end)
      end)
      |> Enum.uniq()

    if Enum.empty?(broken_links) do
      errors
    else
      ["broken node references: #{inspect(broken_links)}" | errors]
    end
  end
end
