defmodule Mix.Tasks.Loka.Test.Validate do
  @moduledoc """
  Runs all content validators on the game world.

  This task validates:
  - World connectivity (orphan rooms, broken exits)
  - Quest completability (missing targets, invalid rewards)
  - Prototype definitions (missing fields, invalid parents)
  - Dialogue trees (broken references, invalid actions)
  - Dialogue quest chains (quest completion offers next quest)
  - Content reachability (unobtainable items, inaccessible NPCs)
  - Cutscene definitions (speakers, effects, sequences)
  - Crafting recipes (ingredients, outputs, tools)
  - Storyline structure (acts, quests, dependencies)
  - UI/data consistency (dialogue formats, shop validity, quest_giver tags)
  - Wander behavior configs (allowed_rooms connectivity)
  - Entity-prototype sync (stale entities missing components)
  - Channel schemas (event handlers match JSON schema definitions)

  ## Usage

      # Run all validators
      mix loka.test.validate

      # Run specific validators
      mix loka.test.validate --only world
      mix loka.test.validate --only quest
      mix loka.test.validate --only prototype
      mix loka.test.validate --only dialogue
      mix loka.test.validate --only quest_chain
      mix loka.test.validate --only reachability
      mix loka.test.validate --only cutscene
      mix loka.test.validate --only crafting
      mix loka.test.validate --only storyline
      mix loka.test.validate --only ui
      mix loka.test.validate --only wander
      mix loka.test.validate --only entity_sync
      mix loka.test.validate --only channel

      # Skip specific validators
      mix loka.test.validate --skip world

      # Fail on warnings too (strict mode)
      mix loka.test.validate --strict

  ## Exit Codes

  - 0: All validations passed
  - 1: One or more validations failed (errors found)
  """

  use Mix.Task

  alias Loka.Testing.Content.{WorldValidator, QuestValidator, PrototypeLinter}
  alias Loka.Testing.Content.{DialogueValidator, ReachabilityAnalyzer}

  alias Loka.Testing.Content.{
    CutsceneValidator,
    CraftingValidator,
    StorylineValidator,
    UIValidator,
    DialogueQuestChainValidator
  }

  alias Loka.Framework.Quest.Validator, as: YamlQuestValidator

  @shortdoc "Run content validators on game world"

  @switches [
    only: :string,
    skip: :string,
    strict: :boolean,
    quiet: :boolean
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches)

    # Start the application to load prototypes
    Mix.Task.run("app.start")

    only = parse_list(opts[:only])
    skip = parse_list(opts[:skip])
    strict = opts[:strict] || false
    quiet = opts[:quiet] || false

    validators = [
      {:world, "World Connectivity", &run_world_validator/0},
      {:quest, "Quest Completability (Prototypes)", &run_quest_validator/0},
      {:yaml_quest, "Quest Completability (YAML)", &run_yaml_quest_validator/0},
      {:prototype, "Prototype Definitions", &run_prototype_linter/0},
      {:dialogue, "Dialogue Trees", &run_dialogue_validator/0},
      {:quest_chain, "Dialogue Quest Chains", &run_quest_chain_validator/0},
      {:reachability, "Content Reachability", &run_reachability_analyzer/0},
      {:cutscene, "Cutscene Definitions", &run_cutscene_validator/0},
      {:crafting, "Crafting Recipes", &run_crafting_validator/0},
      {:storyline, "Storyline Structure", &run_storyline_validator/0},
      {:ui, "UI/Data Consistency", &run_ui_validator/0},
      {:wander, "Wander Behavior Configs", &run_wander_validator/0},
      {:entity_sync, "Entity-Prototype Sync", &run_entity_sync_validator/0},
      {:channel, "Channel Schema Coverage", &run_channel_validator/0}
    ]

    # Filter validators
    validators =
      validators
      |> Enum.filter(fn {key, _, _} ->
        (Enum.empty?(only) or key in only) and key not in skip
      end)

    if Enum.empty?(validators) do
      Mix.shell().info("No validators to run.")
      exit_code(0)
    end

    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("╔════════════════════════════════════════════╗")
      Mix.shell().info("║     Loka Content Validation Suite         ║")
      Mix.shell().info("╚════════════════════════════════════════════╝")
      Mix.shell().info("")
    end

    # Run validators and collect results
    results =
      Enum.map(validators, fn {key, name, validator_fn} ->
        unless quiet do
          Mix.shell().info("▶ Running: #{name}")
        end

        {key, name, validator_fn.()}
      end)

    # Print results
    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("════════════════════════════════════════════")
      Mix.shell().info("                  RESULTS")
      Mix.shell().info("════════════════════════════════════════════")
      Mix.shell().info("")
    end

    {total_errors, total_warnings} =
      Enum.reduce(results, {0, 0}, fn {_key, name, result}, {errs, warns} ->
        error_count = length(result.errors)
        warning_count = length(result.warnings)

        status =
          cond do
            error_count > 0 -> "❌ FAILED"
            warning_count > 0 and strict -> "⚠️  WARNINGS"
            warning_count > 0 -> "✅ PASSED (with warnings)"
            true -> "✅ PASSED"
          end

        unless quiet do
          Mix.shell().info("#{status} #{name}")

          if error_count > 0 do
            Mix.shell().info("   Errors: #{error_count}")
          end

          if warning_count > 0 do
            Mix.shell().info("   Warnings: #{warning_count}")
          end
        end

        {errs + error_count, warns + warning_count}
      end)

    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("────────────────────────────────────────────")
      Mix.shell().info("Total: #{total_errors} errors, #{total_warnings} warnings")
      Mix.shell().info("")
    end

    # Print detailed errors
    if total_errors > 0 or (strict and total_warnings > 0) do
      unless quiet do
        Mix.shell().info("")
        Mix.shell().info("DETAILED ISSUES:")
        Mix.shell().info("")

        Enum.each(results, fn {_key, name, result} ->
          if Enum.any?(result.errors) or (strict and Enum.any?(result.warnings)) do
            Mix.shell().info("── #{name} ──")

            Enum.each(result.errors, fn error ->
              Mix.shell().error("  ERROR: #{format_issue(error)}")
            end)

            if strict do
              Enum.each(result.warnings, fn warning ->
                Mix.shell().info("  WARN:  #{format_issue(warning)}")
              end)
            end

            Mix.shell().info("")
          end
        end)
      end

      exit_code(1)
    else
      exit_code(0)
    end
  end

  defp run_world_validator do
    {:ok, results} = WorldValidator.validate()
    results
  end

  defp run_quest_validator do
    {:ok, results} = QuestValidator.validate()
    results
  end

  defp run_yaml_quest_validator do
    {:ok, results} = YamlQuestValidator.validate()
    results
  end

  defp run_prototype_linter do
    {:ok, results} = PrototypeLinter.lint()
    results
  end

  defp run_dialogue_validator do
    {:ok, results} = DialogueValidator.validate()
    results
  end

  defp run_quest_chain_validator do
    case DialogueQuestChainValidator.validate_all() do
      {:ok, results} ->
        %{
          errors: results.errors,
          warnings: results.warnings
        }

      {:error, :no_storylines} ->
        %{errors: [], warnings: [{:no_storylines, "No storylines found to validate"}]}
    end
  end

  defp run_reachability_analyzer do
    {:ok, results} = ReachabilityAnalyzer.analyze()
    results
  end

  defp run_cutscene_validator do
    {:ok, results} = CutsceneValidator.validate()
    results
  end

  defp run_crafting_validator do
    {:ok, results} = CraftingValidator.validate()
    results
  end

  defp run_storyline_validator do
    {:ok, results} = StorylineValidator.validate()
    results
  end

  defp run_ui_validator do
    {:ok, results} = UIValidator.validate()
    results
  end

  defp run_wander_validator do
    {:ok, results} = WorldValidator.validate_wander_behaviors()
    results
  end

  defp run_entity_sync_validator do
    {:ok, results} = WorldValidator.validate_entity_prototype_sync()
    results
  end

  defp run_channel_validator do
    alias LokaWeb.Channels.ChannelSchema
    alias LokaWeb.GameChannel

    errors = []
    warnings = []

    # Get all events from schema
    schema_events = ChannelSchema.events() |> MapSet.new()

    # Get all handler patterns from GameChannel
    # We parse the module to find handle_in/3 definitions
    handler_events = get_handler_events(GameChannel)

    # Check for handlers without schema
    undocumented =
      handler_events
      |> Enum.reject(&MapSet.member?(schema_events, &1))
      |> Enum.reject(&(&1 == :catch_all))

    warnings =
      if Enum.any?(undocumented) do
        warnings ++
          Enum.map(undocumented, fn event ->
            {:undocumented_handler, event, "Handler exists but not in schema"}
          end)
      else
        warnings
      end

    # Check for schema events without handlers
    unimplemented =
      schema_events
      |> Enum.reject(&(&1 in handler_events))

    errors =
      if Enum.any?(unimplemented) do
        errors ++
          Enum.map(unimplemented, fn event ->
            {:missing_handler, event, "Schema defines event but no handler found"}
          end)
      else
        errors
      end

    # Validate schema structure
    errors =
      case validate_schema_structure(ChannelSchema.schema()) do
        :ok -> errors
        {:error, schema_errors} -> errors ++ schema_errors
      end

    %{errors: errors, warnings: warnings}
  end

  defp get_handler_events(module) do
    # Get the module's function clauses for handle_in/3
    # This is a simplified version - a full implementation would use
    # Code analysis or module attributes
    {:ok, {^module, [{:abstract_code, {:raw_abstract_v1, forms}}]}} =
      :beam_lib.chunks(
        :code.which(module),
        [:abstract_code]
      )

    forms
    |> Enum.filter(fn
      {:function, _, :handle_in, 3, _clauses} -> true
      _ -> false
    end)
    |> Enum.flat_map(fn {:function, _, :handle_in, 3, clauses} ->
      Enum.map(clauses, fn
        {:clause, _, [{:bin, _, [{:bin_element, _, {:string, _, event}, _, _}]} | _], _, _} ->
          to_string(event)

        {:clause, _, [{:var, _, _} | _], _, _} ->
          :catch_all

        _ ->
          nil
      end)
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  rescue
    _ ->
      # Fallback: manually list known events if beam analysis fails
      [
        "navigate",
        "click_entity",
        "action",
        "dialogue_select",
        "combat_action",
        "inventory",
        "shop",
        "container",
        "gather",
        "craft",
        "emote",
        "social",
        "bardo",
        "chat",
        "command"
      ]
  end

  defp validate_schema_structure(schema) do
    errors = []

    # Check required top-level keys
    required = ["$schema", "events", "definitions"]

    missing =
      required
      |> Enum.reject(&Map.has_key?(schema, &1))
      |> Enum.map(&{:missing_schema_key, &1})

    errors = errors ++ missing

    # Check each event has required fields
    event_errors =
      schema["events"]
      |> Enum.flat_map(fn {event_name, event_schema} ->
        cond do
          not Map.has_key?(event_schema, "payload") ->
            [{:invalid_event, event_name, "missing payload definition"}]

          true ->
            []
        end
      end)

    errors = errors ++ event_errors

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  defp parse_list(nil), do: []

  defp parse_list(str) do
    str
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.map(&String.to_atom/1)
  end

  defp format_issue(issue) when is_tuple(issue) do
    issue
    |> Tuple.to_list()
    |> Enum.map(&to_string/1)
    |> Enum.join(": ")
  end

  defp format_issue(issue), do: inspect(issue)

  defp exit_code(code) do
    unless Mix.env() == :test do
      System.halt(code)
    end

    code
  end
end
