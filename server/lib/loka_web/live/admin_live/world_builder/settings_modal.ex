defmodule LokaWeb.AdminLive.WorldBuilder.SettingsModal do
  @moduledoc """
  Settings modal for World Builder.

  Provides:
  - Multi-provider API key configuration (BYOK)
  - Model selection per provider
  - Other world builder settings
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :show, :boolean, required: true

  attr :api_key_statuses, :map,
    default: %{
      anthropic: :unconfigured,
      openai: :unconfigured,
      deepseek: :unconfigured,
      gemini: :unconfigured,
      glm: :unconfigured,
      minimax: :unconfigured
    }

  attr :selected_model, :string, default: "claude-opus-4-5-20251101"

  @providers [
    %{id: "anthropic", name: "Anthropic", placeholder: "sk-ant-...", icon: "hero-sparkles"},
    %{id: "openai", name: "OpenAI", placeholder: "sk-...", icon: "hero-bolt"},
    %{id: "deepseek", name: "DeepSeek", placeholder: "sk-...", icon: "hero-beaker"},
    %{id: "gemini", name: "Google Gemini", placeholder: "AIza...", icon: "hero-globe-alt"},
    %{id: "glm", name: "GLM (Zhipu AI)", placeholder: "...", icon: "hero-cpu-chip"},
    %{id: "minimax", name: "Minimax", placeholder: "...", icon: "hero-square-3-stack-3d"}
  ]

  @doc """
  Renders the settings modal.

  API key status can be:
  - :unconfigured - no key entered
  - :validating - currently validating
  - :valid - key validated successfully
  - :invalid - key validation failed
  """
  def settings_modal(assigns) do
    assigns = assign(assigns, :providers, @providers)

    ~H"""
    <div :if={@show} class="modal-overlay">
      <div class="settings-modal settings-modal-wide" phx-click-away="close_settings">
        <div class="modal-header">
          <h3>World Builder Settings</h3>
          <button phx-click="close_settings" class="modal-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="settings-section">
            <h4>
              <.icon name="hero-key" class="size-4" />
              <span>AI Provider API Keys</span>
            </h4>
            <p class="settings-description">
              Configure API keys for one or more AI providers. Keys are stored locally in your browser.
            </p>

            <div id="multi-api-key-config" phx-hook="MultiAPIKeyConfig" class="api-key-providers">
              <%= for provider <- @providers do %>
                <div class="api-key-provider" data-provider={provider.id}>
                  <div class="provider-header">
                    <.icon name={provider.icon} class="size-4" />
                    <span class="provider-name">{provider.name}</span>
                    <.render_status_badge status={
                      Map.get(@api_key_statuses, String.to_atom(provider.id), :unconfigured)
                    } />
                  </div>
                  <div class="api-key-input-group">
                    <input
                      type="password"
                      id={"api-key-input-#{provider.id}"}
                      placeholder={provider.placeholder}
                      class="api-key-input"
                      autocomplete="off"
                      data-provider={provider.id}
                    />
                    <button class="btn btn-primary btn-sm api-key-save" data-provider={provider.id}>
                      Save
                    </button>
                    <button
                      class="btn btn-secondary btn-sm api-key-clear"
                      data-provider={provider.id}
                      title="Remove key"
                    >
                      <.icon name="hero-trash" class="size-3" />
                    </button>
                  </div>
                </div>
              <% end %>
            </div>
          </div>

          <div class="settings-section">
            <h4>
              <.icon name="hero-shield-check" class="size-4" />
              <span>Privacy & Security</span>
            </h4>
            <ul class="privacy-list">
              <li>API keys are stored encrypted in your browser's localStorage</li>
              <li>Keys are never transmitted to our servers</li>
              <li>All AI requests go directly to each provider's API</li>
              <li>Clear your browser data to remove all stored keys</li>
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
    """
  end

  defp render_status_badge(assigns) do
    ~H"""
    <span class={"status-badge status-#{@status}"}>
      <%= case @status do %>
        <% :unconfigured -> %>
          <.icon name="hero-minus-circle" class="size-3" />
        <% :validating -> %>
          <.icon name="hero-arrow-path" class="size-3 animate-spin" />
        <% :valid -> %>
          <.icon name="hero-check-circle" class="size-3" />
        <% :invalid -> %>
          <.icon name="hero-x-circle" class="size-3" />
      <% end %>
    </span>
    """
  end
end
