defmodule LokaWeb.Channels.BuilderCommands.Projects do
  @moduledoc """
  Project and document commands: project new/load/list/delete,
  doc write/read/list/delete, guide.
  """

  import Phoenix.Socket, only: [assign: 3]

  alias Loka.WorldBuilder.Projects

  def execute(:project_new, %{key: key, name: name}, socket) do
    case Projects.create_project(key, name) do
      {:ok, _doc} ->
        socket = assign(socket, :current_project, %{key: key})
        {:ok, "Project '#{key}' created and loaded.", socket}

      {:error, reason} ->
        {:error, "Failed to create project: #{inspect(reason)}", socket}
    end
  end

  def execute(:project_load, %{key: key}, socket) do
    case Projects.get_project(key) do
      {:ok, project} ->
        socket = assign(socket, :current_project, %{key: project.key})
        {:ok, "Loaded project '#{key}'.", socket}

      {:error, _} ->
        {:error, "Project '#{key}' not found.", socket}
    end
  end

  def execute(:project_list, _params, socket) do
    project_keys = Projects.list_projects()

    if project_keys == [] do
      {:ok, "No projects. Use 'project new <key> <name>' to create one.", socket}
    else
      current_key = get_in(socket.assigns, [:current_project, :key])

      lines =
        Enum.map(project_keys, fn key ->
          marker = if key == current_key, do: " *", else: ""
          "  #{key}#{marker}"
        end)
        |> Enum.join("\n")

      {:ok, "Projects (#{length(project_keys)}):\n#{lines}", socket}
    end
  end

  def execute(:project_delete, %{key: key}, socket) do
    case Projects.delete_project(key) do
      {:ok, _} ->
        socket =
          if get_in(socket.assigns, [:current_project, :key]) == key do
            assign(socket, :current_project, nil)
          else
            socket
          end

        {:ok, "Project '#{key}' deleted.", socket}

      {:error, reason} ->
        {:error, "Failed to delete project: #{inspect(reason)}", socket}
    end
  end

  def execute(:doc_write, %{filename: filename, content: content}, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])

    unless project_key do
      {:error, "No project loaded. Use 'project load <key>' first.", socket}
    else
      case Projects.write_doc(project_key, filename, content) do
        {:ok, _} -> {:ok, "Document '#{filename}' saved.", socket}
        {:error, reason} -> {:error, "Failed to save document: #{inspect(reason)}", socket}
      end
    end
  end

  def execute(:doc_read, %{filename: filename}, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])

    unless project_key do
      {:error, "No project loaded. Use 'project load <key>' first.", socket}
    else
      case Projects.get_doc(project_key, filename) do
        {:ok, doc} ->
          content = Map.get(doc, :content, "")
          {:ok, "--- #{filename} ---\n#{content}\n--- end ---", socket}

        {:error, _} ->
          {:error, "Document '#{filename}' not found.", socket}
      end
    end
  end

  def execute(:doc_list, _params, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])

    unless project_key do
      {:error, "No project loaded. Use 'project load <key>' first.", socket}
    else
      case Projects.list_docs(project_key) do
        {:ok, docs} ->
          if docs == [] do
            {:ok, "No documents in project '#{project_key}'.", socket}
          else
            lines = Enum.map(docs, fn d -> "  #{d.filename}" end) |> Enum.join("\n")
            {:ok, "Documents (#{length(docs)}):\n#{lines}", socket}
          end

        {:error, reason} ->
          {:error, "Failed to list docs: #{inspect(reason)}", socket}
      end
    end
  end

  def execute(:doc_delete, %{filename: filename}, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])

    unless project_key do
      {:error, "No project loaded. Use 'project load <key>' first.", socket}
    else
      case Projects.delete_doc(project_key, filename) do
        {:ok, _} -> {:ok, "Document '#{filename}' deleted.", socket}
        {:error, reason} -> {:error, "Failed to delete document: #{inspect(reason)}", socket}
      end
    end
  end

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
