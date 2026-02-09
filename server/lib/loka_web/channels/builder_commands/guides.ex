defmodule LokaWeb.Channels.BuilderCommands.Guides do
  @moduledoc """
  Guide command: reads builder reference guides from priv/world_builder/guides/.
  """

  def execute(:guide, %{topic: topic}, socket) do
    if String.contains?(topic, "..") or String.contains?(topic, "/") do
      {:error, "Invalid topic name.", socket}
    else
      serve_guide(topic, socket)
    end
  end

  defp serve_guide(topic, socket) do
    guide_dir = Application.app_dir(:loka, "priv/world_builder/guides")
    filename = "#{topic}.md"
    path = Path.join(guide_dir, filename)

    case File.read(path) do
      {:ok, content} ->
        # Truncate for terminal display
        truncated =
          if String.length(content) > 2000 do
            String.slice(content, 0, 2000) <>
              "\n... (truncated, #{String.length(content)} chars total)"
          else
            content
          end

        {:ok, "--- Guide: #{topic} ---\n#{truncated}", socket}

      {:error, _} ->
        # List available guides
        case File.ls(guide_dir) do
          {:ok, files} ->
            topics =
              files
              |> Enum.filter(&String.ends_with?(&1, ".md"))
              |> Enum.map(&String.replace_suffix(&1, ".md", ""))
              |> Enum.join(", ")

            {:error, "Guide '#{topic}' not found. Available: #{topics}", socket}

          {:error, _} ->
            {:error, "Guide '#{topic}' not found. No guides directory.", socket}
        end
    end
  end
end
