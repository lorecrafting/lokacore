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
    <div
      :if={@modal}
      class="modal-overlay"
      phx-click={@on_cancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
    >
      <div
        class="modal-content max-w-[400px]"
        phx-click-away={@on_cancel}
      >
        <div class="flex items-center justify-between p-4 border-b border-wb-border">
          <h3 id="confirmation-title" class="m-0 text-wb-text-bright text-base font-semibold">
            {@modal.title}
          </h3>
          <button
            phx-click={@on_cancel}
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
          >
            &times;
          </button>
        </div>
        <div class="p-4">
          <p class="m-0 mb-4 text-wb-text">{@modal.message}</p>
          <p
            :if={@modal[:warning]}
            class="m-0 mb-4 text-wb-warning text-[0.85rem]"
          >
            <.icon
              name="hero-exclamation-triangle"
              class="size-4 inline align-middle"
            />
            {@modal.warning}
          </p>
        </div>
        <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
          <button
            type="button"
            phx-click={@on_cancel}
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
          >
            Cancel
          </button>
          <button
            type="button"
            phx-click={@on_confirm}
            class={[
              "px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100",
              (@modal[:danger] && "bg-wb-error text-white hover:bg-wb-error") ||
                "bg-wb-accent text-white hover:bg-wb-accent-hover"
            ]}
          >
            {@modal[:confirm_text] || "Confirm"}
          </button>
        </div>
      </div>
    </div>
    """
  end
end
