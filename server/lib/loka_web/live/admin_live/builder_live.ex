defmodule LokaWeb.AdminLive.BuilderLive do
  @moduledoc """
  Terminal-first World Builder LiveView.

  Full-screen MUD terminal with builder commands and AI integration.
  Replaces the GUI-based WorldBuilderLive with a terminal-native workflow.
  """
  use LokaWeb, :live_view

  alias Loka.WorldBuilder.Projects

  @impl true
  def mount(_params, _session, socket) do
    projects = Projects.list_projects()
    token = generate_terminal_token(socket)

    current_project =
      case projects do
        [first | _] -> first
        [] -> nil
      end

    {:ok,
     socket
     |> assign(:token, token)
     |> assign(:projects, projects)
     |> assign(:current_project, current_project)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.admin flash={@flash}>
      <div class="builder-layout">
        <header class="builder-header">
          <div class="flex items-center gap-3">
            <a
              href={~p"/admin"}
              class="text-base-content/50 hover:text-base-content transition-colors"
            >
              <.icon name="hero-arrow-left" class="size-4" />
            </a>
            <span class="text-sm font-semibold text-base-content">Builder</span>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-xs text-base-content/50">Project:</label>
            <select
              name="project"
              class="select select-xs select-bordered bg-base-100 text-base-content min-w-[160px]"
              phx-change="select_project"
            >
              <option :if={@projects == []} value="">No projects</option>
              <option
                :for={project_key <- @projects}
                value={project_key}
                selected={@current_project == project_key}
              >
                {project_key}
              </option>
            </select>
          </div>
        </header>

        <div class="builder-terminal">
          <div class="world-builder-terminal h-full flex flex-col">
            <div
              class="flex-1 overflow-y-auto px-3 py-2 leading-relaxed font-mono text-[13px]"
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
              class="flex justify-between px-3 py-1 bg-base-300 border-t border-base-content/10 text-xs text-base-content/50 shrink-0"
              id="terminal-status"
            >
              <div class="flex gap-3">
                <span>HP:<span id="term-hp" class="text-base-content/70">100/100</span></span>
                <span>MA:<span id="term-ma" class="text-base-content/70">100/100</span></span>
                <span>MV:<span id="term-mv" class="text-base-content/70">150/150</span></span>
              </div>
              <div class="flex gap-3">
                <span id="term-mode" class="text-primary font-medium">NORMAL</span>
                <span id="term-exits">Exits: none</span>
              </div>
            </div>

            <div class="flex items-center border-t border-base-content/10 bg-base-300 px-3 py-1.5 shrink-0">
              <span id="term-connection-dot" class="term-connection-dot connecting"></span>
              <span class="text-green-400 mr-2 select-none font-bold font-mono">&gt;</span>
              <input
                type="text"
                class="flex-1 bg-transparent border-none text-base-content font-mono text-[13px] outline-none placeholder:text-base-content/30"
                id="terminal-command-input"
                placeholder="Enter command..."
                autocomplete="off"
                phx-update="ignore"
              />
            </div>
          </div>
        </div>
      </div>
    </Layouts.admin>
    """
  end

  @impl true
  def handle_event("select_project", %{"project" => key}, socket) do
    {:noreply, assign(socket, :current_project, key)}
  end

  # Generate JWT token for the terminal panel's GameChannel connection
  defp generate_terminal_token(socket) do
    player = socket.assigns[:current_scope] && socket.assigns.current_scope.player

    if player do
      case Loka.Auth.Guardian.encode_and_sign(player, %{}, token_type: "access") do
        {:ok, token, _claims} -> token
        {:error, _reason} -> ""
      end
    else
      ""
    end
  end
end
