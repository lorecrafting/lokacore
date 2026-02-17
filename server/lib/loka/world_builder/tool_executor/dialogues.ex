defmodule Loka.WorldBuilder.ToolExecutor.Dialogues do
  @moduledoc false

  alias Loka.WorldBuilder.DialogueManager
  alias Loka.Content.Dialogue
  alias Loka.Engine.{Entity, Entities}

  def execute_create_dialogue(input) do
    key = input["key"]
    entity_key = input["npc"] || input["entity_key"]
    trigger = input["trigger"] || "on_talk"
    raw_nodes = input["nodes"] || []

    # Convert array format from schema [{id, text, choices}] to map format {id => {text, choices}}
    nodes =
      if is_list(raw_nodes) do
        Map.new(raw_nodes, fn node -> {node["id"], Map.drop(node, ["id"])} end)
      else
        raw_nodes
      end

    entry_node =
      input["entry_node"] ||
        if is_list(raw_nodes) and raw_nodes != [], do: hd(raw_nodes)["id"], else: "start"

    with :ok <- validate_safe_key(key) do
      data = %{
        "entity_key" => entity_key,
        "trigger" => trigger,
        "entry_node" => entry_node,
        "nodes" => nodes
      }

      entity =
        Entity.new(
          type: :dialogue,
          key: key,
          short_desc: "Dialogue: #{entity_key}",
          is_prototype: true,
          components: %{"data" => data},
          metadata: %{"draft" => true}
        )

      case Entities.save(entity) do
        {:ok, _} ->
          {:ok,
           %{
             success: true,
             message: "Created dialogue '#{key}' for #{entity_key}",
             dialogue: %{
               key: key,
               entity_key: entity_key,
               entry_node: entry_node
             }
           }}

        {:error, reason} ->
          {:error, "Failed to save dialogue: #{inspect(reason)}"}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  def execute_get_dialogue(input) do
    dialogue_key = input["dialogue_key"]

    case Dialogue.get(dialogue_key) do
      {:ok, dialogue} ->
        data = (dialogue.components || %{})["data"] || %{}

        {:ok,
         %{
           success: true,
           dialogue: %{
             key: dialogue.key,
             entity_key: data["entity_key"],
             trigger: data["trigger"],
             entry_node: data["entry_node"],
             nodes: data["nodes"] || %{}
           }
         }}

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{dialogue_key}"}
    end
  end

  def execute_update_dialogue(input) do
    key = input["key"]
    raw_nodes = input["nodes"] || []

    case Dialogue.get(key) do
      {:ok, existing} ->
        nodes =
          if is_list(raw_nodes) do
            Map.new(raw_nodes, fn node -> {node["id"], Map.drop(node, ["id"])} end)
          else
            raw_nodes
          end

        existing_data = (existing.components || %{})["data"] || %{}
        updated_data = Map.put(existing_data, "nodes", nodes)
        updated_components = Map.put(existing.components || %{}, "data", updated_data)

        case Entities.get_entity_by_key(key) do
          %{} = schema ->
            case Entities.update_entity(schema, %{components: updated_components}) do
              {:ok, _} ->
                {:ok,
                 %{
                   success: true,
                   message: "Updated dialogue '#{key}' (#{map_size(nodes)} nodes)",
                   dialogue: %{key: key, node_count: map_size(nodes)}
                 }}

              {:error, reason} ->
                {:error, "Failed to save dialogue: #{inspect(reason)}"}
            end

          nil ->
            {:error, "Dialogue not found in DB: #{key}"}
        end

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{key}"}
    end
  end

  def execute_delete_dialogue(input) do
    key = input["key"]

    case DialogueManager.delete_dialogue(key) do
      :ok ->
        {:ok, %{success: true, message: "Deleted dialogue '#{key}'"}}

      {:error, :not_found} ->
        {:error, "Dialogue not found: #{key}"}

      {:error, reason} ->
        {:error, "Failed to delete dialogue: #{inspect(reason)}"}
    end
  end

  def execute_list_dialogues(input) do
    dialogues = Dialogue.all()

    filtered =
      if npc = input["npc"] do
        Enum.filter(dialogues, fn d ->
          data = (d.components || %{})["data"] || %{}
          (data["entity_key"] || "") == npc
        end)
      else
        dialogues
      end

    list =
      Enum.map(filtered, fn d ->
        data = (d.components || %{})["data"] || %{}

        %{
          key: d.key,
          entity_key: data["entity_key"],
          node_count: map_size(data["nodes"] || %{})
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(list)} dialogues",
       dialogues: list
     }}
  end

  defp validate_safe_key(key) when is_binary(key) do
    if String.match?(key, ~r/^[a-z0-9_]+$/) do
      :ok
    else
      {:error, "Invalid key format. Use only lowercase letters, numbers, and underscores."}
    end
  end

  defp validate_safe_key(_), do: {:error, "Key must be a string"}
end
