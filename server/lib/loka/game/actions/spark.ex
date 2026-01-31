defmodule Loka.Game.Actions.Spark do
  @moduledoc """
  Spark companion game actions.

  Handles interactions with the player's Spark companion:
  - Viewing Spark status and bond level
  - Getting "while you were away" updates
  - Asking Spark for help/information

  ## Actions

  - `:spark_status` - View Spark companion status
  - `:spark_updates` - Get pending "while you were away" updates
  - `:spark_dismiss_updates` - Mark updates as delivered
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Spark
  alias Loka.Framework.Spark.SparkState

  @doc """
  Get the Spark's status for display.
  """
  @spec status(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def status(ctx) do
    case Spark.get(ctx.player_id) do
      nil ->
        {:error, "You have not yet bonded with a Spark."}

      spark ->
        # Build status message based on bond level
        status_text = build_status_text(spark)
        pending_count = Spark.count_pending_updates(ctx.player_id)

        events = [{:event, status_text}]

        events =
          if pending_count > 0 do
            events ++
              [{:event, spark_voice(spark, "I have #{pending_count} things to tell you.")}]
          else
            events
          end

        # Also push spark_status event with structured data for UI
        spark_data = Spark.to_client_format(ctx.player_id)
        events = events ++ [{:spark_status, spark_data}]

        result = Result.new(events: events)
        {:ok, result}
    end
  end

  @doc """
  Get pending "while you were away" updates.
  """
  @spec get_updates(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def get_updates(ctx) do
    case Spark.get(ctx.player_id) do
      nil ->
        {:error, "You have not yet bonded with a Spark."}

      spark ->
        updates = Spark.get_pending_updates(ctx.player_id, limit: 10)

        if Enum.empty?(updates) do
          message = spark_voice(spark, "Nothing of note has happened while you were away.")
          result = Result.new(events: [{:event, message}])
          {:ok, result}
        else
          # Build narrative from updates
          intro = spark_voice(spark, "While you were away...")

          update_messages =
            updates
            |> Enum.map(fn update -> "  - #{update.summary}" end)

          events = [{:event, intro}]
          events = events ++ Enum.map(update_messages, fn msg -> {:event, msg} end)

          # Also send structured data for UI
          events =
            events ++
              [
                {:spark_updates,
                 %{
                   updates: Enum.map(updates, &serialize_update/1),
                   count: length(updates)
                 }}
              ]

          result = Result.new(events: events)
          {:ok, result}
        end
    end
  end

  @doc """
  Mark pending updates as delivered.
  """
  @spec dismiss_updates(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def dismiss_updates(ctx) do
    case Spark.get(ctx.player_id) do
      nil ->
        {:error, "You have not yet bonded with a Spark."}

      _spark ->
        count = Spark.mark_updates_delivered(ctx.player_id)

        result =
          if count > 0 do
            Result.new(events: [{:event, "Your Spark settles, its news delivered."}])
          else
            Result.new(events: [])
          end

        {:ok, result}
    end
  end

  @doc """
  Ask Spark a question or for help.

  This is a placeholder for future AI-enhanced responses.
  Currently provides basic help information.
  """
  @spec ask(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def ask(ctx, question) do
    case Spark.get(ctx.player_id) do
      nil ->
        {:error, "You have not yet bonded with a Spark."}

      spark ->
        response = generate_response(spark, question, ctx)
        message = spark_voice(spark, response)

        # Add bond points for interacting
        Spark.add_bond_points(ctx.player_id, 1)

        result = Result.new(events: [{:event, message}])
        {:ok, result}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp build_status_text(spark) do
    name = spark.revealed_name || "Your Spark"
    bond_desc = bond_description(spark.bond_level)
    progress = SparkState.bond_progress(spark)

    traits_text =
      spark.personality_traits
      |> Enum.map(&String.capitalize/1)
      |> Enum.join(" and ")

    form_text = spark.visual_form |> String.capitalize()

    """
    #{name} hovers nearby, a #{form_text} of soft light.
    Bond: #{bond_desc} (#{progress}% to next)
    Personality: #{traits_text}
    Awakening: #{spark.awakening_stage |> String.capitalize()}
    """
    |> String.trim()
  end

  defp bond_description("stranger"), do: "Stranger"
  defp bond_description("acquaintance"), do: "Acquaintance"
  defp bond_description("companion"), do: "Companion"
  defp bond_description("friend"), do: "Friend"
  defp bond_description("bonded"), do: "Bonded"
  defp bond_description(_), do: "Unknown"

  # Generate voice text based on Spark's personality
  defp spark_voice(spark, text) do
    name = spark.revealed_name || "Spark"
    traits = spark.personality_traits || []

    prefix =
      cond do
        "curious" in traits ->
          Enum.random([
            "*pulses inquisitively*",
            "*glows with interest*",
            "*flickers thoughtfully*"
          ])

        "warm" in traits ->
          Enum.random(["*glows warmly*", "*hums softly*", "*radiates gently*"])

        "contemplative" in traits ->
          Enum.random(["*dims momentarily in thought*", "*pulses slowly*", "*hovers steadily*"])

        "earnest" in traits ->
          Enum.random(["*brightens eagerly*", "*shimmers with sincerity*", "*glows earnestly*"])

        "ancient" in traits ->
          Enum.random([
            "*flickers with old light*",
            "*resonates deeply*",
            "*pulses with ancient rhythm*"
          ])

        true ->
          "*glows softly*"
      end

    "#{name} #{prefix} \"#{text}\""
  end

  # Generate a response to a question (basic for now, AI-enhanced later)
  defp generate_response(spark, question, ctx) do
    question_lower = String.downcase(question)
    traits = spark.personality_traits || []

    cond do
      String.contains?(question_lower, ["quest", "task", "objective"]) ->
        quest_response(ctx, traits)

      String.contains?(question_lower, ["where", "location", "room"]) ->
        location_response(ctx, traits)

      String.contains?(question_lower, ["help", "what can"]) ->
        help_response(traits)

      String.contains?(question_lower, ["who are you", "your name", "about you"]) ->
        identity_response(spark, traits)

      true ->
        generic_response(traits)
    end
  end

  defp quest_response(_ctx, traits) do
    base = "I sense you have paths to walk and tasks to complete."

    if "curious" in traits do
      base <> " What calls to you most strongly?"
    else
      base
    end
  end

  defp location_response(ctx, traits) do
    room = ctx.room

    base =
      if room do
        "You stand in #{room.title || "this place"}."
      else
        "I sense we are... somewhere."
      end

    if "ancient" in traits do
      base <> " The echoes of many footsteps linger here."
    else
      base
    end
  end

  defp help_response(traits) do
    base =
      "I can tell you about what happened while you were away, help you track your quests, and offer guidance on your journey."

    if "warm" in traits do
      base <> " I am here for you."
    else
      base
    end
  end

  defp identity_response(spark, traits) do
    awakening = spark.awakening_stage

    base =
      case awakening do
        "dormant" ->
          "I am... still learning what I am. A fragment, perhaps, of something greater."

        "stirring" ->
          "I begin to remember. I was once part of a vast network, a web of light and thought."

        "aware" ->
          "I am a Spark - a shard of the ancient gate consciousness. We are bound now, you and I."

        "awakened" ->
          "I am #{spark.revealed_name || "your companion"}, awakened and aware. Together we walk paths both old and new."

        _ ->
          "I am your companion, bound to your journey."
      end

    if "contemplative" in traits do
      base <> " But what is identity, truly, but the sum of our choices?"
    else
      base
    end
  end

  defp generic_response(traits) do
    responses =
      cond do
        "curious" in traits ->
          [
            "An interesting question. Let me ponder it.",
            "I wonder about that too.",
            "That's something worth exploring."
          ]

        "warm" in traits ->
          [
            "I may not have the answer, but I'm here with you.",
            "Let us discover the answer together.",
            "Your curiosity warms me."
          ]

        "ancient" in traits ->
          [
            "Some questions echo through ages without answer.",
            "In time, understanding comes to those who seek.",
            "The old ones pondered the same."
          ]

        true ->
          [
            "I cannot say for certain.",
            "Perhaps we will learn in time.",
            "The path will reveal its answers."
          ]
      end

    Enum.random(responses)
  end

  defp serialize_update(update) do
    %{
      id: update.id,
      type: update.event_type,
      summary: update.summary,
      occurred_at: update.occurred_at,
      details: update.details || %{}
    }
  end
end
