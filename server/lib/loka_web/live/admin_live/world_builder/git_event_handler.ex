defmodule LokaWeb.AdminLive.WorldBuilder.GitEventHandler do
  @moduledoc """
  Event handlers for Git commit modal operations in World Builder.

  Extracted from WorldBuilderLive to reduce file size and improve maintainability.
  Handles git status, diff, commit, push, and world export operations.
  """

  import Phoenix.Component, only: [assign: 3]
  import Phoenix.LiveView, only: [push_event: 3]

  alias Loka.WorldBuilder.GitManager

  def handle_event("show_commit_modal", _params, socket) do
    {status, commit_msg} =
      case GitManager.status() do
        {:ok, status} ->
          msg = GitManager.generate_commit_message()
          {status, msg}

        {:error, _} ->
          {%{modified: [], added: [], deleted: []}, ""}
      end

    {:noreply,
     socket
     |> assign(:show_commit_modal, true)
     |> assign(:git_status, status)
     |> assign(:git_diff, "")
     |> assign(:commit_message, commit_msg)
     |> assign(:commit_result, nil)}
  end

  def handle_event("close_commit_modal", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_commit_modal, false)
     |> assign(:git_status, %{modified: [], added: [], deleted: []})
     |> assign(:git_diff, "")
     |> assign(:commit_message, "")
     |> assign(:is_committing, false)
     |> assign(:is_pushing, false)
     |> assign(:commit_result, nil)}
  end

  def handle_event("refresh_git_status", _params, socket) do
    {status, commit_msg} =
      case GitManager.status() do
        {:ok, status} ->
          msg = GitManager.generate_commit_message()
          {status, msg}

        {:error, _} ->
          {%{modified: [], added: [], deleted: []}, ""}
      end

    {:noreply,
     socket
     |> assign(:git_status, status)
     |> assign(:commit_message, commit_msg)
     |> log_console(:info, "Git status refreshed")}
  end

  def handle_event("show_file_diff", %{"file" => file_path}, socket) do
    diff =
      case GitManager.diff(file_path) do
        {:ok, diff_output} -> diff_output
        {:error, _} -> "Failed to load diff"
      end

    {:noreply, assign(socket, :git_diff, diff)}
  end

  def handle_event("update_commit_message", %{"value" => message}, socket) do
    {:noreply, assign(socket, :commit_message, message)}
  end

  def handle_event("stage_and_commit", _params, socket) do
    message = socket.assigns.commit_message

    socket = assign(socket, :is_committing, true)

    result =
      with :ok <- GitManager.stage(:all),
           {:ok, hash} <- GitManager.commit(message) do
        {:ok, hash}
      end

    socket =
      case result do
        {:ok, hash} ->
          {new_status, new_msg} =
            case GitManager.status() do
              {:ok, s} -> {s, GitManager.generate_commit_message()}
              {:error, _} -> {%{modified: [], added: [], deleted: []}, ""}
            end

          socket
          |> assign(:is_committing, false)
          |> assign(:git_status, new_status)
          |> assign(:commit_message, new_msg)
          |> assign(:git_diff, "")
          |> assign(:commit_result, %{status: "success", message: "Committed: #{hash}"})
          |> log_console(:info, "Committed changes: #{hash}")

        {:error, reason} ->
          socket
          |> assign(:is_committing, false)
          |> assign(:commit_result, %{status: "error", message: "#{reason}"})
          |> log_console(:error, "Commit failed: #{reason}")
      end

    {:noreply, socket}
  end

  def handle_event("push_commits", _params, socket) do
    socket = assign(socket, :is_pushing, true)

    socket =
      case GitManager.push() do
        :ok ->
          socket
          |> assign(:is_pushing, false)
          |> assign(:commit_result, %{status: "success", message: "Pushed to remote"})
          |> log_console(:info, "Pushed commits to remote")

        {:error, reason} ->
          socket
          |> assign(:is_pushing, false)
          |> assign(:commit_result, %{status: "error", message: "Push failed: #{reason}"})
          |> log_console(:error, "Push failed: #{reason}")
      end

    {:noreply, socket}
  end

  def handle_event("export_world_zip", _params, socket) do
    case GitManager.export_zip() do
      {:ok, zip_path} ->
        {:noreply,
         socket
         |> assign(:commit_result, %{status: "success", message: "Exported: #{zip_path}"})
         |> log_console(:info, "Exported world content to #{zip_path}")
         |> push_event("download_file", %{path: zip_path})}

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:commit_result, %{status: "error", message: "Export failed: #{reason}"})
         |> log_console(:error, "Export failed: #{reason}")}
    end
  end

  defp log_console(socket, level, text) do
    message = %{timestamp: DateTime.utc_now(), level: level, text: text}
    assign(socket, :console_messages, socket.assigns.console_messages ++ [message])
  end
end
