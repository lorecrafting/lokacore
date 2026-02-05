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
      <div
        class="bg-wb-panel-header border border-wb-border rounded-wb-lg w-[90%] max-w-[560px] max-h-[90vh] overflow-y-auto animate-[modalSlideIn_0.2s_ease-out]"
        phx-click-away="close_settings"
      >
        <div class="flex items-center justify-between p-4 border-b border-wb-border">
          <h3 class="m-0 text-wb-text-bright text-base font-semibold">World Builder Settings</h3>
          <button
            phx-click="close_settings"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
          >
            &times;
          </button>
        </div>

        <div class="modal-body">
          <div class="p-4 border-b border-wb-border">
            <h4 class="flex items-center gap-2 text-[0.9rem] font-semibold text-wb-text-bright m-0 mb-2">
              <.icon name="hero-key" class="size-4" />
              <span>AI Provider API Keys</span>
            </h4>
            <p class="text-[0.8rem] text-wb-text-muted m-0 mb-4 leading-[1.4]">
              Configure API keys for one or more AI providers. Keys are stored locally in your browser.
            </p>

            <div id="multi-api-key-config" phx-hook="MultiAPIKeyConfig" class="flex flex-col gap-4">
              <%= for provider <- @providers do %>
                <div
                  class="bg-wb-panel border border-wb-border rounded-wb-md p-3"
                  data-provider={provider.id}
                >
                  <div class="flex items-center gap-2 mb-2">
                    <.icon name={provider.icon} class="size-4" />
                    <span class="font-medium text-[0.85rem] text-wb-text-bright flex-1">
                      {provider.name}
                    </span>
                    <.render_status_badge status={
                      Map.get(@api_key_statuses, String.to_atom(provider.id), :unconfigured)
                    } />
                  </div>
                  <div class="flex gap-2">
                    <input
                      type="password"
                      id={"api-key-input-#{provider.id}"}
                      placeholder={provider.placeholder}
                      class="api-key-input flex-1 bg-wb-panel-alt border border-wb-border rounded-wb-md px-[0.6rem] py-[0.4rem] text-wb-text-bright text-[0.8rem] font-mono focus:outline-none focus:border-wb-accent placeholder:text-wb-text-faint"
                      autocomplete="off"
                      data-provider={provider.id}
                    />
                    <button
                      class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-accent text-white hover:bg-wb-accent-hover api-key-save"
                      data-provider={provider.id}
                    >
                      Save
                    </button>
                    <button
                      class="px-2 py-[0.4rem] text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
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

          <div class="p-4">
            <h4 class="flex items-center gap-2 text-[0.9rem] font-semibold text-wb-text-bright m-0 mb-2">
              <.icon name="hero-shield-check" class="size-4" />
              <span>Privacy & Security</span>
            </h4>
            <ul class="m-0 pl-5 text-[0.8rem] text-wb-text-muted leading-[1.6] [&_li]:mb-1">
              <li>API keys are stored encrypted in your browser's localStorage</li>
              <li>Keys are never transmitted to our servers</li>
              <li>All AI requests go directly to each provider's API</li>
              <li>Clear your browser data to remove all stored keys</li>
            </ul>
          </div>
        </div>

        <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
          <button
            phx-click="close_settings"
            class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    """
  end

  defp render_status_badge(assigns) do
    ~H"""
    <span class={"inline-flex items-center gap-[0.35rem] text-[0.7rem] py-[0.2rem] px-2 rounded-xl status-#{@status}"}>
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
