defmodule LokaWeb.AdminLive.WorldBuilder.SettingsModal do
  @moduledoc """
  Settings modal for World Builder.

  Provides:
  - API key configuration (BYOK for Anthropic)
  - Model selection
  - Other world builder settings
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :show, :boolean, required: true
  attr :api_key_status, :atom, default: :unconfigured
  attr :selected_model, :string, default: "claude-opus-4-5-20251101"

  @doc """
  Renders the settings modal.

  API key status can be:
  - :unconfigured - no key entered
  - :validating - currently validating
  - :valid - key validated successfully
  - :invalid - key validation failed
  """
  def settings_modal(assigns) do
    ~H"""
    <%= if @show do %>
      <div class="modal-overlay" phx-click="close_settings">
        <div class="settings-modal" phx-click-away="close_settings">
          <div class="modal-header">
            <h3>World Builder Settings</h3>
            <button phx-click="close_settings" class="modal-close">&times;</button>
          </div>

          <div class="modal-body">
            <div class="settings-section">
              <h4>
                <.icon name="hero-key" class="size-4" />
                <span>Anthropic API Key</span>
              </h4>
              <p class="settings-description">
                Enter your Anthropic API key to enable AI-assisted world building.
                Your key is stored locally in your browser and never sent to our servers.
              </p>

              <div id="api-key-config" phx-hook="APIKeyConfig" data-status={@api_key_status}>
                <div class="api-key-input-group">
                  <input
                    type="password"
                    id="api-key-input"
                    placeholder="sk-ant-..."
                    class="api-key-input"
                    autocomplete="off"
                  />
                  <button id="api-key-save" class="btn btn-primary">
                    Save Key
                  </button>
                </div>

                <div class="api-key-status">
                  <%= case @api_key_status do %>
                    <% :unconfigured -> %>
                      <span class="status-badge status-unconfigured">
                        <.icon name="hero-exclamation-circle" class="size-4" /> Not configured
                      </span>
                    <% :validating -> %>
                      <span class="status-badge status-validating">
                        <.icon name="hero-arrow-path" class="size-4 animate-spin" /> Validating...
                      </span>
                    <% :valid -> %>
                      <span class="status-badge status-valid">
                        <.icon name="hero-check-circle" class="size-4" /> Connected
                      </span>
                    <% :invalid -> %>
                      <span class="status-badge status-invalid">
                        <.icon name="hero-x-circle" class="size-4" /> Invalid key
                      </span>
                  <% end %>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h4>
                <.icon name="hero-cpu-chip" class="size-4" />
                <span>AI Model</span>
              </h4>
              <p class="settings-description">
                Select the Claude model to use for AI assistance.
              </p>

              <select
                id="model-selector"
                class="model-selector"
                phx-change="change_model"
                disabled={@api_key_status != :valid}
              >
                <option
                  value="claude-opus-4-5-20251101"
                  selected={@selected_model == "claude-opus-4-5-20251101"}
                >
                  Claude Opus 4.5 (Recommended)
                </option>
                <option
                  value="claude-sonnet-4-20250514"
                  selected={@selected_model == "claude-sonnet-4-20250514"}
                >
                  Claude Sonnet 4
                </option>
                <option
                  value="claude-3-5-haiku-20241022"
                  selected={@selected_model == "claude-3-5-haiku-20241022"}
                >
                  Claude 3.5 Haiku (Fast)
                </option>
              </select>
            </div>

            <div class="settings-section">
              <h4>
                <.icon name="hero-shield-check" class="size-4" />
                <span>Privacy & Security</span>
              </h4>
              <ul class="privacy-list">
                <li>Your API key is stored encrypted in your browser's localStorage</li>
                <li>Keys are never transmitted to our servers</li>
                <li>All AI requests go directly to Anthropic's API</li>
                <li>Clear your browser data to remove the stored key</li>
              </ul>
            </div>
          </div>

          <div class="modal-footer">
            <button phx-click="close_settings" class="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    <% end %>
    """
  end
end
