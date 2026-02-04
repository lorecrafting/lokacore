defmodule LokaWeb.AdminLive.TestingTab do
  @moduledoc """
  Testing tab component for the admin interface.
  Displays content validation results, balance analysis, and on-demand simulation controls.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [stat_card: 1]

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <h2 class="text-2xl font-bold">Testing Framework</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <.stat_card
          title="Validation Status"
          value={validation_status_text(@testing_data)}
          icon="hero-check-badge"
          status={validation_status(@testing_data)}
        />
        <.stat_card
          title="Rooms Reachable"
          value={rooms_reachable_text(@testing_data)}
          icon="hero-map"
          status={:neutral}
        />
        <.stat_card
          title="Balance Status"
          value={balance_status_text(@testing_data)}
          icon="hero-scale"
          status={balance_status(@testing_data)}
        />
        <.stat_card
          title="Last Run"
          value={last_run_text(@testing_data)}
          icon="hero-clock"
          status={:neutral}
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card bg-base-200">
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <h3 class="card-title">Content Validation</h3>
              <button
                phx-click="run_validators"
                phx-target={@myself}
                class="btn btn-primary btn-sm"
                disabled={@running}
              >
                {if @running == :validators, do: "Running...", else: "Run Validators"}
              </button>
            </div>

            <.validation_results :if={@testing_data.validation} validation={@testing_data.validation} />
            <p :if={!@testing_data.validation} class="opacity-70">
              No validation results yet. Click "Run Validators" to check content.
            </p>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <h3 class="card-title">Balance Analysis</h3>
              <button
                phx-click="run_balance"
                phx-target={@myself}
                class="btn btn-primary btn-sm"
                disabled={@running}
              >
                {if @running == :balance, do: "Running...", else: "Run Analysis"}
              </button>
            </div>

            <.balance_results :if={@testing_data.balance} balance={@testing_data.balance} />
            <p :if={!@testing_data.balance} class="opacity-70">
              No balance analysis yet. Click "Run Analysis" to simulate combat.
            </p>
          </div>
        </div>
      </div>

      <div class="card bg-base-200 mt-6">
        <div class="card-body">
          <h3 class="card-title mb-4">Detailed Issues</h3>

          <.issues_list :if={has_issues?(@testing_data)} testing_data={@testing_data} />
          <p :if={!has_issues?(@testing_data) && @testing_data.validation} class="opacity-70">
            No issues found. All validations passed.
          </p>
          <p :if={!has_issues?(@testing_data) && !@testing_data.validation} class="opacity-70">
            Run validators to check for issues.
          </p>
        </div>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Validation Results Component
  # =============================================================================

  attr :validation, :map, required: true

  defp validation_results(assigns) do
    ~H"""
    <div class="space-y-3">
      <.validator_row
        name="World Connectivity"
        result={@validation.world}
      />
      <.validator_row
        name="Quest Completability"
        result={@validation.quest}
      />
      <.validator_row
        name="Prototype Definitions"
        result={@validation.prototype}
      />
    </div>
    """
  end

  attr :name, :string, required: true
  attr :result, :map, required: true

  defp validator_row(assigns) do
    ~H"""
    <div class="flex items-center justify-between p-2 bg-base-300 rounded">
      <span class="font-medium">{@name}</span>
      <div class="flex items-center gap-2">
        <span :if={@result.errors > 0} class="badge badge-error">{@result.errors} errors</span>
        <span :if={@result.warnings > 0} class="badge badge-warning">
          {@result.warnings} warnings
        </span>
        <span :if={@result.errors == 0 and @result.warnings == 0} class="badge badge-success">
          Passed
        </span>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Balance Results Component
  # =============================================================================

  attr :balance, :map, required: true

  defp balance_results(assigns) do
    ~H"""
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="stat bg-base-300 rounded-lg p-4">
          <div class="stat-title">Win Rate</div>
          <div class="stat-value text-lg">{format_percent(@balance.win_rate)}</div>
        </div>
        <div class="stat bg-base-300 rounded-lg p-4">
          <div class="stat-title">Avg Turns</div>
          <div class="stat-value text-lg">{Float.round(@balance.avg_turns, 1)}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="stat bg-base-300 rounded-lg p-4">
          <div class="stat-title">Avg Damage Dealt</div>
          <div class="stat-value text-lg">{Float.round(@balance.avg_damage_dealt, 1)}</div>
        </div>
        <div class="stat bg-base-300 rounded-lg p-4">
          <div class="stat-title">Avg Damage Taken</div>
          <div class="stat-value text-lg">{Float.round(@balance.avg_damage_taken, 1)}</div>
        </div>
      </div>
      <p class="text-sm opacity-70">
        Based on {@balance.iterations} combat simulations (Level 3 vs Level 2 enemy)
      </p>
    </div>
    """
  end

  # =============================================================================
  # Issues List Component
  # =============================================================================

  attr :testing_data, :map, required: true

  defp issues_list(assigns) do
    ~H"""
    <div :if={@testing_data.validation} class="space-y-4">
      <.issue_section
        :if={length(@testing_data.validation.world.error_list) > 0}
        title="World Connectivity Errors"
        issues={@testing_data.validation.world.error_list}
        type={:error}
      />
      <.issue_section
        :if={length(@testing_data.validation.world.warning_list) > 0}
        title="World Connectivity Warnings"
        issues={@testing_data.validation.world.warning_list}
        type={:warning}
      />
      <.issue_section
        :if={length(@testing_data.validation.quest.error_list) > 0}
        title="Quest Errors"
        issues={@testing_data.validation.quest.error_list}
        type={:error}
      />
      <.issue_section
        :if={length(@testing_data.validation.quest.warning_list) > 0}
        title="Quest Warnings"
        issues={@testing_data.validation.quest.warning_list}
        type={:warning}
      />
      <.issue_section
        :if={length(@testing_data.validation.prototype.error_list) > 0}
        title="Prototype Errors"
        issues={@testing_data.validation.prototype.error_list}
        type={:error}
      />
      <.issue_section
        :if={length(@testing_data.validation.prototype.warning_list) > 0}
        title="Prototype Warnings"
        issues={@testing_data.validation.prototype.warning_list}
        type={:warning}
      />
    </div>
    """
  end

  attr :title, :string, required: true
  attr :issues, :list, required: true
  attr :type, :atom, required: true

  defp issue_section(assigns) do
    ~H"""
    <div>
      <h4 class={"font-semibold mb-2 " <> if(@type == :error, do: "text-error", else: "text-warning")}>
        {@title}
      </h4>
      <ul class="list-disc list-inside space-y-1 text-sm">
        <li :for={issue <- Enum.take(@issues, 10)}>{format_issue(issue)}</li>
        <li :if={length(@issues) > 10} class="opacity-70">
          ...and {length(@issues) - 10} more
        </li>
      </ul>
    </div>
    """
  end

  # =============================================================================
  # Event Handlers
  # =============================================================================

  @impl true
  def handle_event("run_validators", _, socket) do
    send(self(), {:run_testing, :validators})
    {:noreply, socket}
  end

  def handle_event("run_balance", _, socket) do
    send(self(), {:run_testing, :balance})
    {:noreply, socket}
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp validation_status_text(%{validation: nil}), do: "Not Run"

  defp validation_status_text(%{validation: v}) do
    total_errors = v.world.errors + v.quest.errors + v.prototype.errors
    total_warnings = v.world.warnings + v.quest.warnings + v.prototype.warnings

    cond do
      total_errors > 0 -> "#{total_errors} Errors"
      total_warnings > 0 -> "#{total_warnings} Warnings"
      true -> "All Passed"
    end
  end

  defp validation_status(%{validation: nil}), do: :neutral

  defp validation_status(%{validation: v}) do
    total_errors = v.world.errors + v.quest.errors + v.prototype.errors
    total_warnings = v.world.warnings + v.quest.warnings + v.prototype.warnings

    cond do
      total_errors > 0 -> :error
      total_warnings > 0 -> :warning
      true -> :success
    end
  end

  defp rooms_reachable_text(%{validation: nil}), do: "-"

  defp rooms_reachable_text(%{validation: v}) do
    "#{v.world.rooms_reachable}/#{v.world.rooms_checked}"
  end

  defp balance_status_text(%{balance: nil}), do: "Not Run"

  defp balance_status_text(%{balance: b}) do
    cond do
      b.win_rate >= 0.8 -> "Healthy"
      b.win_rate >= 0.5 -> "Balanced"
      b.win_rate >= 0.3 -> "Challenging"
      true -> "Too Hard"
    end
  end

  defp balance_status(%{balance: nil}), do: :neutral

  defp balance_status(%{balance: b}) do
    cond do
      b.win_rate >= 0.6 and b.win_rate <= 0.9 -> :success
      b.win_rate >= 0.4 -> :warning
      true -> :error
    end
  end

  defp last_run_text(%{last_run: nil}), do: "Never"

  defp last_run_text(%{last_run: time}) do
    diff = DateTime.diff(DateTime.utc_now(), time, :second)

    cond do
      diff < 60 -> "Just now"
      diff < 3600 -> "#{div(diff, 60)}m ago"
      diff < 86400 -> "#{div(diff, 3600)}h ago"
      true -> "#{div(diff, 86400)}d ago"
    end
  end

  defp has_issues?(%{validation: nil}), do: false

  defp has_issues?(%{validation: v}) do
    v.world.errors > 0 or v.world.warnings > 0 or
      v.quest.errors > 0 or v.quest.warnings > 0 or
      v.prototype.errors > 0 or v.prototype.warnings > 0
  end

  defp format_percent(rate) when is_float(rate) do
    "#{Float.round(rate * 100, 1)}%"
  end

  defp format_issue(issue) when is_tuple(issue) do
    issue
    |> Tuple.to_list()
    |> Enum.map(&to_string/1)
    |> Enum.join(": ")
  end

  defp format_issue(issue), do: inspect(issue)
end
