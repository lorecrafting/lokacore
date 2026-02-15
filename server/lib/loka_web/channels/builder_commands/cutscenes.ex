defmodule LokaWeb.Channels.BuilderCommands.Cutscenes do
  @moduledoc """
  Cutscene CRUD commands: create cutscene, delete cutscene, cutscene info.
  """

  alias Loka.Engine.Entities
  alias Loka.WorldBuilder.YamlBuilder
  alias LokaWeb.Channels.BuilderCommands.Helpers

  @cutscenes_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "cutscenes"])

  def execute(:create_cutscene, %{key: key, name: name}, socket) do
    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, _} ->
        {:error, "Cutscene '#{key}' already exists.", socket}

      {:error, :not_found} ->
        default_scenes = [
          %{"type" => "narration", "text" => "A new scene begins...", "delay" => 2000}
        ]

        yaml_content = YamlBuilder.build_cutscene_yaml(key, name, "manual", default_scenes)

        Helpers.ensure_dir(@cutscenes_dir)

        file_path = Path.join(@cutscenes_dir, "#{key}.yml")

        case File.write(file_path, yaml_content) do
          :ok ->
            {:ok, "Cutscene '#{key}' (#{name}) created.", socket}

          {:error, reason} ->
            {:error, "Failed to create cutscene: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:delete_cutscene, %{key: key}, socket) do
    file_path = Path.join(@cutscenes_dir, "#{key}.yml")

    if File.exists?(file_path) do
      case File.rm(file_path) do
        :ok ->
          {:ok, "Cutscene '#{key}' deleted.", socket}

        {:error, reason} ->
          {:error, "Failed to delete cutscene: #{inspect(reason)}", socket}
      end
    else
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
