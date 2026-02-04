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
        style="width: 600px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;"
      >
        <div class="modal-header">
          <h3 id="validation-title">Validation Results</h3>
          <button phx-click="close_validation_panel" class="modal-close">&times;</button>
        </div>

        <div style="padding: 1rem; overflow-y: auto; flex: 1;">
          <!-- Summary -->
          <div class="validation-summary" style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <div
              class={[
                "validation-stat",
                @validation_results.error_count > 0 && "stat-error"
              ]}
              style="flex: 1; padding: 0.75rem; background: var(--wb-panel); border-radius: 4px; text-align: center;"
            >
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--wb-error);">
                {@validation_results.error_count}
              </div>
              <div style="font-size: 0.75rem; color: var(--wb-text-muted);">Errors</div>
            </div>
            <div
              class={[
                "validation-stat",
                @validation_results.warning_count > 0 && "stat-warning"
              ]}
              style="flex: 1; padding: 0.75rem; background: var(--wb-panel); border-radius: 4px; text-align: center;"
            >
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--wb-warning);">
                {@validation_results.warning_count}
              </div>
              <div style="font-size: 0.75rem; color: var(--wb-text-muted);">Warnings</div>
            </div>
            <div
              class="validation-stat"
              style="flex: 1; padding: 0.75rem; background: var(--wb-panel); border-radius: 4px; text-align: center;"
            >
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--wb-success);">
                {@validation_results.valid_count}
              </div>
              <div style="font-size: 0.75rem; color: var(--wb-text-muted);">Valid</div>
            </div>
          </div>

          <div
            :if={@validation_results.error_count == 0 && @validation_results.warning_count == 0}
            style="text-align: center; padding: 2rem; color: var(--wb-success);"
          >
            <.icon name="hero-check-circle" class="size-12" style="margin-bottom: 0.5rem;" />
            <p style="font-size: 1.1rem;">All content is valid!</p>
          </div>
          <!-- Errors Section -->
          <div
            :if={length(@validation_results.errors) > 0}
            class="validation-section"
            style="margin-bottom: 1rem;"
          >
            <h4 style="color: var(--wb-error); margin-bottom: 0.5rem; font-size: 0.875rem;">
              <.icon name="hero-x-circle" class="size-4" /> Errors
            </h4>
            <div
              class="validation-list"
              style="display: flex; flex-direction: column; gap: 0.25rem;"
            >
              <%= for error <- @validation_results.errors do %>
                <div
                  class="validation-item validation-error"
                  style="padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: 4px; font-size: 0.85rem; cursor: pointer;"
                  phx-click="validation_jump_to"
                  phx-value-message={error}
                >
                  <.icon
                    name="hero-exclamation-triangle"
                    class="size-3"
                    style="color: var(--wb-error); margin-right: 0.25rem;"
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
            <h4 style="color: var(--wb-warning); margin-bottom: 0.5rem; font-size: 0.875rem;">
              <.icon name="hero-exclamation-triangle" class="size-4" /> Warnings
            </h4>
            <div
              class="validation-list"
              style="display: flex; flex-direction: column; gap: 0.25rem;"
            >
              <%= for warning <- @validation_results.warnings do %>
                <div
                  class="validation-item validation-warning"
                  style="padding: 0.5rem; background: rgba(245, 158, 11, 0.1); border-radius: 4px; font-size: 0.85rem; cursor: pointer;"
                  phx-click="validation_jump_to"
                  phx-value-message={warning}
                >
                  <.icon
                    name="hero-exclamation-circle"
                    class="size-3"
                    style="color: var(--wb-warning); margin-right: 0.25rem;"
                  />
                  {warning}
                </div>
              <% end %>
            </div>
          </div>
        </div>

        <div
          class="modal-footer"
          style="padding: 0.75rem 1rem; border-top: 1px solid var(--wb-border); display: flex; justify-content: flex-end; gap: 0.5rem;"
        >
          <button phx-click="close_validation_panel" class="btn btn-secondary">Close</button>
          <button phx-click="validate_all" class="btn btn-primary">
            <.icon name="hero-arrow-path" class="size-4" />
            <span>Re-validate</span>
          </button>
        </div>
      </div>
    </div>
    """
  end
end
