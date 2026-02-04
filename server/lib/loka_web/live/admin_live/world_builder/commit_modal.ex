defmodule LokaWeb.AdminLive.WorldBuilder.CommitModal do
  @moduledoc """
  Commit modal component for World Builder.

  Provides a Git commit interface with:
  - Changed files list
  - Diff preview
  - Auto-generated commit message (editable)
  - Commit and push buttons
  """
  use Phoenix.Component

  attr :show, :boolean, default: false
  attr :status, :map, default: %{modified: [], added: [], deleted: []}
  attr :diff, :string, default: ""
  attr :commit_message, :string, default: ""
  attr :is_committing, :boolean, default: false
  attr :is_pushing, :boolean, default: false
  attr :last_result, :map, default: nil

  def commit_modal(assigns) do
    total_changes =
      length(assigns.status.modified) + length(assigns.status.added) +
        length(assigns.status.deleted)

    assigns = assign(assigns, :total_changes, total_changes)

    ~H"""
    <div :if={@show} class="modal-overlay" phx-click="close_commit_modal">
      <div
        class="modal-content commit-modal"
        phx-click-away="close_commit_modal"
        style="width: 800px; max-width: 95vw; max-height: 85vh;"
      >
        <div class="modal-header">
          <h3>Commit Changes</h3>
          <button phx-click="close_commit_modal" class="modal-close">&times;</button>
        </div>

        <div class="commit-modal-content">
          <div class="commit-files-section">
            <div class="section-header">
              <h4>Changed Files ({@total_changes})</h4>
              <button phx-click="refresh_git_status" class="btn-sm btn-secondary">
                Refresh
              </button>
            </div>

            <div :if={@total_changes == 0} class="no-changes">
              <p>No world content changes to commit.</p>
            </div>
            <div :if={@total_changes != 0} class="files-list">
              <%= for file <- @status.modified do %>
                <div
                  class="file-item file-modified"
                  phx-click="show_file_diff"
                  phx-value-file={file}
                >
                  <span class="file-status">M</span>
                  <span class="file-path">{format_path(file)}</span>
                </div>
              <% end %>
              <%= for file <- @status.added do %>
                <div class="file-item file-added" phx-click="show_file_diff" phx-value-file={file}>
                  <span class="file-status">A</span>
                  <span class="file-path">{format_path(file)}</span>
                </div>
              <% end %>
              <%= for file <- @status.deleted do %>
                <div
                  class="file-item file-deleted"
                  phx-click="show_file_diff"
                  phx-value-file={file}
                >
                  <span class="file-status">D</span>
                  <span class="file-path">{format_path(file)}</span>
                </div>
              <% end %>
            </div>
          </div>

          <div class="commit-diff-section">
            <div class="section-header">
              <h4>Diff Preview</h4>
            </div>
            <div class="diff-content">
              <div :if={@diff == ""} class="diff-empty">Click a file to see changes</div>
              <pre :if={@diff != ""} class="diff-text">{@diff}</pre>
            </div>
          </div>
        </div>

        <div class="commit-message-section">
          <label>Commit Message</label>
          <textarea
            value={@commit_message}
            phx-keyup="update_commit_message"
            phx-debounce="100"
            class="textarea"
            rows="2"
            placeholder="Describe your changes..."
          >{@commit_message}</textarea>
        </div>

        <div :if={@last_result} class={"commit-result #{@last_result.status}"}>
          <span class="result-icon">
            {if @last_result.status == "success", do: "✓", else: "✗"}
          </span>
          <span class="result-message">{@last_result.message}</span>
        </div>

        <div class="modal-footer">
          <button phx-click="export_world_zip" class="btn btn-secondary">
            Export ZIP
          </button>
          <div class="footer-right">
            <button phx-click="close_commit_modal" class="btn btn-secondary">
              Cancel
            </button>
            <button
              phx-click="stage_and_commit"
              class="btn btn-primary"
              disabled={@total_changes == 0 || @is_committing || @commit_message == ""}
            >
              {if @is_committing, do: "Committing...", else: "Commit"}
            </button>
            <button
              phx-click="push_commits"
              class="btn btn-success"
              disabled={@is_pushing}
            >
              {if @is_pushing, do: "Pushing...", else: "Push"}
            </button>
          </div>
        </div>
      </div>
    </div>
    """
  end

  defp format_path(path) do
    # Remove priv/world/ prefix for cleaner display
    String.replace_prefix(path, "priv/world/", "")
  end
end
