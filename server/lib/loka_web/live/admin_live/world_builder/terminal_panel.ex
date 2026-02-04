defmodule LokaWeb.AdminLive.WorldBuilder.TerminalPanel do
  @moduledoc """
  MUD terminal panel component for the World Builder.

  Provides a real text-based MUD client embedded as a resizable column panel.
  Connects to GameChannel via JS hook with a JWT token. The authenticated
  admin gets builder commands (goto, spawn, give, etc.) for rapid content testing.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :collapsed, :boolean, default: true
  attr :token, :string, default: ""
  attr :class, :string, default: ""

  def terminal_panel(assigns) do
    ~H"""
    <div class={[
      "world-builder-panel world-builder-terminal",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="panel-tabs">
        <button class="panel-tab active">
          <.icon name="hero-command-line" class="size-4" />
          <span :if={!@collapsed}>Terminal</span>
        </button>
        <div style="flex: 1;"></div>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="terminal"
          title={if @collapsed, do: "Expand", else: "Collapse"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-left", else: "hero-chevron-right"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content" style={if @collapsed, do: "display: none;"}>
        <div
          class="terminal-output"
          id="terminal-output"
          phx-hook="MudTerminal"
          data-token={@token}
          phx-update="ignore"
        >
        </div>

        <div class="terminal-status" id="terminal-status">
          <div class="terminal-vitals">
            <span>HP:<span id="term-hp">100/100</span></span>
            <span>MA:<span id="term-ma">100/100</span></span>
            <span>MV:<span id="term-mv">150/150</span></span>
          </div>
          <div id="term-exits">Exits: none</div>
        </div>

        <div class="terminal-input-area">
          <span class="terminal-prompt">&gt;</span>
          <input
            type="text"
            class="terminal-input"
            id="terminal-command-input"
            placeholder="Enter command..."
            autocomplete="off"
            phx-update="ignore"
          />
        </div>
      </div>
    </div>
    """
  end
end
