defmodule Loka.Framework.Spark do
  @moduledoc """
  The Spark Companion System.

  Every player bonds with a Spark - a fragment of the ancient gate network's
  consciousness. The Spark serves as companion, guide, and connection to
  the deeper mysteries of the world.

  ## Features

  - **Returning player updates**: "While you were away" summaries
  - **Companion guide**: Contextual hints and lore delivery
  - **Quick reference**: Answer questions about quests, inventory, etc.
  - **Emotional companion**: Bond grows over time, personality emerges

  ## Usage

      # Create Spark during character creation
      {:ok, spark} = Spark.create_for_player(player_id, ["curious", "warm"])

      # Get player's Spark
      spark = Spark.get(player_id)

      # Add bond points
      {:ok, spark} = Spark.add_bond_points(player_id, 5)

      # Record an event for "while you were away"
      Spark.record_event(player_id, :world_event, "storm_warning", "A storm approaches.")

      # Get pending updates on login
      updates = Spark.get_pending_updates(player_id)
  """

  alias Loka.Repo
  alias Loka.Framework.Spark.{SparkState, SparkEvent}

  # ============================================================================
  # Spark Lifecycle
  # ============================================================================

  @doc """
  Create a new Spark for a player during character creation.

  ## Parameters
    - player_id: The player's UUID
    - traits: List of exactly 2 personality traits

  ## Examples

      iex> Spark.create_for_player(player_id, ["curious", "warm"])
      {:ok, %SparkState{}}

      iex> Spark.create_for_player(player_id, ["invalid"])
      {:error, %Ecto.Changeset{}}
  """
  def create_for_player(player_id, traits) when is_list(traits) do
    %{player_id: player_id, personality_traits: traits}
    |> SparkState.create_changeset()
    |> Repo.insert()
  end

  @doc """
  Get a player's Spark. Returns nil if not found.
  """
  def get(player_id) do
    SparkState.get_by_player(player_id)
  end

  @doc """
  Get a player's Spark. Raises if not found.
  """
  def get!(player_id) do
    SparkState.get_by_player!(player_id)
  end

  @doc """
  Check if a player has a Spark.
  """
  def exists?(player_id) do
    get(player_id) != nil
  end

  # ============================================================================
  # Bond Progression
  # ============================================================================

  @doc """
  Add bond points to a Spark. Automatically updates bond level if threshold reached.

  ## Bond point sources:
    - Daily login: +1
    - Quest completion: +2-5
    - Visiting awakening sites: +3
    - Asking Spark questions: +1
    - Compassionate choices: +2
    - Story milestones: +10
  """
  def add_bond_points(player_id, points) when is_integer(points) and points > 0 do
    case get(player_id) do
      nil ->
        {:error, :spark_not_found}

      spark ->
        new_points = spark.bond_points + points
        new_level = SparkState.bond_level_for_points(new_points)

        attrs = %{bond_points: new_points}

        # Check for level up
        attrs =
          if new_level != spark.bond_level do
            Map.put(attrs, :bond_level, new_level)
          else
            attrs
          end

        spark
        |> SparkState.update_changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Get bond progress as percentage toward next level.
  """
  def bond_progress(player_id) do
    case get(player_id) do
      nil -> 0
      spark -> SparkState.bond_progress(spark)
    end
  end

  # ============================================================================
  # Awakening Progression
  # ============================================================================

  @doc """
  Progress Spark's awakening stage.
  """
  def advance_awakening(player_id) do
    case get(player_id) do
      nil ->
        {:error, :spark_not_found}

      spark ->
        stages = SparkState.awakening_stages()
        current_idx = Enum.find_index(stages, &(&1 == spark.awakening_stage))
        next_stage = Enum.at(stages, current_idx + 1)

        if next_stage do
          spark
          |> SparkState.update_changeset(%{awakening_stage: next_stage})
          |> Repo.update()
        else
          {:ok, spark}
        end
    end
  end

  # ============================================================================
  # Name Revelation
  # ============================================================================

  @doc """
  Reveal the Spark's name (triggered by bond level reaching "friend").

  Spark names are generated based on personality traits and feel ancient/ethereal.
  """
  def reveal_name(player_id) do
    case get(player_id) do
      nil ->
        {:error, :spark_not_found}

      %{revealed_name: name} when not is_nil(name) ->
        {:ok, name}

      spark ->
        name = generate_spark_name(spark.personality_traits)

        case spark
             |> SparkState.update_changeset(%{revealed_name: name})
             |> Repo.update() do
          {:ok, updated} -> {:ok, updated.revealed_name}
          error -> error
        end
    end
  end

  # Generate a name based on traits
  defp generate_spark_name(traits) do
    # Names feel ancient, ethereal, tied to the gate network
    base_names = ~w(Aether Lumen Echo Cipher Veil Drift Glim Shard Trace Wisp)
    suffixes = ~w(iel ara ith eon ax is um)

    # Trait influences
    curious_names = ~w(Quill Seek Wander Query)
    contemplative_names = ~w(Still Depth Calm Muse)
    warm_names = ~w(Ember Glow Kindle Heart)
    earnest_names = ~w(True Clear Pure Bright)
    ancient_names = ~w(Old Sage Elder Time)

    trait_pool =
      Enum.flat_map(traits || [], fn
        "curious" -> curious_names
        "contemplative" -> contemplative_names
        "warm" -> warm_names
        "earnest" -> earnest_names
        "ancient" -> ancient_names
        _ -> []
      end)

    pool = if trait_pool == [], do: base_names, else: trait_pool ++ base_names

    base = Enum.random(pool)
    suffix = Enum.random(suffixes)

    "#{base}#{suffix}"
  end

  # ============================================================================
  # Visual Forms
  # ============================================================================

  @doc """
  Unlock a new visual form for the Spark.
  """
  def unlock_form(player_id, form) when is_binary(form) do
    if form in SparkState.valid_forms() do
      case get(player_id) do
        nil ->
          {:error, :spark_not_found}

        spark ->
          if form in spark.unlocked_forms do
            {:ok, spark}
          else
            spark
            |> SparkState.update_changeset(%{
              unlocked_forms: [form | spark.unlocked_forms]
            })
            |> Repo.update()
          end
      end
    else
      {:error, :invalid_form}
    end
  end

  @doc """
  Change the Spark's visual form (must be unlocked).
  """
  def set_form(player_id, form) when is_binary(form) do
    case get(player_id) do
      nil ->
        {:error, :spark_not_found}

      spark ->
        spark
        |> SparkState.update_changeset(%{visual_form: form})
        |> Repo.update()
    end
  end

  # ============================================================================
  # Preferences
  # ============================================================================

  @doc """
  Set Spark verbosity level.
  """
  def set_verbosity(player_id, level) when level in ~w(quiet normal verbose) do
    case get(player_id) do
      nil -> {:error, :spark_not_found}
      spark -> spark |> SparkState.update_changeset(%{verbosity: level}) |> Repo.update()
    end
  end

  @doc """
  Update last seen timestamp (call on logout or disconnect).
  """
  def mark_last_seen(player_id) do
    case get(player_id) do
      nil ->
        {:error, :spark_not_found}

      spark ->
        spark
        |> SparkState.update_changeset(%{
          last_seen_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Repo.update()
    end
  end

  # ============================================================================
  # Events ("While You Were Away")
  # ============================================================================

  @doc """
  Record an event for a player's Spark to report later.
  """
  def record_event(player_id, event_type, event_key, summary, details \\ %{}) do
    SparkEvent.create_changeset(%{
      player_id: player_id,
      event_type: to_string(event_type),
      event_key: event_key,
      summary: summary,
      details: details
    })
    |> Repo.insert()
  end

  @doc """
  Get pending events for "while you were away" summary.
  """
  def get_pending_updates(player_id, opts \\ []) do
    SparkEvent.get_pending(player_id, opts)
  end

  @doc """
  Count pending updates.
  """
  def count_pending_updates(player_id) do
    SparkEvent.count_pending(player_id)
  end

  @doc """
  Mark all updates as delivered.
  """
  def mark_updates_delivered(player_id) do
    SparkEvent.mark_all_delivered(player_id)
  end

  # ============================================================================
  # Helpers for UI/API
  # ============================================================================

  @doc """
  Get Spark data formatted for the client.
  """
  def to_client_format(player_id) do
    case get(player_id) do
      nil ->
        nil

      spark ->
        %{
          bond_level: spark.bond_level,
          bond_progress: SparkState.bond_progress(spark),
          awakening_stage: spark.awakening_stage,
          personality_traits: spark.personality_traits,
          visual_form: spark.visual_form,
          unlocked_forms: spark.unlocked_forms,
          name: spark.revealed_name,
          verbosity: spark.verbosity,
          pending_updates: count_pending_updates(player_id)
        }
    end
  end

  @doc """
  Get available trait options for character creation.
  """
  def trait_options do
    SparkState.valid_traits()
    |> Enum.map(fn trait ->
      %{
        id: trait,
        name: String.capitalize(trait),
        description: Map.get(SparkState.trait_descriptions(), trait, "")
      }
    end)
  end
end
