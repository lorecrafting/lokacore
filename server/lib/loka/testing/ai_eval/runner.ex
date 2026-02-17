defmodule Loka.Testing.AIEval.Runner do
  @moduledoc """
  Runs AI eval scenarios phase by phase.

  Maintains conversation context between phases so the AI remembers
  what it built. Scores each phase and stores results.
  """

  require Logger

  alias Loka.AI.Conversation
  alias Loka.Testing.AIEval.{EvalContext, Scenario, Scenario.Phase}
  alias Loka.Testing.AIEval.Rubrics.{Structural, ContentQuality, Narrative}
  alias Loka.WorldBuilder.ToolExecutor
  alias Loka.WorldBuilder.MCP.Tools

  @type phase_result :: %{
          phase: Scenario.phase_name(),
          structural: Structural.score(),
          content_quality: ContentQuality.score(),
          narrative: Narrative.score() | nil,
          duration_ms: non_neg_integer(),
          conversation_turns: non_neg_integer()
        }

  @type scenario_result :: %{
          scenario: String.t(),
          prompt_version: String.t(),
          timestamp: DateTime.t(),
          phases: [phase_result()],
          total_score: non_neg_integer(),
          max_score: non_neg_integer(),
          total_duration_ms: non_neg_integer()
        }

  @doc """
  Run a single scenario with all its phases.
  """
  @spec run_scenario(Scenario.t(), keyword()) :: scenario_result()
  def run_scenario(%Scenario{} = scenario, opts \\ []) do
    prompt_version = opts[:prompt_version] || "v1"
    include_narrative = opts[:narrative] || false
    start_time = System.monotonic_time(:millisecond)

    Mix.shell().info("  Running scenario: #{scenario.name}")

    # Enter eval context
    EvalContext.enter(:eval)

    try do
      # Initialize conversation
      conversation = init_conversation(prompt_version, opts)

      # Run each phase sequentially, carrying conversation forward
      {phase_results, _final_conversation} =
        Enum.reduce(scenario.phases, {[], conversation}, fn phase, {results, conv} ->
          Mix.shell().info("    Phase: #{phase.name}...")
          {result, updated_conv} = run_phase(phase, conv, include_narrative)
          Mix.shell().info("      Score: #{result.structural.total}/#{result.structural.max}")
          {results ++ [result], updated_conv}
        end)

      total_duration = System.monotonic_time(:millisecond) - start_time

      total_score =
        phase_results
        |> Enum.map(fn r ->
          r.structural.total + r.content_quality.total +
            if r.narrative, do: r.narrative.total, else: 0
        end)
        |> Enum.sum()

      max_score =
        phase_results
        |> Enum.map(fn r ->
          r.structural.max + r.content_quality.max + if r.narrative, do: r.narrative.max, else: 0
        end)
        |> Enum.sum()

      result = %{
        scenario: scenario.name,
        prompt_version: prompt_version,
        timestamp: DateTime.utc_now(),
        phases: phase_results,
        total_score: total_score,
        max_score: max_score,
        total_duration_ms: total_duration
      }

      # Save result to disk
      save_result(result)

      result
    after
      EvalContext.exit()
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp init_conversation(prompt_version, opts) do
    system_prompt_fn = fn _ctx ->
      load_prompt(prompt_version)
    end

    Conversation.new(%{
      tools: Tools.tools(),
      system_prompt_fn: system_prompt_fn,
      tool_executor_fn: &ToolExecutor.execute/3,
      verbosity: :conversational,
      caller_pid: self(),
      model: opts[:model] || "claude-sonnet-4-6",
      max_tokens: opts[:max_tokens] || 4096
    })
  end

  defp run_phase(%Phase{} = phase, conversation, include_narrative) do
    start_time = System.monotonic_time(:millisecond)

    # Send the phase prompt to the AI
    conversation = Conversation.send_message(conversation, phase.prompt, %{})

    # Wait for the AI to finish (with timeout)
    conversation = await_completion(conversation, 120_000)

    duration = System.monotonic_time(:millisecond) - start_time

    # Score the results
    structural = Structural.score(phase.expectations, phase.name)
    content_quality = ContentQuality.score(phase.expectations)

    narrative =
      if include_narrative do
        Narrative.score(phase.expectations)
      else
        nil
      end

    result = %{
      phase: phase.name,
      structural: structural,
      content_quality: content_quality,
      narrative: narrative,
      duration_ms: duration,
      conversation_turns: length(conversation.messages)
    }

    {result, conversation}
  end

  defp await_completion(conversation, timeout) do
    end_time = System.monotonic_time(:millisecond) + timeout

    await_loop(conversation, end_time)
  end

  defp await_loop(conversation, end_time) do
    remaining = end_time - System.monotonic_time(:millisecond)

    if remaining <= 0 do
      Logger.warning("[EvalRunner] Timeout waiting for AI completion")
      conversation
    else
      receive do
        {:ai_text_delta, _text} ->
          await_loop(conversation, end_time)

        {:ai_tool_use_raw, name, id, input} ->
          conversation = Conversation.handle_tool_use(conversation, name, id, input)
          await_loop(conversation, end_time)

        {:ai_done_raw, response} ->
          conversation = Conversation.handle_done(conversation, response)

          if conversation.streaming do
            # Tool use loop continues
            await_loop(conversation, end_time)
          else
            conversation
          end

        {:ai_done} ->
          conversation

        {:ai_error, reason} ->
          Logger.warning("[EvalRunner] AI error: #{inspect(reason)}")

          if rate_limited?(reason) do
            # Brief pause before returning — phase-level retry handles the rest
            Process.sleep(2_000)
          end

          conversation

        {:ai_tool_use, _name, _id, _input, _result} ->
          await_loop(conversation, end_time)
      after
        min(remaining, 5000) ->
          if conversation.streaming do
            await_loop(conversation, end_time)
          else
            conversation
          end
      end
    end
  end

  defp rate_limited?(reason) when is_binary(reason), do: String.contains?(reason, "429")
  defp rate_limited?(_), do: false

  defp load_prompt(version) do
    versioned_path =
      Path.join([:code.priv_dir(:loka), "world_builder", "prompts", "#{version}.md"])

    default_path =
      Path.join([:code.priv_dir(:loka), "world_builder", "system_prompt.md"])

    case File.read(versioned_path) do
      {:ok, content} -> content
      {:error, _} -> File.read!(default_path)
    end
  end

  defp save_result(result) do
    dir = Path.join([:code.priv_dir(:loka), "llm_logs", "eval_results"])
    File.mkdir_p!(dir)

    date = Date.to_iso8601(Date.utc_today())
    filename = "#{date}_#{result.scenario}_#{result.prompt_version}.json"
    path = Path.join(dir, filename)

    json = Jason.encode!(result, pretty: true)
    File.write!(path, json)

    Logger.info("[EvalRunner] Results saved to #{path}")
  end
end
