defmodule LokaWeb.AdminLive.WorldBuilder.ValidationPanel do
  @moduledoc """
  Validation results panel for World Builder.

  Displays validation errors and warnings with clickable links to jump to entities.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :validation_results, :map, required: true
  attr :class, :string, default: ""

  def validation_panel(assigns) do
    ~H"""
    <div
      class="modal-overlay"
      phx-click="close_validation_panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="validation-title"
    >
      <div
        class="modal-content"
        phx-click-away="close_validation_panel"
        class="w-[600px] max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div class="flex items-center justify-between p-4 border-b border-wb-border">
          <h3 id="validation-title" class="m-0 text-wb-text-bright text-base font-semibold">
            Validation Results
          </h3>
          <button
            phx-click="close_validation_panel"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
          >
            &times;
          </button>
        </div>

        <div class="p-4 overflow-y-auto flex-1">
          <!-- Summary -->
          <div class="validation-summary flex gap-4 mb-4">
            <div class={[
              "validation-stat flex-1 p-3 bg-wb-panel rounded text-center",
              @validation_results.error_count > 0 && "stat-error"
            ]}>
              <div class="text-2xl font-bold text-wb-error">
                {@validation_results.error_count}
              </div>
              <div class="text-xs text-wb-text-muted">Errors</div>
            </div>
            <div class={[
              "validation-stat flex-1 p-3 bg-wb-panel rounded text-center",
              @validation_results.warning_count > 0 && "stat-warning"
            ]}>
              <div class="text-2xl font-bold text-wb-warning">
                {@validation_results.warning_count}
              </div>
              <div class="text-xs text-wb-text-muted">Warnings</div>
            </div>
            <div class="validation-stat flex-1 p-3 bg-wb-panel rounded text-center">
              <div class="text-2xl font-bold text-wb-success">
                {@validation_results.valid_count}
              </div>
              <div class="text-xs text-wb-text-muted">Valid</div>
            </div>
          </div>

          <div
            :if={@validation_results.error_count == 0 && @validation_results.warning_count == 0}
            class="text-center p-8 text-wb-success"
          >
            <.icon name="hero-check-circle" class="size-12 mb-2" />
            <p class="text-lg">All content is valid!</p>
          </div>
          <!-- Errors Section -->
          <div
            :if={length(@validation_results.errors) > 0}
            class="validation-section mb-4"
          >
            <h4 class="text-wb-error mb-2 text-sm">
              <.icon name="hero-x-circle" class="size-4" /> Errors
            </h4>
            <div class="validation-list flex flex-col gap-1">
              <%= for error <- @validation_results.errors do %>
                <div
                  class="validation-item validation-error p-2 bg-[color-mix(in_srgb,var(--wb-error)_10%,transparent)] rounded text-[0.85rem] cursor-pointer"
                  phx-click="validation_jump_to"
                  phx-value-message={error}
                >
                  <.icon
                    name="hero-exclamation-triangle"
                    class="size-3 text-wb-error mr-1"
                  />
                  {error}
                </div>
              <% end %>
            </div>
          </div>
          <!-- Warnings Section -->
          <div
            :if={length(@validation_results.warnings) > 0}
            class="validation-section"
          >
            <h4 class="text-wb-warning mb-2 text-sm">
              <.icon name="hero-exclamation-triangle" class="size-4" /> Warnings
            </h4>
            <div class="validation-list flex flex-col gap-1">
              <%= for warning <- @validation_results.warnings do %>
                <div
                  class="validation-item validation-warning p-2 bg-[color-mix(in_srgb,var(--wb-warning)_10%,transparent)] rounded text-[0.85rem] cursor-pointer"
                  phx-click="validation_jump_to"
                  phx-value-message={warning}
                >
                  <.icon
                    name="hero-exclamation-circle"
                    class="size-3 text-wb-warning mr-1"
                  />
                  {warning}
                </div>
              <% end %>
            </div>
          </div>
        </div>

        <div class="flex gap-2 justify-end px-4 py-3 border-t border-wb-border">
          <button
            phx-click="close_validation_panel"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
          >
            Close
          </button>
          <button
            phx-click="validate_all"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
          >
            <.icon name="hero-arrow-path" class="size-4" />
            <span>Re-validate</span>
          </button>
        </div>
      </div>
    </div>
    """
  end
end
