defmodule Loka.Testing.Bot.TestReporter do
  @moduledoc """
  Collects and reports test results from bot runs.

  Provides structured output for test results, including:
  - Assertion pass/fail status
  - Actions taken by the bot
  - Rooms visited
  - Quests completed
  - Errors encountered

  ## Usage

      alias Loka.Testing.Bot.TestReporter

      # Create a new report
      report = TestReporter.new("Monastery Arc Test")

      # Record events during bot run
      report = report
        |> TestReporter.record_action({:move, "north"}, :ok)
        |> TestReporter.record_room_visit("forest_clearing")
        |> TestReporter.record_quest_complete("quest_find_leaf")
        |> TestReporter.set_assertions_result(assertions_result)

      # Generate output
      TestReporter.print_summary(report)

  ## Integration with Strategies

  Strategies can use the reporter to track their test run:

      defmodule MyTestStrategy do
        alias Loka.Testing.Bot.TestReporter

        def init(opts) do
          {:ok, %{
            reporter: TestReporter.new("My Test"),
            # ...
          }}
        end

        def decide(context, state) do
          # After each action, record it
          reporter = TestReporter.record_action(state.reporter, action, result)
          # ...
        end
      end
  """

  @type action_record :: %{
          action: term(),
          result: :ok | {:error, term()},
          timestamp: DateTime.t()
        }

  @type t :: %{
          name: String.t(),
          started_at: DateTime.t(),
          ended_at: DateTime.t() | nil,
          status: :running | :passed | :failed | :error,
          actions: [action_record()],
          rooms_visited: [String.t()],
          quests_completed: [String.t()],
          quests_failed: [String.t()],
          items_collected: [String.t()],
          combat_victories: [String.t()],
          combat_defeats: [String.t()],
          errors: [term()],
          assertions: Loka.Testing.Bot.Assertions.results() | nil,
          metadata: map()
        }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Creates a new test report.
  """
  @spec new(String.t(), map()) :: t()
  def new(name, metadata \\ %{}) do
    %{
      name: name,
      started_at: DateTime.utc_now(),
      ended_at: nil,
      status: :running,
      actions: [],
      rooms_visited: [],
      quests_completed: [],
      quests_failed: [],
      items_collected: [],
      combat_victories: [],
      combat_defeats: [],
      errors: [],
      assertions: nil,
      metadata: metadata
    }
  end

  @doc """
  Records an action taken by the bot.
  """
  @spec record_action(t(), term(), :ok | {:error, term()}) :: t()
  def record_action(report, action, result) do
    record = %{
      action: action,
      result: result,
      timestamp: DateTime.utc_now()
    }

    %{report | actions: report.actions ++ [record]}
  end

  @doc """
  Records a room visit.
  """
  @spec record_room_visit(t(), String.t()) :: t()
  def record_room_visit(report, room_key) do
    if room_key in report.rooms_visited do
      report
    else
      %{report | rooms_visited: report.rooms_visited ++ [room_key]}
    end
  end

  @doc """
  Records a quest completion.
  """
  @spec record_quest_complete(t(), String.t()) :: t()
  def record_quest_complete(report, quest_id) do
    %{report | quests_completed: report.quests_completed ++ [quest_id]}
  end

  @doc """
  Records a quest failure.
  """
  @spec record_quest_failed(t(), String.t()) :: t()
  def record_quest_failed(report, quest_id) do
    %{report | quests_failed: report.quests_failed ++ [quest_id]}
  end

  @doc """
  Records an item collected.
  """
  @spec record_item_collected(t(), String.t()) :: t()
  def record_item_collected(report, item_key) do
    %{report | items_collected: report.items_collected ++ [item_key]}
  end

  @doc """
  Records a combat victory.
  """
  @spec record_combat_victory(t(), String.t()) :: t()
  def record_combat_victory(report, enemy_key) do
    %{report | combat_victories: report.combat_victories ++ [enemy_key]}
  end

  @doc """
  Records a combat defeat.
  """
  @spec record_combat_defeat(t(), String.t()) :: t()
  def record_combat_defeat(report, enemy_key) do
    %{report | combat_defeats: report.combat_defeats ++ [enemy_key]}
  end

  @doc """
  Records an error.
  """
  @spec record_error(t(), term()) :: t()
  def record_error(report, error) do
    %{report | errors: report.errors ++ [error]}
  end

  @doc """
  Sets the assertions result.
  """
  @spec set_assertions_result(t(), Loka.Testing.Bot.Assertions.results()) :: t()
  def set_assertions_result(report, assertions_result) do
    %{report | assertions: assertions_result}
  end

  @doc """
  Marks the test as complete with a status.
  """
  @spec complete(t(), :passed | :failed | :error) :: t()
  def complete(report, status) do
    %{report | status: status, ended_at: DateTime.utc_now()}
  end

  @doc """
  Automatically determines completion status based on assertions and errors.
  """
  @spec auto_complete(t()) :: t()
  def auto_complete(report) do
    alias Loka.Testing.Bot.Assertions

    status =
      cond do
        Enum.any?(report.errors) -> :error
        is_nil(report.assertions) -> :passed
        Assertions.any_failed?(report.assertions) -> :failed
        Assertions.all_passed?(report.assertions) -> :passed
        true -> :failed
      end

    complete(report, status)
  end

  @doc """
  Returns the duration of the test run in seconds.
  """
  @spec duration(t()) :: float()
  def duration(report) do
    end_time = report.ended_at || DateTime.utc_now()
    DateTime.diff(end_time, report.started_at, :millisecond) / 1000.0
  end

  @doc """
  Returns a summary map of the test results.
  """
  @spec summary(t()) :: map()
  def summary(report) do
    alias Loka.Testing.Bot.Assertions

    assertion_summary =
      if report.assertions do
        Assertions.summary(report.assertions)
      else
        %{passed: 0, failed: 0, pending: 0, errors: 0, total: 0, success: true}
      end

    %{
      name: report.name,
      status: report.status,
      duration_seconds: duration(report),
      actions_count: length(report.actions),
      rooms_visited: length(report.rooms_visited),
      quests_completed: length(report.quests_completed),
      quests_failed: length(report.quests_failed),
      items_collected: length(report.items_collected),
      combat_victories: length(report.combat_victories),
      combat_defeats: length(report.combat_defeats),
      errors_count: length(report.errors),
      assertions: assertion_summary
    }
  end

  @doc """
  Prints a formatted summary of the test results.
  """
  @spec print_summary(t()) :: :ok
  def print_summary(report) do
    alias Loka.Testing.Bot.Assertions

    status_symbol =
      case report.status do
        :passed -> "✅"
        :failed -> "❌"
        :error -> "⚠️"
        :running -> "🔄"
      end

    IO.puts("")
    IO.puts("╔════════════════════════════════════════════╗")
    IO.puts("║          TEST REPORT: #{String.pad_trailing(report.name, 20)} ║")
    IO.puts("╚════════════════════════════════════════════╝")
    IO.puts("")

    IO.puts("Status: #{status_symbol} #{report.status |> to_string() |> String.upcase()}")
    IO.puts("Duration: #{Float.round(duration(report), 2)}s")
    IO.puts("")

    IO.puts("── Actions ──")
    IO.puts("  Total actions: #{length(report.actions)}")

    failed_actions = Enum.count(report.actions, fn r -> r.result != :ok end)
    IO.puts("  Failed actions: #{failed_actions}")
    IO.puts("")

    IO.puts("── Progress ──")
    IO.puts("  Rooms visited: #{length(report.rooms_visited)}")
    IO.puts("  Quests completed: #{length(report.quests_completed)}")
    IO.puts("  Items collected: #{length(report.items_collected)}")
    IO.puts("  Combat victories: #{length(report.combat_victories)}")
    IO.puts("  Combat defeats: #{length(report.combat_defeats)}")
    IO.puts("")

    if report.assertions do
      IO.puts("── Assertions ──")
      IO.puts(Assertions.format_results(report.assertions))
      IO.puts("")
    end

    if Enum.any?(report.errors) do
      IO.puts("── Errors ──")

      Enum.each(report.errors, fn error ->
        IO.puts("  • #{inspect(error)}")
      end)

      IO.puts("")
    end

    :ok
  end

  @doc """
  Returns the report as a JSON-compatible map.
  """
  @spec to_json(t()) :: map()
  def to_json(report) do
    %{
      name: report.name,
      started_at: DateTime.to_iso8601(report.started_at),
      ended_at: report.ended_at && DateTime.to_iso8601(report.ended_at),
      status: to_string(report.status),
      duration_seconds: duration(report),
      actions:
        Enum.map(report.actions, fn r ->
          %{
            action: inspect(r.action),
            result: inspect(r.result),
            timestamp: DateTime.to_iso8601(r.timestamp)
          }
        end),
      rooms_visited: report.rooms_visited,
      quests_completed: report.quests_completed,
      quests_failed: report.quests_failed,
      items_collected: report.items_collected,
      combat_victories: report.combat_victories,
      combat_defeats: report.combat_defeats,
      errors: Enum.map(report.errors, &inspect/1),
      assertions:
        if(report.assertions,
          do: %{
            passed: length(report.assertions.passed),
            failed: length(report.assertions.failed),
            pending: length(report.assertions.pending),
            errors: length(report.assertions.errors)
          },
          else: nil
        ),
      metadata: report.metadata
    }
  end
end
