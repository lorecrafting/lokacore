defmodule LokaWeb.Channels.BuilderCommands.Content do
  @moduledoc """
  Quest and dialogue commands: create/edit/delete quest, quest info,
  create/delete dialogue, dialogue info.
  """

  alias Loka.Engine.TypedObject.Loader
  alias Loka.WorldBuilder.{QuestManager, DialogueManager}
  alias Loka.Content.Dialogue
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:create_quest, %{key: key, name: name}, socket) do
    params = %{"key" => key, "name" => name}

    case QuestManager.create_quest(params) do
      {:ok, _} -> {:ok, "Quest '#{key}' (#{name}) created.", socket}
      {:error, reason} -> {:error, "Failed to create quest: #{inspect(reason)}", socket}
    end
  end

  def execute(:edit_quest, %{key: key, field: nil}, socket) do
    case Loader.get(key) do
      {:ok, obj} ->
        yaml_text = Helpers.format_typed_object(obj)
        {:ok, "Quest '#{key}':\n#{yaml_text}", socket}

      _ ->
        {:error, "Quest '#{key}' not found.", socket}
    end
  end

  def execute(:edit_quest, %{key: key, field: field, value: value}, socket) do
    case QuestManager.update_quest(key, %{field => value}) do
      {:ok, _} -> {:ok, "Updated quest '#{key}': #{field} = #{value}", socket}
      {:error, reason} -> {:error, "Failed to update quest: #{inspect(reason)}", socket}
    end
  end

  def execute(:quest_info, %{key: key}, socket) do
    execute(:edit_quest, %{key: key, field: nil}, socket)
  end

  def execute(:delete_quest, %{key: key}, socket) do
    case QuestManager.delete_quest(key) do
      :ok -> {:ok, "Quest '#{key}' deleted.", socket}
      {:error, :not_found} -> {:error, "Quest '#{key}' not found.", socket}
      {:error, reason} -> {:error, "Failed to delete quest: #{inspect(reason)}", socket}
    end
  end

  def execute(:create_dialogue, %{npc_key: npc_key}, socket) do
    case Dialogue.get(npc_key) do
      {:ok, _} ->
        {:error, "Dialogue for '#{npc_key}' already exists.", socket}

      {:error, _} ->
        params = %{"key" => npc_key, "npc_key" => npc_key}

        case DialogueManager.create_dialogue(params) do
          {:ok, info} ->
            {:ok,
             "Dialogue '#{npc_key}' created (#{info.node_count} nodes).\n" <>
               "  Use /ai to expand it: /ai flesh out the dialogue for #{npc_key}", socket}

          {:error, reason} ->
            {:error, "Failed to create dialogue: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:dialogue_info, %{key: key}, socket) do
    case Dialogue.get(key) do
      {:ok, dialogue} ->
        data = Map.get(dialogue, :data, %{})
        nodes = data["nodes"] || %{}
        node_count = if is_map(nodes), do: map_size(nodes), else: length(nodes)

        lines =
          nodes
          |> Enum.take(10)
          |> Enum.map(fn
            {id, node} when is_map(node) ->
              text = node["text"] || ""
              choices = node["choices"] || []
              "  [#{id}] #{String.slice(text, 0, 60)}... (#{length(choices)} choices)"

            node when is_map(node) ->
              id = node["id"] || "?"
              text = node["text"] || ""
              choices = node["choices"] || []
              "  [#{id}] #{String.slice(text, 0, 60)}... (#{length(choices)} choices)"
          end)
          |> Enum.join("\n")

        more = if node_count > 10, do: "\n  ... and #{node_count - 10} more nodes", else: ""

        {:ok, "Dialogue '#{key}' (#{node_count} nodes):\n#{lines}#{more}", socket}

      {:error, _} ->
        {:error, "Dialogue '#{key}' not found.", socket}
    end
  end

  def execute(:delete_dialogue, %{key: key}, socket) do
    case DialogueManager.delete_dialogue(key) do
      :ok -> {:ok, "Dialogue '#{key}' deleted.", socket}
      {:error, :not_found} -> {:error, "Dialogue '#{key}' not found.", socket}
      {:error, reason} -> {:error, "Failed to delete dialogue: #{inspect(reason)}", socket}
    end
  end
end
