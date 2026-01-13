defmodule Loka.Testing.Content.CutsceneValidator do
  @moduledoc """
  Validates cutscene definitions for integrity.

  Ensures cutscenes are properly structured and reference valid content:
  - Speaker NPCs exist (for dialogue sequences)
  - Trigger locations exist (rooms)
  - Effect types are valid
  - Sequence types are valid

  ## Usage

      {:ok, results} = CutsceneValidator.validate()

  ## Result Structure

      %{
        cutscenes_checked: 6,
        errors: [
          {:missing_speaker, "first_vision", "unknown_npc"},
          {:missing_location, "meditation_scene", "invalid_room"}
        ],
        warnings: [
          {:no_effects, "simple_cutscene"}
        ]
      }
  """

  require Logger

  alias Loka.Engine.PrototypeLoader

  @type validation_result :: %{
          cutscenes_checked: non_neg_integer(),
          errors: [error()],
          warnings: [warning()]
        }

  @type error ::
          {:missing_speaker, String.t(), String.t()}
          | {:missing_location, String.t(), String.t()}
          | {:invalid_trigger_type, String.t(), String.t()}
          | {:invalid_sequence_type, String.t(), String.t()}
          | {:invalid_effect_type, String.t(), String.t()}

  @type warning ::
          {:no_effects, String.t()}
          | {:no_sequence, String.t()}
          | {:empty_text, String.t(), String.t()}

  # Valid trigger types
  @valid_trigger_types [
    "meditate",
    "enter_room",
    "talk_to",
    "use_item",
    "kill",
    "quest_complete",
    "enemy_defeated"
  ]

  # Valid sequence step types
  @valid_sequence_types [
    "dialogue",
    "narration",
    "fade_out",
    "fade_in",
    "pause",
    "choice",
    "sound",
    "music",
    "image",
    "animation",
    "apply_status",
    "spawn_enemy",
    "trigger_ending"
  ]

  # Valid effect types
  @valid_effect_types [
    "set_flag",
    "clear_flag",
    "add_insight",
    "give_item",
    "take_item",
    "give_xp",
    "teleport",
    "start_quest",
    "complete_quest",
    "heal",
    "damage",
    "add_status",
    "start_combat"
  ]

  # Known "virtual" speakers that don't need to exist as NPCs
  # Includes demon voices, spiritual entities, and the player character
  @virtual_speakers [
    "mysterious_voice",
    "narrator",
    "inner_voice",
    "system",
    "player",
    "raga_voice",
    "dvesha_voice",
    "moha_voice",
    "mara",
    "lama_tenzin"
  ]

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Validates all cutscene definitions.

  Returns `{:ok, results}` with validation results.
  """
  @spec validate() :: {:ok, validation_result()}
  def validate do
    cutscenes = load_cutscenes()

    {errors, warnings} =
      Enum.reduce(cutscenes, {[], []}, fn cutscene, {errs, warns} ->
        {cutscene_errors, cutscene_warnings} = validate_cutscene(cutscene)
        {errs ++ cutscene_errors, warns ++ cutscene_warnings}
      end)

    results = %{
      cutscenes_checked: length(cutscenes),
      errors: errors,
      warnings: warnings
    }

    Logger.info(
      "CutsceneValidator: Checked #{results.cutscenes_checked} cutscenes, " <>
        "#{length(results.errors)} errors, " <>
        "#{length(results.warnings)} warnings"
    )

    {:ok, results}
  end

  @doc """
  Returns true if validation passes (no errors).
  """
  @spec valid?() :: boolean()
  def valid? do
    {:ok, results} = validate()
    Enum.empty?(results.errors)
  end

  @doc """
  Formats validation results as a human-readable report.
  """
  @spec format_report(validation_result()) :: String.t()
  def format_report(results) do
    lines = [
      "=== Cutscene Validation Report ===",
      "",
      "Cutscenes checked: #{results.cutscenes_checked}",
      "Errors: #{length(results.errors)}",
      "Warnings: #{length(results.warnings)}",
      ""
    ]

    error_lines =
      if Enum.any?(results.errors) do
        ["ERRORS:", ""] ++
          Enum.map(results.errors, &format_error/1) ++
          [""]
      else
        []
      end

    warning_lines =
      if Enum.any?(results.warnings) do
        ["WARNINGS:", ""] ++
          Enum.map(results.warnings, &format_warning/1) ++
          [""]
      else
        []
      end

    status =
      if Enum.empty?(results.errors) do
        ["STATUS: PASSED"]
      else
        ["STATUS: FAILED"]
      end

    Enum.join(lines ++ error_lines ++ warning_lines ++ status, "\n")
  end

  # =============================================================================
  # Private - Loading
  # =============================================================================

  defp load_cutscenes do
    path = Path.join(:code.priv_dir(:loka), "world/cutscenes")

    if File.dir?(path) do
      path
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".yml"))
      |> Enum.map(fn file ->
        file_path = Path.join(path, file)
        content = YamlElixir.read_from_file!(file_path)
        Map.put(content, "file", file)
      end)
    else
      []
    end
  rescue
    _ -> []
  end

  # =============================================================================
  # Private - Validation
  # =============================================================================

  defp validate_cutscene(cutscene) do
    cutscene_id = cutscene["id"] || cutscene["file"] || "unknown"
    errors = []
    warnings = []

    # Validate trigger
    {trigger_errors, _} = validate_trigger(cutscene_id, cutscene["trigger"])
    errors = errors ++ trigger_errors

    # Validate sequence
    sequence = cutscene["sequence"] || []

    warnings =
      if Enum.empty?(sequence) do
        [{:no_sequence, cutscene_id} | warnings]
      else
        warnings
      end

    {seq_errors, seq_warnings} = validate_sequence(cutscene_id, sequence)
    errors = errors ++ seq_errors
    warnings = warnings ++ seq_warnings

    # Validate effects
    effects = cutscene["effects"] || []

    warnings =
      if Enum.empty?(effects) do
        [{:no_effects, cutscene_id} | warnings]
      else
        warnings
      end

    {effect_errors, _} = validate_effects(cutscene_id, effects)
    errors = errors ++ effect_errors

    {errors, warnings}
  end

  defp validate_trigger(_cutscene_id, nil), do: {[], []}

  defp validate_trigger(cutscene_id, trigger) when is_map(trigger) do
    errors = []

    # Check trigger type
    trigger_type = trigger["type"]

    errors =
      if trigger_type && trigger_type not in @valid_trigger_types do
        [{:invalid_trigger_type, cutscene_id, trigger_type} | errors]
      else
        errors
      end

    # Check location if specified
    location = trigger["location"]

    errors =
      if location do
        case PrototypeLoader.get(location) do
          {:ok, proto} ->
            if proto.type == :room,
              do: errors,
              else: [{:missing_location, cutscene_id, location} | errors]

          {:error, :not_found} ->
            [{:missing_location, cutscene_id, location} | errors]
        end
      else
        errors
      end

    {errors, []}
  end

  defp validate_trigger(_, _), do: {[], []}

  defp validate_sequence(cutscene_id, sequence) when is_list(sequence) do
    Enum.reduce(sequence, {[], []}, fn step, {errs, warns} ->
      {step_errors, step_warnings} = validate_sequence_step(cutscene_id, step)
      {errs ++ step_errors, warns ++ step_warnings}
    end)
  end

  defp validate_sequence(_, _), do: {[], []}

  defp validate_sequence_step(cutscene_id, step) when is_map(step) do
    errors = []
    warnings = []

    step_type = step["type"]

    # Check step type is valid
    errors =
      if step_type && step_type not in @valid_sequence_types do
        [{:invalid_sequence_type, cutscene_id, step_type} | errors]
      else
        errors
      end

    # For dialogue steps, check speaker
    {speaker_errors, _} =
      if step_type == "dialogue" do
        validate_speaker(cutscene_id, step["speaker"])
      else
        {[], []}
      end

    errors = errors ++ speaker_errors

    # Check for empty text in dialogue/narration
    warnings =
      if step_type in ["dialogue", "narration"] do
        text = step["text"]

        if is_nil(text) or text == "" do
          [{:empty_text, cutscene_id, step_type} | warnings]
        else
          warnings
        end
      else
        warnings
      end

    {errors, warnings}
  end

  defp validate_sequence_step(_, _), do: {[], []}

  defp validate_speaker(_cutscene_id, nil), do: {[], []}

  defp validate_speaker(cutscene_id, speaker) do
    # Virtual speakers are allowed
    if speaker in @virtual_speakers do
      {[], []}
    else
      # Check if NPC exists
      case PrototypeLoader.get(speaker) do
        {:ok, proto} ->
          if proto.type == :npc,
            do: {[], []},
            else: {[{:missing_speaker, cutscene_id, speaker}], []}

        {:error, :not_found} ->
          {[{:missing_speaker, cutscene_id, speaker}], []}
      end
    end
  end

  defp validate_effects(cutscene_id, effects) when is_list(effects) do
    Enum.reduce(effects, {[], []}, fn effect, {errs, warns} ->
      {effect_errors, effect_warnings} = validate_effect(cutscene_id, effect)
      {errs ++ effect_errors, warns ++ effect_warnings}
    end)
  end

  defp validate_effects(_, _), do: {[], []}

  defp validate_effect(cutscene_id, effect) when is_map(effect) do
    errors = []

    effect_type = effect["type"]

    errors =
      if effect_type && effect_type not in @valid_effect_types do
        [{:invalid_effect_type, cutscene_id, effect_type} | errors]
      else
        errors
      end

    {errors, []}
  end

  defp validate_effect(_, _), do: {[], []}

  # =============================================================================
  # Private - Formatting
  # =============================================================================

  defp format_error({:missing_speaker, cutscene, speaker}) do
    "  - Cutscene '#{cutscene}': Speaker NPC '#{speaker}' not found"
  end

  defp format_error({:missing_location, cutscene, location}) do
    "  - Cutscene '#{cutscene}': Trigger location '#{location}' not found"
  end

  defp format_error({:invalid_trigger_type, cutscene, type}) do
    "  - Cutscene '#{cutscene}': Invalid trigger type '#{type}'"
  end

  defp format_error({:invalid_sequence_type, cutscene, type}) do
    "  - Cutscene '#{cutscene}': Invalid sequence step type '#{type}'"
  end

  defp format_error({:invalid_effect_type, cutscene, type}) do
    "  - Cutscene '#{cutscene}': Invalid effect type '#{type}'"
  end

  defp format_warning({:no_effects, cutscene}) do
    "  - Cutscene '#{cutscene}': Has no effects defined"
  end

  defp format_warning({:no_sequence, cutscene}) do
    "  - Cutscene '#{cutscene}': Has no sequence defined"
  end

  defp format_warning({:empty_text, cutscene, step_type}) do
    "  - Cutscene '#{cutscene}': #{step_type} step has empty text"
  end
end
