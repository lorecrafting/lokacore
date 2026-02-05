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
        class="modal-content flex flex-col"
        phx-click-away="close_commit_modal"
        class="w-[800px] max-w-[95vw] max-h-[85vh]"
      >
        <div class="flex items-center justify-between p-4 border-b border-wb-border">
          <h3 class="m-0 text-wb-text-bright text-base font-semibold">Commit Changes</h3>
          <button
            phx-click="close_commit_modal"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
          >
            &times;
          </button>
        </div>

        <div class="flex flex-1 overflow-hidden min-h-[300px]">
          <div class="w-[280px] bg-wb-panel-alt border-r border-wb-border flex flex-col">
            <div class="flex justify-between items-center px-3 py-2.5 bg-wb-input border-b border-wb-border">
              <h4 class="m-0 text-[0.85rem] text-wb-text-muted uppercase tracking-[0.5px]">
                Changed Files ({@total_changes})
              </h4>
              <button
                phx-click="refresh_git_status"
                class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
              >
                Refresh
              </button>
            </div>

            <div :if={@total_changes == 0} class="p-6 text-center text-wb-text-dim">
              <p>No world content changes to commit.</p>
            </div>
            <div :if={@total_changes != 0} class="flex-1 overflow-y-auto py-2">
              <%= for file <- @status.modified do %>
                <div
                  class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-[background] duration-150 hover:bg-wb-input"
                  phx-click="show_file_diff"
                  phx-value-file={file}
                >
                  <span class="text-[0.75rem] font-bold w-4 text-center text-wb-warning">M</span>
                  <span class="text-[0.8rem] text-wb-text overflow-hidden text-ellipsis whitespace-nowrap">
                    {format_path(file)}
                  </span>
                </div>
              <% end %>
              <%= for file <- @status.added do %>
                <div
                  class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-[background] duration-150 hover:bg-wb-input"
                  phx-click="show_file_diff"
                  phx-value-file={file}
                >
                  <span class="text-[0.75rem] font-bold w-4 text-center text-wb-success">A</span>
                  <span class="text-[0.8rem] text-wb-text overflow-hidden text-ellipsis whitespace-nowrap">
                    {format_path(file)}
                  </span>
                </div>
              <% end %>
              <%= for file <- @status.deleted do %>
                <div
                  class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-[background] duration-150 hover:bg-wb-input"
                  phx-click="show_file_diff"
                  phx-value-file={file}
                >
                  <span class="text-[0.75rem] font-bold w-4 text-center text-wb-error">D</span>
                  <span class="text-[0.8rem] text-wb-text overflow-hidden text-ellipsis whitespace-nowrap">
                    {format_path(file)}
                  </span>
                </div>
              <% end %>
            </div>
          </div>

          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex justify-between items-center px-3 py-2.5 bg-wb-input border-b border-wb-border">
              <h4 class="m-0 text-[0.85rem] text-wb-text-muted uppercase tracking-[0.5px]">
                Diff Preview
              </h4>
            </div>
            <div class="flex-1 overflow-auto bg-wb-border-dark p-3">
              <div :if={@diff == ""} class="text-wb-text-faint text-center p-8">
                Click a file to see changes
              </div>
              <pre
                :if={@diff != ""}
                class="m-0 text-[0.75rem] font-[Monaco,Menlo,Consolas,monospace] leading-[1.5] text-wb-text whitespace-pre-wrap break-words"
              >
                {@diff}
              </pre>
            </div>
          </div>
        </div>

        <div class="px-4 py-3 bg-wb-input border-t border-wb-border">
          <label class="block text-[0.8rem] text-wb-text-muted mb-1.5 font-semibold">
            Commit Message
          </label>
          <textarea
            value={@commit_message}
            phx-keyup="update_commit_message"
            phx-debounce="100"
            class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
            rows="2"
            placeholder="Describe your changes..."
          >{@commit_message}</textarea>
        </div>

        <div
          :if={@last_result}
          class={[
            "flex items-center gap-2 px-4 py-2.5 text-[0.85rem]",
            @last_result.status == "success" && "bg-[rgba(74,222,128,0.1)] text-wb-success",
            @last_result.status == "error" && "bg-[rgba(248,113,113,0.1)] text-wb-error"
          ]}
        >
          <span class="font-bold text-[1.1rem]">
            {if @last_result.status == "success", do: "✓", else: "✗"}
          </span>
          <span>{@last_result.message}</span>
        </div>

        <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
          <button
            phx-click="export_world_zip"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
          >
            Export ZIP
          </button>
          <div class="flex gap-2 ml-auto">
            <button
              phx-click="close_commit_modal"
              class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
            >
              Cancel
            </button>
            <button
              phx-click="stage_and_commit"
              class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
              disabled={@total_changes == 0 || @is_committing || @commit_message == ""}
            >
              {if @is_committing, do: "Committing...", else: "Commit"}
            </button>
            <button
              phx-click="push_commits"
              class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-quest-start text-wb-panel hover:bg-wb-quest-start-hover"
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
