defmodule LokaWeb.Channels.BuilderCommands.Storylines do
  @moduledoc """
  Storyline CRUD commands: create storyline, delete storyline, storyline info.
  """

  alias Loka.Engine.{Entity, Entities}
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:create_storyline, %{key: key, name: name}, socket) do
    case Entities.find_one(key: key, type: :storyline) do
      {:ok, _} ->
        {:error, "Storyline '#{key}' already exists.", socket}

      {:error, :not_found} ->
        entity =
          Entity.new(
            type: :storyline,
            key: key,
            short_desc: name,
            is_prototype: true,
            metadata: %{"draft" => true},
            components: %{
              "data" => %{
                "main_quests" => [],
                "side_quests" => []
              }
            }
          )

        case Entities.save(entity) do
          {:ok, _} ->
            {:ok, "Storyline '#{key}' (#{name}) created.", socket}

          {:error, reason} ->
            {:error, "Failed to create storyline: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:delete_storyline, %{key: key}, socket) do
    case Entities.find_one(key: key, type: :storyline) do
      {:ok, storyline} ->
        case Entities.delete(storyline.id) do
          {:ok, _} ->
            {:ok, "Storyline '#{key}' deleted.", socket}

          {:error, reason} ->
            {:error, "Failed to delete storyline: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "Storyline '#{key}' not found.", socket}
    end
  end

  def execute(:storyline_info, %{key: key}, socket) do
    case Entities.find_one(key: key, type: :storyline) do
      {:ok, obj} ->
        yaml_text = Helpers.format_entity(obj)
        {:ok, "Storyline '#{key}'#{Helpers.draft_tag(obj)}:\n#{yaml_text}", socket}

      {:error, :not_found} ->
        {:error, "Storyline '#{key}' not found.", socket}
    end
  end
end
