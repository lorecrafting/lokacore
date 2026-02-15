defmodule LokaWeb.Channels.BuilderCommands.Cutscenes do
  @moduledoc """
  Cutscene CRUD commands: create cutscene, delete cutscene, cutscene info.
  """

  alias Loka.Engine.{Entity, Entities}
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:create_cutscene, %{key: key, name: name}, socket) do
    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, _} ->
        {:error, "Cutscene '#{key}' already exists.", socket}

      {:error, :not_found} ->
        default_scenes = [
          %{"type" => "narration", "text" => "A new scene begins...", "delay" => 2000}
        ]

        entity =
          Entity.new(
            type: :cutscene,
            key: key,
            short_desc: name,
            is_prototype: true,
            metadata: %{"draft" => true},
            components: %{
              "data" => %{
                "trigger" => "manual",
                "scenes" => default_scenes
              }
            }
          )

        case Entities.save(entity) do
          {:ok, _} ->
            {:ok, "Cutscene '#{key}' (#{name}) created.", socket}

          {:error, reason} ->
            {:error, "Failed to create cutscene: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:delete_cutscene, %{key: key}, socket) do
    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, cutscene} ->
        case Entities.delete(cutscene.id) do
          {:ok, _} ->
            {:ok, "Cutscene '#{key}' deleted.", socket}

          {:error, reason} ->
            {:error, "Failed to delete cutscene: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "Cutscene '#{key}' not found.", socket}
    end
  end

  def execute(:cutscene_info, %{key: key}, socket) do
    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, obj} ->
        yaml_text = Helpers.format_entity(obj)
        {:ok, "Cutscene '#{key}'#{Helpers.draft_tag(obj)}:\n#{yaml_text}", socket}

      {:error, :not_found} ->
        {:error, "Cutscene '#{key}' not found.", socket}
    end
  end
end
