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
      "world-builder-panel world-builder-terminal bg-wb-bg font-mono text-[13px]",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="panel-tabs">
        <button class="panel-tab active" aria-label="Terminal">
          <span id="term-connection-dot" class="term-connection-dot connecting"></span>
          <.icon name="hero-command-line" class="size-4" />
          <span :if={!@collapsed}>Terminal</span>
        </button>
        <div style="flex: 1;"></div>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="terminal"
          title={if @collapsed, do: "Expand", else: "Collapse"}
          aria-label={if @collapsed, do: "Expand terminal panel", else: "Collapse terminal panel"}
          aria-expanded={to_string(!@collapsed)}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-left", else: "hero-chevron-right"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content flex flex-col !p-0" style={if @collapsed, do: "display: none;"}>
        <div
          class="flex-1 overflow-y-auto px-3 py-2 leading-relaxed"
          id="terminal-output"
          phx-hook="MudTerminal"
          data-token={@token}
          phx-update="ignore"
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
        >
        </div>

        <div
          class="flex justify-between px-3 py-1 bg-wb-term-status border-t border-wb-term-border text-xs text-wb-text-dim shrink-0"
          id="terminal-status"
        >
          <div class="flex gap-3 [&>span]:text-wb-term-text">
            <span>HP:<span id="term-hp">100/100</span></span>
            <span>MA:<span id="term-ma">100/100</span></span>
            <span>MV:<span id="term-mv">150/150</span></span>
          </div>
          <div id="term-exits">Exits: none</div>
        </div>

        <div class="flex items-center border-t border-wb-term-border bg-wb-term-input px-3 py-1.5 shrink-0">
          <span class="text-wb-term-prompt mr-2 select-none font-bold">&gt;</span>
          <input
            type="text"
            class="flex-1 bg-transparent border-none text-white font-mono text-[13px] outline-none placeholder:text-wb-term-placeholder"
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
