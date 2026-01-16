defmodule Loka.WorldBuilder.GitManager do
  @moduledoc """
  Git integration for World Builder.

  Provides git operations for managing world content:
  - Status checking (changed files)
  - Diff generation
  - Committing changes
  - Optional push to remote

  All operations are scoped to priv/world/ directory.
  """
  require Logger

  @world_dir "priv/world"
  @content_dirs ["prototypes", "quests", "zones", "dialogues", "scripts", "cutscenes"]

  @doc """
  Get the current git status for world content files.

  Returns a map with:
  - modified: List of modified files
  - added: List of new untracked files
  - deleted: List of deleted files
  """
  @spec status() :: {:ok, map()} | {:error, term()}
  def status do
    case System.cmd("git", ["status", "--porcelain", @world_dir], stderr_to_stdout: true) do
      {output, 0} ->
        files = parse_status_output(output)
        {:ok, files}

      {error, _} ->
        {:error, "Git status failed: #{error}"}
    end
  end

  @doc """
  Get diff for a specific file or all world content changes.

  Returns the unified diff output.
  """
  @spec diff(String.t() | nil) :: {:ok, String.t()} | {:error, term()}
  def diff(file_path \\ nil) do
    args =
      if file_path do
        ["diff", "--", file_path]
      else
        ["diff", "--", @world_dir]
      end

    case System.cmd("git", args, stderr_to_stdout: true) do
      {output, 0} -> {:ok, output}
      {error, _} -> {:error, "Git diff failed: #{error}"}
    end
  end

  @doc """
  Get diff for staged changes.
  """
  @spec diff_staged() :: {:ok, String.t()} | {:error, term()}
  def diff_staged do
    case System.cmd("git", ["diff", "--cached", "--", @world_dir], stderr_to_stdout: true) do
      {output, 0} -> {:ok, output}
      {error, _} -> {:error, "Git diff failed: #{error}"}
    end
  end

  @doc """
  Stage files for commit.

  Accepts a list of file paths or :all to stage all world content changes.
  """
  @spec stage(list(String.t()) | :all) :: :ok | {:error, term()}
  def stage(:all) do
    case System.cmd("git", ["add", @world_dir], stderr_to_stdout: true) do
      {_, 0} -> :ok
      {error, _} -> {:error, "Git add failed: #{error}"}
    end
  end

  def stage(files) when is_list(files) do
    # Only allow staging files within world directory
    world_files = Enum.filter(files, &String.starts_with?(&1, @world_dir))

    if Enum.empty?(world_files) do
      {:error, "No valid world content files to stage"}
    else
      case System.cmd("git", ["add" | world_files], stderr_to_stdout: true) do
        {_, 0} -> :ok
        {error, _} -> {:error, "Git add failed: #{error}"}
      end
    end
  end

  @doc """
  Commit staged changes with a message.

  Returns {:ok, commit_hash} on success.
  """
  @spec commit(String.t()) :: {:ok, String.t()} | {:error, term()}
  def commit(message) when is_binary(message) do
    # First check if there are staged changes
    case System.cmd("git", ["diff", "--cached", "--quiet", "--", @world_dir],
           stderr_to_stdout: true
         ) do
      {_, 0} ->
        # Exit code 0 means no changes staged
        {:error, "No world content changes staged for commit"}

      {_, 1} ->
        # Exit code 1 means there are changes - proceed with commit
        do_commit(message)

      {error, _} ->
        {:error, "Git check failed: #{error}"}
    end
  end

  defp do_commit(message) do
    # Sanitize message to prevent command injection
    sanitized_message = String.replace(message, ~r/[^\w\s\-\.\,\:\;\(\)\[\]\!\?\'\"]/, "")

    case System.cmd("git", ["commit", "-m", sanitized_message], stderr_to_stdout: true) do
      {output, 0} ->
        # Extract commit hash from output
        case Regex.run(~r/\[[\w\-\/]+ ([a-f0-9]+)\]/, output) do
          [_, hash] -> {:ok, hash}
          _ -> {:ok, "unknown"}
        end

      {error, _} ->
        {:error, "Git commit failed: #{error}"}
    end
  end

  @doc """
  Push commits to remote.
  """
  @spec push() :: :ok | {:error, term()}
  def push do
    case System.cmd("git", ["push"], stderr_to_stdout: true, env: [{"GIT_TERMINAL_PROMPT", "0"}]) do
      {_, 0} -> :ok
      {error, _} -> {:error, "Git push failed: #{error}"}
    end
  end

  @doc """
  Get recent commit history for world content.

  Returns a list of commit summaries.
  """
  @spec log(integer()) :: {:ok, list(map())} | {:error, term()}
  def log(limit \\ 10) do
    format = "%H|%s|%an|%ar"

    case System.cmd(
           "git",
           ["log", "--oneline", "-#{limit}", "--format=#{format}", "--", @world_dir],
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        commits =
          output
          |> String.split("\n", trim: true)
          |> Enum.map(&parse_log_line/1)

        {:ok, commits}

      {error, _} ->
        {:error, "Git log failed: #{error}"}
    end
  end

  @doc """
  Generate a commit message based on changes.

  Analyzes the changed files and generates a descriptive message.
  """
  @spec generate_commit_message() :: String.t()
  def generate_commit_message do
    case status() do
      {:ok, %{modified: modified, added: added, deleted: deleted}} ->
        changes = categorize_changes(modified ++ added, deleted)
        build_message(changes)

      {:error, _} ->
        "Update world content"
    end
  end

  @doc """
  Export all world content as a ZIP file.

  Returns the path to the generated ZIP file.
  """
  @spec export_zip() :: {:ok, String.t()} | {:error, term()}
  def export_zip do
    timestamp = DateTime.utc_now() |> DateTime.to_iso8601(:basic) |> String.replace(~r/[^\d]/, "")
    zip_name = "world_export_#{timestamp}.zip"
    zip_path = Path.join(System.tmp_dir!(), zip_name)

    # Get all YAML files in world directory
    yaml_files =
      @content_dirs
      |> Enum.flat_map(fn dir ->
        Path.wildcard(Path.join([@world_dir, dir, "**/*.yml"]))
      end)

    if Enum.empty?(yaml_files) do
      {:error, "No world content files found"}
    else
      # Create ZIP file
      file_entries =
        Enum.map(yaml_files, fn path ->
          content = File.read!(path)
          # Use relative path from priv/world
          relative_path = String.replace_prefix(path, @world_dir <> "/", "")
          {String.to_charlist(relative_path), content}
        end)

      case :zip.create(String.to_charlist(zip_path), file_entries) do
        {:ok, _} ->
          Logger.info("[GitManager] Exported world content to #{zip_path}")
          {:ok, zip_path}

        {:error, reason} ->
          {:error, "Failed to create ZIP: #{inspect(reason)}"}
      end
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp parse_status_output(output) do
    lines = String.split(output, "\n", trim: true)

    Enum.reduce(lines, %{modified: [], added: [], deleted: []}, fn line, acc ->
      case String.trim(line) do
        "M " <> file -> %{acc | modified: [String.trim(file) | acc.modified]}
        " M " <> file -> %{acc | modified: [String.trim(file) | acc.modified]}
        "MM " <> file -> %{acc | modified: [String.trim(file) | acc.modified]}
        "A " <> file -> %{acc | added: [String.trim(file) | acc.added]}
        "?? " <> file -> %{acc | added: [String.trim(file) | acc.added]}
        "D " <> file -> %{acc | deleted: [String.trim(file) | acc.deleted]}
        " D " <> file -> %{acc | deleted: [String.trim(file) | acc.deleted]}
        _ -> acc
      end
    end)
  end

  defp parse_log_line(line) do
    case String.split(line, "|", parts: 4) do
      [hash, subject, author, date] ->
        %{
          hash: hash,
          subject: subject,
          author: author,
          date: date
        }

      _ ->
        %{hash: "", subject: line, author: "", date: ""}
    end
  end

  defp categorize_changes(changed_files, deleted_files) do
    categories = %{
      rooms: [],
      npcs: [],
      items: [],
      quests: [],
      dialogues: [],
      scripts: [],
      cutscenes: [],
      zones: [],
      other: []
    }

    changed =
      Enum.reduce(changed_files, categories, fn file, acc ->
        cond do
          String.contains?(file, "/rooms/") or String.contains?(file, "/prototypes/rooms/") ->
            %{acc | rooms: [file | acc.rooms]}

          String.contains?(file, "/npcs/") or String.contains?(file, "/prototypes/npcs/") ->
            %{acc | npcs: [file | acc.npcs]}

          String.contains?(file, "/items/") or String.contains?(file, "/prototypes/items/") ->
            %{acc | items: [file | acc.items]}

          String.contains?(file, "/quests/") ->
            %{acc | quests: [file | acc.quests]}

          String.contains?(file, "/dialogues/") ->
            %{acc | dialogues: [file | acc.dialogues]}

          String.contains?(file, "/scripts/") ->
            %{acc | scripts: [file | acc.scripts]}

          String.contains?(file, "/cutscenes/") ->
            %{acc | cutscenes: [file | acc.cutscenes]}

          String.contains?(file, "/zones/") ->
            %{acc | zones: [file | acc.zones]}

          true ->
            %{acc | other: [file | acc.other]}
        end
      end)

    # Mark deleted as well
    deleted_info = Enum.map(deleted_files, &{&1, :deleted})
    Map.put(changed, :deleted, deleted_info)
  end

  defp build_message(changes) do
    parts = []

    parts =
      if length(changes.rooms) > 0, do: ["#{length(changes.rooms)} room(s)" | parts], else: parts

    parts =
      if length(changes.npcs) > 0, do: ["#{length(changes.npcs)} NPC(s)" | parts], else: parts

    parts =
      if length(changes.items) > 0, do: ["#{length(changes.items)} item(s)" | parts], else: parts

    parts =
      if length(changes.quests) > 0,
        do: ["#{length(changes.quests)} quest(s)" | parts],
        else: parts

    parts =
      if length(changes.dialogues) > 0,
        do: ["#{length(changes.dialogues)} dialogue(s)" | parts],
        else: parts

    parts =
      if length(changes.scripts) > 0,
        do: ["#{length(changes.scripts)} script(s)" | parts],
        else: parts

    parts =
      if length(changes.cutscenes) > 0,
        do: ["#{length(changes.cutscenes)} cutscene(s)" | parts],
        else: parts

    parts =
      if length(changes.zones) > 0, do: ["#{length(changes.zones)} zone(s)" | parts], else: parts

    parts =
      if length(changes.deleted) > 0,
        do: ["#{length(changes.deleted)} deletion(s)" | parts],
        else: parts

    if Enum.empty?(parts) do
      "Update world content"
    else
      "Update world content: " <> Enum.join(Enum.reverse(parts), ", ")
    end
  end
end
