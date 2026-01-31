defmodule Loka.WorldBuilder.LLM.BulkGenerator do
  @moduledoc """
  Bulk content generation with progress tracking.

  Generates multiple rooms/NPCs in batch with cancellation support.

  ## Usage

      spec = %{
        count: 5,
        type: :room,
        template: %{base_key: "forest", start_x: 0, start_y: 0, spacing_x: 100},
        name_pattern: "sequential"
      }

      {:ok, generation_id} = BulkGenerator.start_generation(user_id, spec)

      # Check progress
      {:ok, progress} = BulkGenerator.get_progress(generation_id)

      # Cancel if needed
      :ok = BulkGenerator.cancel_generation(generation_id)

  ## Task Supervision

  Generation tasks are supervised and errors are logged. If a task crashes,
  the generation status is set to :failed.
  """

  use GenServer
  require Logger

  alias Loka.WorldBuilder.LLM.PreviewManager

  # Configuration
  @generation_ttl_minutes 60
  @cleanup_interval_minutes 10
  @generation_delay_ms 500

  # Task supervisor name - started by this GenServer
  @task_supervisor __MODULE__.TaskSupervisor

  # Client API

  @doc """
  Starts the BulkGenerator GenServer.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Starts a bulk generation job.

  ## Parameters

    * `user_id` - ID of the user initiating the generation
    * `spec` - Generation specification with keys:
      * `:count` - Number of items to generate
      * `:type` - Type of content (:room, :npc)
      * `:template` - Template with generation parameters
      * `:name_pattern` - Naming pattern (default: "sequential")

  ## Returns

    * `{:ok, generation_id}` - Generation started successfully
  """
  @spec start_generation(term(), map()) :: {:ok, String.t()}
  def start_generation(user_id, spec) do
    GenServer.call(__MODULE__, {:start_generation, user_id, spec})
  end

  @doc """
  Gets the progress of a generation job.

  ## Returns

    * `{:ok, generation}` - Generation status and progress
    * `{:error, :not_found}` - Generation doesn't exist
  """
  @spec get_progress(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_progress(generation_id) do
    GenServer.call(__MODULE__, {:get_progress, generation_id})
  end

  @doc """
  Cancels a running generation job.

  ## Returns

    * `:ok` - Generation cancelled
    * `{:error, :not_found}` - Generation doesn't exist
  """
  @spec cancel_generation(String.t()) :: :ok | {:error, :not_found}
  def cancel_generation(generation_id) do
    GenServer.call(__MODULE__, {:cancel_generation, generation_id})
  end

  # Server Callbacks

  @impl true
  def init(_opts) do
    # Start our own Task.Supervisor
    {:ok, _pid} = Task.Supervisor.start_link(name: @task_supervisor)

    schedule_cleanup()
    {:ok, %{generations: %{}}}
  end

  @impl true
  def handle_call({:start_generation, user_id, spec}, _from, state) do
    generation_id = generate_id()

    generation = %{
      id: generation_id,
      user_id: user_id,
      spec: spec,
      status: :running,
      progress: 0,
      total: spec.count,
      created_items: [],
      errors: [],
      started_at: DateTime.utc_now(),
      task_ref: nil,
      task_pid: nil
    }

    # Start supervised async task
    task =
      Task.Supervisor.async_nolink(@task_supervisor, fn ->
        run_generation(generation_id, user_id, spec)
      end)

    # Store both ref (for matching DOWN messages) and pid (for termination)
    generation_with_task = %{generation | task_ref: task.ref, task_pid: task.pid}
    new_generations = Map.put(state.generations, generation_id, generation_with_task)

    {:reply, {:ok, generation_id}, %{state | generations: new_generations}}
  end

  @impl true
  def handle_call({:get_progress, generation_id}, _from, state) do
    case Map.get(state.generations, generation_id) do
      nil -> {:reply, {:error, :not_found}, state}
      gen -> {:reply, {:ok, sanitize_generation(gen)}, state}
    end
  end

  @impl true
  def handle_call({:cancel_generation, generation_id}, _from, state) do
    case Map.get(state.generations, generation_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      gen ->
        # Shutdown the task if running
        if gen.task_pid do
          Task.Supervisor.terminate_child(@task_supervisor, gen.task_pid)
        end

        updated_gen = %{gen | status: :cancelled, task_ref: nil, task_pid: nil}
        new_generations = Map.put(state.generations, generation_id, updated_gen)
        {:reply, :ok, %{state | generations: new_generations}}
    end
  end

  @impl true
  def handle_cast({:update_progress, generation_id, progress, item}, state) do
    case Map.get(state.generations, generation_id) do
      nil ->
        {:noreply, state}

      gen ->
        updated_gen = %{
          gen
          | progress: progress,
            created_items: [item | gen.created_items]
        }

        new_generations = Map.put(state.generations, generation_id, updated_gen)
        {:noreply, %{state | generations: new_generations}}
    end
  end

  @impl true
  def handle_cast({:add_error, generation_id, error}, state) do
    case Map.get(state.generations, generation_id) do
      nil ->
        {:noreply, state}

      gen ->
        updated_gen = %{gen | errors: [error | gen.errors]}
        new_generations = Map.put(state.generations, generation_id, updated_gen)
        {:noreply, %{state | generations: new_generations}}
    end
  end

  @impl true
  def handle_cast({:complete_generation, generation_id, status}, state) do
    case Map.get(state.generations, generation_id) do
      nil ->
        {:noreply, state}

      gen ->
        updated_gen = %{gen | status: status, progress: gen.total, task_ref: nil, task_pid: nil}
        new_generations = Map.put(state.generations, generation_id, updated_gen)
        {:noreply, %{state | generations: new_generations}}
    end
  end

  # Handle task completion/failure
  @impl true
  def handle_info({ref, _result}, state) do
    # Task completed successfully - clean up the monitor
    Process.demonitor(ref, [:flush])
    {:noreply, state}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, state) do
    # Find the generation with this task ref
    case find_generation_by_ref(state.generations, ref) do
      nil ->
        {:noreply, state}

      {generation_id, gen} ->
        Logger.error("[BulkGenerator] Task crashed for #{generation_id}: #{inspect(reason)}")

        updated_gen = %{gen | status: :failed, task_ref: nil, task_pid: nil}
        new_generations = Map.put(state.generations, generation_id, updated_gen)
        {:noreply, %{state | generations: new_generations}}
    end
  end

  @impl true
  def handle_info(:cleanup_old_generations, state) do
    cutoff = DateTime.add(DateTime.utc_now(), -@generation_ttl_minutes, :minute)

    new_generations =
      state.generations
      |> Enum.reject(fn {_id, generation} ->
        # Only cleanup completed, cancelled, or failed generations older than TTL
        # Keep running generations (active work)
        generation.status in [:completed, :cancelled, :failed] &&
          DateTime.compare(generation.started_at, cutoff) == :lt
      end)
      |> Map.new()

    removed_count = map_size(state.generations) - map_size(new_generations)

    if removed_count > 0 do
      Logger.info(
        "[BulkGenerator] Cleaned up #{removed_count} old generations (#{map_size(new_generations)} remaining)"
      )
    end

    schedule_cleanup()
    {:noreply, %{state | generations: new_generations}}
  end

  # Private Helpers

  defp run_generation(generation_id, user_id, spec) do
    Logger.info("[BulkGenerator] Starting generation #{generation_id}, count: #{spec.count}")

    system_prompt = build_bulk_prompt(spec)

    # Use reduce_while to properly handle cancellation
    result =
      Enum.reduce_while(1..spec.count, :ok, fn i, _acc ->
        # Check if cancelled before each iteration
        case get_progress(generation_id) do
          {:ok, %{status: :cancelled}} ->
            Logger.info("[BulkGenerator] Generation cancelled: #{generation_id}")
            {:halt, :cancelled}

          {:ok, %{status: :running}} ->
            # Generate single item
            case generate_single_item(spec.type, spec.template, system_prompt, i) do
              {:ok, item_data} ->
                case PreviewManager.add_preview(user_id, spec.type, item_data) do
                  {:ok, preview_id} ->
                    GenServer.cast(__MODULE__, {:update_progress, generation_id, i, preview_id})

                  {:error, reason} ->
                    GenServer.cast(
                      __MODULE__,
                      {:add_error, generation_id, {:preview_failed, i, reason}}
                    )
                end

              {:error, reason} ->
                Logger.error(
                  "[BulkGenerator] Generation failed for item #{i}: #{inspect(reason)}"
                )

                GenServer.cast(
                  __MODULE__,
                  {:add_error, generation_id, {:generation_failed, i, reason}}
                )
            end

            # Small delay to avoid rate limits
            Process.sleep(@generation_delay_ms)
            {:cont, :ok}

          _ ->
            # Generation not found or in unexpected state
            {:halt, :error}
        end
      end)

    # Mark as completed or cancelled
    final_status = if result == :cancelled, do: :cancelled, else: :completed
    GenServer.cast(__MODULE__, {:complete_generation, generation_id, final_status})
  end

  defp build_bulk_prompt(spec) do
    """
    Generate a #{spec.type} based on this template:

    #{inspect(spec.template, pretty: true)}

    Requirements:
    - Create a unique #{spec.type} matching the template style
    - Follow naming pattern: #{Map.get(spec, :name_pattern, "sequential")}
    - Maintain consistent style and tone
    - Ensure logical connections if creating connected spaces
    - Use the appropriate tool to create the content
    """
  end

  defp generate_single_item(type, template, _system_prompt, index) do
    Logger.info("[BulkGenerator] Generating #{type} ##{index}")

    # For now, use template-based generation
    # TODO: When ClaudeClient is fully integrated, use LLM generation
    case type do
      :room ->
        {:ok,
         %{
           key: "#{template[:base_key] || "room"}_#{index}",
           name: "Generated Room #{index}",
           description: build_room_description(template, index),
           x: (template[:start_x] || 0) + index * (template[:spacing_x] || 100),
           y: template[:start_y] || 0
         }}

      :npc ->
        {:ok,
         %{
           key: "#{template[:base_key] || "npc"}_#{index}",
           name: "Generated NPC #{index}",
           description: build_npc_description(template, index)
         }}

      :item ->
        {:ok,
         %{
           key: "#{template[:base_key] || "item"}_#{index}",
           name: "Generated Item #{index}",
           description: template[:description] || "A generated item."
         }}

      _ ->
        {:error, :unsupported_type}
    end
  end

  # Generate more varied descriptions based on template
  defp build_room_description(template, index) do
    base = template[:description_base] || "A room"
    style = template[:style] || "neutral"

    case style do
      "dark" ->
        "#{base} shrouded in shadow. The air is thick with an unsettling stillness. [Room #{index}]"

      "light" ->
        "#{base} bathed in warm light. A pleasant atmosphere pervades the space. [Room #{index}]"

      "medieval" ->
        "#{base} with stone walls and flickering torchlight. Ancient tapestries line the walls. [Room #{index}]"

      _ ->
        "#{base}. This is location #{index} in the sequence."
    end
  end

  defp build_npc_description(template, index) do
    base = template[:description_base] || "A figure"
    "#{base} stands here, watching the surroundings carefully. [NPC #{index}]"
  end

  defp find_generation_by_ref(generations, ref) do
    Enum.find(generations, fn {_id, gen} -> gen.task_ref == ref end)
  end

  defp sanitize_generation(gen) do
    # Remove internal fields before returning to caller
    Map.drop(gen, [:task_ref])
  end

  defp schedule_cleanup do
    Process.send_after(
      self(),
      :cleanup_old_generations,
      :timer.minutes(@cleanup_interval_minutes)
    )
  end

  defp generate_id do
    "bulk_#{:erlang.unique_integer([:positive, :monotonic])}"
  end
end
