defmodule LokaWeb.Channels.BuilderCommands.Cutscenes do
  @moduledoc """
  Cutscene CRUD commands: create cutscene, delete cutscene, cutscene info.
  """

  alias Loka.Engine.TypedObject.Loader
  alias Loka.WorldBuilder.YamlBuilder
  alias LokaWeb.Channels.BuilderCommands.Helpers

  @cutscenes_dir Path.join([:code.priv_dir(:loka), "world", "cutscenes"])

  def execute(:create_cutscene, %{key: key, name: name}, socket) do
    case Loader.get(key) do
      {:ok, %{type: :cutscene}} ->
        {:error, "Cutscene '#{key}' already exists.", socket}

      _ ->
        default_scenes = [
          %{"type" => "narration", "text" => "A new scene begins...", "delay" => 2000}
        ]

        yaml_content = YamlBuilder.build_cutscene_yaml(key, name, "manual", default_scenes)

        Helpers.ensure_dir(@cutscenes_dir)

        file_path = Path.join(@cutscenes_dir, "#{key}.yml")

        case File.write(file_path, yaml_content) do
          :ok ->
            Loader.reload_file(file_path)
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
          Loader.remove(key)
          {:ok, "Cutscene '#{key}' deleted.", socket}

        {:error, reason} ->
          {:error, "Failed to delete cutscene: #{inspect(reason)}", socket}
      end
    else
      {:error, "Cutscene '#{key}' not found.", socket}
    end
  end

  def execute(:cutscene_info, %{key: key}, socket) do
    case Loader.get(key) do
      {:ok, %{type: :cutscene} = obj} ->
        yaml_text = Helpers.format_typed_object(obj)
        {:ok, "Cutscene '#{key}':\n#{yaml_text}", socket}

      _ ->
        {:error, "Cutscene '#{key}' not found.", socket}
    end
  end
end
