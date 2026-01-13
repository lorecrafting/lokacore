defmodule LokaWeb.AdminLive.ScriptsTab do
  @moduledoc """
  Scripts tab component for the admin interface.
  Displays script list and Elixir script editor form.
  """
  use LokaWeb, :live_component

  @impl true
  def render(%{form: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Scripts ({length(@scripts || [])})</h2>
        <button phx-click="new_script" class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> New Script
        </button>
      </div>

      <div :if={@scripts && length(@scripts) > 0} class="admin-table-wrapper">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Hook</th>
              <th>Enabled</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={script <- @scripts} class="hover">
              <td class="font-semibold">{script.name}</td>
              <td>
                <span class="badge badge-outline">{script.hook || "custom"}</span>
              </td>
              <td>
                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                  checked={script.enabled}
                  phx-click="toggle_script"
                  phx-value-id={script.id}
                />
              </td>
              <td>{Calendar.strftime(script.updated_at, "%Y-%m-%d %H:%M")}</td>
              <td class="admin-table-actions">
                <button phx-click="edit_script" phx-value-id={script.id} class="btn btn-ghost btn-xs">
                  Edit
                </button>
                <button phx-click="test_script" phx-value-id={script.id} class="btn btn-ghost btn-xs">
                  Test
                </button>
                <button
                  phx-click="delete_script"
                  phx-value-id={script.id}
                  data-confirm="Are you sure you want to delete this script?"
                  class="btn btn-ghost btn-xs text-error"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@scripts == [] or @scripts == nil} class="card bg-base-200">
        <div class="card-body">
          <p class="admin-empty-text mb-4">
            No scripts created yet. Scripts allow you to customize NPC behavior using sandboxed Elixir.
          </p>
          <pre class="admin-code bg-base-300"><code>{example_elixir_script()}</code></pre>
        </div>
      </div>
    </div>
    """
  end

  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">{if @editing, do: "Edit Script", else: "Create Script"}</h2>
        <button phx-click="cancel_form" class="btn btn-ghost btn-sm">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <.form for={@form} phx-submit="save_script" class="admin-form">
            <.input field={@form[:name]} type="text" label="Script Name" required />
            <.input field={@form[:description]} type="text" label="Description" />
            <.input
              field={@form[:hook]}
              type="select"
              label="Hook"
              options={[
                {"Custom", "custom"},
                {"On Enter", "on_enter"},
                {"On Leave", "on_leave"},
                {"On Look", "on_look"},
                {"On Attack", "on_attack"},
                {"On Tick", "on_tick"},
                {"On Say", "on_say"},
                {"On Give", "on_give"},
                {"On Use", "on_use"}
              ]}
            />
            <.input
              field={@form[:source]}
              type="textarea"
              label="Elixir Script"
              rows="12"
              class="font-mono text-sm"
              placeholder="# Enter your Elixir script here"
            />
            <.input field={@form[:enabled]} type="checkbox" label="Enabled" />
            <div class="admin-form-actions">
              <button type="button" phx-click="cancel_form" class="btn btn-ghost">Cancel</button>
              <button type="submit" class="btn btn-primary">
                {if @editing, do: "Update Script", else: "Create Script"}
              </button>
            </div>
          </.form>
        </div>
      </div>
    </div>
    """
  end

  defp example_elixir_script do
    """
    # Example NPC script - runs when player looks at this entity
    # Available: entity, player, context, say.(), message.(), etc.

    if quest_active?.("main_quest") do
      say.("The elder watches you with interest...")
      {:append, "They seem to know something about your quest."}
    else
      :default
    end
    """
  end
end
