defmodule LokaWeb.AdminLive.WorldBuilder.ConfirmationModal do
  @moduledoc """
  Reusable confirmation modal component for World Builder.

  Displays a confirmation dialog with customizable title, message, warning, and styling.
  Supports danger mode for destructive actions.

  ## Usage

      <ConfirmationModal.confirmation_modal
        modal={@confirm_modal}
        on_confirm="execute_confirm"
        on_cancel="cancel_confirm"
      />

  Where `@confirm_modal` is a map with:
  - `:title` - Modal title (required)
  - `:message` - Main message text (required)
  - `:warning` - Optional warning text (displayed in amber)
  - `:danger` - If true, confirm button is red (default: false)
  - `:confirm_text` - Custom confirm button text (default: "Confirm")
  - `:action` - Action identifier for the handler
  - `:data` - Additional data to pass to the handler
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents, only: [icon: 1]

  attr :modal, :map, default: nil
  attr :on_confirm, :string, default: "execute_confirm"
  attr :on_cancel, :string, default: "cancel_confirm"

  def confirmation_modal(assigns) do
    ~H"""
    <%= if @modal do %>
      <div class="modal-overlay" phx-click={@on_cancel}>
        <div
          class="modal-content"
          style="max-width: 400px;"
          phx-click-away={@on_cancel}
        >
          <div class="modal-header">
            <h3>{@modal.title}</h3>
            <button phx-click={@on_cancel} class="modal-close">&times;</button>
          </div>
          <div style="padding: 1rem;">
            <p style="margin: 0 0 1rem 0; color: #ccc;">{@modal.message}</p>
            <%= if @modal[:warning] do %>
              <p style="margin: 0 0 1rem 0; color: #f59e0b; font-size: 0.85rem;">
                <.icon
                  name="hero-exclamation-triangle"
                  class="size-4"
                  style="display: inline; vertical-align: middle;"
                />
                {@modal.warning}
              </p>
            <% end %>
          </div>
          <div class="modal-footer">
            <button type="button" phx-click={@on_cancel} class="btn btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              phx-click={@on_confirm}
              class={["btn", (@modal[:danger] && "btn-danger") || "btn-primary"]}
            >
              {@modal[:confirm_text] || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    <% end %>
    """
  end
end
