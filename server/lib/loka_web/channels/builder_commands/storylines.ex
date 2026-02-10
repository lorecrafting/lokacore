defmodule LokaWeb.Channels.BuilderCommands.Storylines do
  @moduledoc """
  Storyline CRUD commands: create storyline, delete storyline, storyline info.
  """

  alias Loka.Engine.TypedObject.Loader
  alias Loka.WorldBuilder.YamlBuilder
  alias LokaWeb.Channels.BuilderCommands.Helpers

  @storylines_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "storylines"])

  def execute(:create_storyline, %{key: key, name: name}, socket) do
    case Loader.get(key) do
      {:ok, %{type: :storyline}} ->
        {:error, "Storyline '#{key}' already exists.", socket}

      _ ->
        yaml_content = YamlBuilder.build_storyline_yaml(key, name, [], [])

        Helpers.ensure_dir(@storylines_dir)

        file_path = Path.join(@storylines_dir, "#{key}.yml")

        case File.write(file_path, yaml_content) do
          :ok ->
            Loader.reload_file(file_path)
            {:ok, "Storyline '#{key}' (#{name}) created.", socket}

          {:error, reason} ->
            {:error, "Failed to create storyline: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:delete_storyline, %{key: key}, socket) do
    file_path = Path.join(@storylines_dir, "#{key}.yml")

    if File.exists?(file_path) do
      case File.rm(file_path) do
        :ok ->
          Loader.remove(key)
          {:ok, "Storyline '#{key}' deleted.", socket}

        {:error, reason} ->
          {:error, "Failed to delete storyline: #{inspect(reason)}", socket}
      end
    else
      {:error, "Storyline '#{key}' not found.", socket}
    end
  end

  def execute(:storyline_info, %{key: key}, socket) do
    case Loader.get(key) do
      {:ok, %{type: :storyline} = obj} ->
        yaml_text = Helpers.format_typed_object(obj)
        {:ok, "Storyline '#{key}'#{Helpers.draft_tag(obj)}:\n#{yaml_text}", socket}

      _ ->
        {:error, "Storyline '#{key}' not found.", socket}
    end
  end
end
