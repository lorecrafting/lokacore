defmodule Loka.Engine.Script.Sandbox do
  @moduledoc """
  Sandboxed Elixir script execution.

  Executes builder scripts in a controlled environment with:
  - Static validation before execution
  - Restricted bindings (no dangerous functions)
  - Timeout protection
  - Rate limiting via ActionQueue
  - Result size limits

  ## Security Model

  1. **Pre-execution validation**: Scripts are validated against forbidden
     patterns before they can be saved or executed.

  2. **Restricted bindings**: Scripts only have access to functions explicitly
     provided in the Bindings module. They cannot call arbitrary Elixir code.

  3. **Timeout protection**: Scripts are killed if they exceed the timeout.

  4. **Action queuing**: Side effects are queued, not executed directly,
     allowing for rate limiting and rollback.

  ## Usage

      # Execute a script
      {:ok, result, actions} = Sandbox.execute(source, entity, context)

      # Execute actions if script succeeded
      ActionQueue.execute_all(actions)

  ## Example Script

      # Check quest state for dialogue branching
      cond do
        quest_active?("main_quest") ->
          say("You're on the right path!")
          :handled

        quest_complete?("intro") ->
          {:append, "The elder nods approvingly."}

        true ->
          :default
      end
  """

  require Logger

  alias Loka.Engine.Script.{Validator, Bindings, ActionQueue}

  @default_timeout 5_000
  @max_result_size 10_000

  @type execute_result ::
          {:ok, term(), [ActionQueue.action()]}
          | {:error, :timeout}
          | {:error, :validation_failed}
          | {:error, {:exception, term()}}
          | {:error, :result_too_large}

  @doc """
  Execute a builder script in a sandboxed environment.

  ## Parameters

  - `source` - Elixir script source code
  - `entity` - The entity the script is attached to
  - `context` - Event context (player, trigger, args, etc.)
  - `opts` - Execution options

  ## Options

  - `:timeout` - Execution timeout in milliseconds (default: #{@default_timeout})
  - `:validate` - Whether to validate before execution (default: true)
  - `:extra_bindings` - Additional bindings to provide

  ## Returns

  - `{:ok, result, actions}` - Script succeeded, returns result and queued actions
  - `{:error, :timeout}` - Script exceeded timeout
  - `{:error, :validation_failed}` - Script failed validation
  - `{:error, {:exception, reason}}` - Script raised an exception
  - `{:error, :result_too_large}` - Script returned too much data
  """
  @spec execute(String.t(), map(), map(), keyword()) :: execute_result()
  def execute(source, entity, context \\ %{}, opts \\ []) when is_binary(source) do
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    validate? = Keyword.get(opts, :validate, true)
    extra_bindings = Keyword.get(opts, :extra_bindings, [])

    start_time = System.monotonic_time()

    result =
      if validate? do
        with :ok <- Validator.validate(source) do
          do_execute(source, entity, context, extra_bindings, timeout)
        else
          {:error, reason} ->
            Logger.warning("[Sandbox] Validation failed: #{inspect(reason)}")
            {:error, :validation_failed}
        end
      else
        do_execute(source, entity, context, extra_bindings, timeout)
      end

    # Emit telemetry
    duration = System.monotonic_time() - start_time

    :telemetry.execute(
      [:loka, :script, :elixir, :execute],
      %{duration: duration},
      %{
        entity_id: Map.get(entity, :id),
        entity_type: Map.get(entity, :type),
        success: match?({:ok, _, _}, result),
        error_type: error_type(result),
        script_length: byte_size(source)
      }
    )

    result
  end

  @doc """
  Execute a script without validation (for pre-validated scripts).
  """
  @spec execute_trusted(String.t(), map(), map(), keyword()) :: execute_result()
  def execute_trusted(source, entity, context \\ %{}, opts \\ []) do
    execute(source, entity, context, Keyword.put(opts, :validate, false))
  end

  @doc """
  Validate a script without executing it.
  """
  @spec validate(String.t()) :: :ok | {:error, term()}
  defdelegate validate(source), to: Validator

  @doc """
  Validate with detailed error information for UI.
  """
  @spec validate_with_details(String.t()) :: :ok | {:error, map()}
  defdelegate validate_with_details(source), to: Validator

  # Internal execution logic
  defp do_execute(source, entity, context, extra_bindings, timeout) do
    # Build bindings
    bindings = Bindings.build(entity, context, extra_bindings)

    # Create task for timeout protection
    task =
      Task.async(fn ->
        # Initialize action queue
        ActionQueue.init()

        try do
          # Execute the script with restricted bindings
          # We don't pass a custom __ENV__ since it causes issues with binding access
          {result, _new_bindings} = Code.eval_string(source, bindings)

          # Get queued actions
          actions = ActionQueue.get()

          {:ok, result, actions}
        rescue
          e ->
            Logger.warning("[Sandbox] Script exception: #{Exception.message(e)}")
            {:error, {:exception, Exception.message(e)}}
        after
          ActionQueue.clear()
        end
      end)

    # Wait for completion with timeout
    case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
      {:ok, {:ok, result, actions}} ->
        case validate_result_size(result) do
          :ok -> {:ok, result, actions}
          {:error, _} = err -> err
        end

      {:ok, {:error, _} = error} ->
        error

      nil ->
        Logger.warning("[Sandbox] Script execution timed out after #{timeout}ms")
        {:error, :timeout}
    end
  end

  # Validate result size to prevent memory exhaustion
  defp validate_result_size(result) do
    size = estimate_size(result)

    if size > @max_result_size do
      Logger.warning("[Sandbox] Result size #{size} exceeds limit #{@max_result_size}")
      {:error, :result_too_large}
    else
      :ok
    end
  end

  # Estimate the size of a result
  defp estimate_size(value) when is_binary(value), do: byte_size(value)
  defp estimate_size(value) when is_number(value), do: 8
  defp estimate_size(value) when is_boolean(value), do: 1
  defp estimate_size(value) when is_nil(value), do: 0
  defp estimate_size(value) when is_atom(value), do: String.length(Atom.to_string(value))

  defp estimate_size(value) when is_list(value) do
    Enum.reduce(value, 0, fn item, acc -> acc + estimate_size(item) end)
  end

  defp estimate_size(value) when is_tuple(value) do
    value
    |> Tuple.to_list()
    |> estimate_size()
  end

  defp estimate_size(value) when is_map(value) do
    Enum.reduce(value, 0, fn {k, v}, acc ->
      acc + estimate_size(k) + estimate_size(v)
    end)
  end

  defp estimate_size(_), do: 100

  # Categorize error for telemetry
  defp error_type({:ok, _, _}), do: nil
  defp error_type({:error, :timeout}), do: :timeout
  defp error_type({:error, :validation_failed}), do: :validation
  defp error_type({:error, {:exception, _}}), do: :exception
  defp error_type({:error, :result_too_large}), do: :result_size
  defp error_type(_), do: :unknown

  @doc """
  Returns the default timeout in milliseconds.
  """
  @spec default_timeout() :: non_neg_integer()
  def default_timeout, do: @default_timeout

  @doc """
  Returns the maximum result size in bytes.
  """
  @spec max_result_size() :: non_neg_integer()
  def max_result_size, do: @max_result_size
end
