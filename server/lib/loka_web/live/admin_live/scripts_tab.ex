defmodule LokaWeb.AdminLive.ScriptsTab do
  @moduledoc """
  Scripts tab component for the admin interface.

  Displays YAML scripts from `priv/world/scripts/` in read-only mode.
  Scripts are edited via YAML files, not through this UI.

  ## Architecture Note

  Scripts use a YAML-only single source of truth pattern:
  - Scripts are defined in `priv/world/scripts/*.yml`
  - Loaded via `Loka.Content.Script` at startup
  - Hot-reloaded with `mix loka.reload` in dev

  Future: When non-technical builders need UI editing, scripts will
  be stored in DB with resolution order: DB first, then YAML.
  """
  use LokaWeb, :live_component

  alias Loka.Content.Script

  @impl true
  def render(%{viewing_script: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Scripts ({length(@scripts || [])})</h2>
      </div>

      <div class="alert alert-info mb-4">
        <.icon name="hero-information-circle" class="size-5" />
        <div>
          <p class="font-semibold">YAML-Only Scripts</p>
          <p class="text-sm">
            Scripts are defined in <code class="bg-base-300 px-1 rounded">priv/world/scripts/*.yml</code>.
            Edit YAML files directly and run
            <code class="bg-base-300 px-1 rounded">mix loka.reload</code>
            to apply changes.
          </p>
        </div>
      </div>

      <div :if={@scripts && length(@scripts) > 0} class="admin-table-wrapper">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Hook</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={script <- @scripts} class="hover">
              <td class="font-mono text-sm">{script.key}</td>
              <td class="font-semibold">{script.name || script.key}</td>
              <td>
                <span class="badge badge-outline">{get_hook(script) || "custom"}</span>
              </td>
              <td>
                <span :for={tag <- script.tags || []} class="badge badge-ghost badge-sm mr-1">
                  {tag}
                </span>
              </td>
              <td class="admin-table-actions">
                <button
                  phx-click="view_script"
                  phx-value-key={script.key}
                  class="btn btn-ghost btn-xs"
                >
                  View Source
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@scripts == [] or @scripts == nil} class="card bg-base-200">
        <div class="card-body">
          <p class="admin-empty-text mb-4">
            No scripts found. Create YAML files in <code>priv/world/scripts/</code> to add scripts.
          </p>
          <pre class="admin-code bg-base-300"><code>{example_yaml_script()}</code></pre>
        </div>
      </div>
    </div>
    """
  end

  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Script: {@viewing_script.key}</h2>
        <button phx-click="close_script_view" class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Close
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span class="text-sm opacity-70">Name:</span>
              <span class="font-semibold ml-2">{@viewing_script.name || @viewing_script.key}</span>
            </div>
            <div>
              <span class="text-sm opacity-70">Hook:</span>
              <span class="badge badge-outline ml-2">{get_hook(@viewing_script) || "custom"}</span>
            </div>
            <div :if={@viewing_script.description}>
              <span class="text-sm opacity-70">Description:</span>
              <span class="ml-2">{@viewing_script.description}</span>
            </div>
            <div :if={@viewing_script.tags && length(@viewing_script.tags) > 0}>
              <span class="text-sm opacity-70">Tags:</span>
              <span :for={tag <- @viewing_script.tags} class="badge badge-ghost badge-sm ml-1">
                {tag}
              </span>
            </div>
          </div>

          <div class="divider">Source Code (Read-Only)</div>

          <pre class="admin-code bg-base-300 p-4 rounded-lg overflow-x-auto"><code class="text-sm">{get_source(@viewing_script)}</code></pre>

          <div class="mt-4 text-sm opacity-70">
            <.icon name="hero-pencil" class="size-4 inline" /> To edit, modify
            <code class="bg-base-300 px-1 rounded">priv/world/scripts/{@viewing_script.key}.yml</code>
            and run <code class="bg-base-300 px-1 rounded">mix loka.reload</code>
          </div>
        </div>
      </div>
    </div>
    """
  end

  @doc """
  Loads all scripts from YAML via Content.Script.
  """
  def load_scripts do
    Script.all()
    |> Enum.sort_by(& &1.key)
  end

  defp get_hook(script) do
    Script.hook(script)
  end

  defp get_source(script) do
    Script.source(script) || "# No source code"
  end

  defp example_yaml_script do
    """
    # priv/world/scripts/guard_on_enter.yml
    key: guard_on_enter
    type: script
    name: "Guard Entry Check"
    description: "Blocks low-level players from entering"
    tags: [guard, access-control]
    data:
      hook: at_enter_room
      source: |
        if player.level < 10 do
          message("The guard blocks your path!")
          deny()
        else
          continue()
        end
    """
  end
end
