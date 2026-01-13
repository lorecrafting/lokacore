defmodule Loka.Framework.Storyline.Storyline do
  @moduledoc """
  Struct representing a storyline (quest chain/narrative arc).

  Storylines are formal structures that link quests together into
  coherent narratives with acts, prerequisites, and side quests.

  ## Structure

      %Storyline{
        key: "monastery_arc",
        name: "The Sleeping Master",
        description: "Rescue Master Tenzin...",
        acts: [
          %Act{id: "act_1", name: "Discovery", quests: ["main_sleeping_master"]},
          %Act{id: "act_2", name: "The Three Trials", quests: [...], requires: ["act_1"]}
        ],
        side_quests: ["side_restless_spirits"],
        starting_room: "monastery_gate",
        tags: ["main", "buddhist"]
      }

  ## YAML Format

      key: monastery_arc
      name: "The Sleeping Master"
      description: |
        Multi-line description...
      starting_room: monastery_gate
      acts:
        - id: act_1
          name: "Discovery"
          quests:
            - main_sleeping_master
        - id: act_2
          name: "The Three Trials"
          quests:
            - main_three_trials
          requires:
            - act_1
      side_quests:
        - side_restless_spirits
      tags:
        - main
  """

  defmodule Act do
    @moduledoc """
    Represents an act (chapter) in a storyline.
    """
    defstruct [
      :id,
      :name,
      :description,
      quests: [],
      requires: []
    ]

    @type t :: %__MODULE__{
            id: String.t(),
            name: String.t(),
            description: String.t() | nil,
            quests: [String.t()],
            requires: [String.t()]
          }

    @doc """
    Creates an Act from a map (YAML data).
    """
    def from_map(data) when is_map(data) do
      %__MODULE__{
        id: data["id"] || data[:id],
        name: data["name"] || data[:name],
        description: data["description"] || data[:description],
        quests: data["quests"] || data[:quests] || [],
        requires: data["requires"] || data[:requires] || []
      }
    end
  end

  defstruct [
    :key,
    :name,
    :description,
    :starting_room,
    acts: [],
    side_quests: [],
    tags: []
  ]

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          description: String.t(),
          starting_room: String.t() | nil,
          acts: [Act.t()],
          side_quests: [String.t()],
          tags: [String.t()]
        }

  @doc """
  Creates a Storyline from a map (YAML data).

  Returns `{:ok, storyline}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    key = data["key"] || data[:key] || data["id"] || data[:id]

    if is_nil(key) do
      {:error, :missing_key}
    else
      acts =
        (data["acts"] || data[:acts] || [])
        |> Enum.map(&Act.from_map/1)

      storyline = %__MODULE__{
        key: key,
        name: data["name"] || data[:name] || key,
        description: data["description"] || data[:description] || "",
        starting_room: data["starting_room"] || data[:starting_room],
        acts: acts,
        side_quests: data["side_quests"] || data[:side_quests] || [],
        tags: data["tags"] || data[:tags] || []
      }

      {:ok, storyline}
    end
  end

  def from_map(_), do: {:error, :invalid_data}

  @doc """
  Gets all quests in this storyline (main + side).
  """
  def all_quests(%__MODULE__{} = storyline) do
    main_quests =
      storyline.acts
      |> Enum.flat_map(& &1.quests)

    main_quests ++ storyline.side_quests
  end

  @doc """
  Gets quests for a specific act.
  """
  def quests_for_act(%__MODULE__{} = storyline, act_id) do
    case Enum.find(storyline.acts, &(&1.id == act_id)) do
      nil -> []
      act -> act.quests
    end
  end

  @doc """
  Checks if an act's prerequisites are met.

  Returns `true` if all required acts are complete.
  """
  def act_available?(%__MODULE__{} = storyline, act_id, completed_quests) do
    case Enum.find(storyline.acts, &(&1.id == act_id)) do
      nil ->
        false

      act ->
        Enum.all?(act.requires, fn required_act_id ->
          # Get quests from the required act
          required_quests = quests_for_act(storyline, required_act_id)
          # All quests in the required act must be complete
          Enum.all?(required_quests, &(&1 in completed_quests))
        end)
    end
  end

  @doc """
  Gets the current act based on quest completion state.

  Returns the first act that has incomplete quests, or nil if all done.
  """
  def current_act(%__MODULE__{} = storyline, completed_quests) do
    Enum.find(storyline.acts, fn act ->
      # This act has at least one incomplete quest
      Enum.any?(act.quests, fn quest_id ->
        quest_id not in completed_quests
      end)
    end)
  end

  @doc """
  Gets the ordered list of quests to complete the storyline.

  Returns quests in order, respecting act dependencies.
  """
  def quest_order(%__MODULE__{} = storyline) do
    storyline.acts
    |> Enum.flat_map(& &1.quests)
  end

  @doc """
  Calculates progress through the storyline.

  Returns `{completed_count, total_count, percentage}`.
  """
  def progress(%__MODULE__{} = storyline, completed_quests) do
    all = quest_order(storyline)
    total = length(all)
    completed = Enum.count(all, &(&1 in completed_quests))
    percentage = if total > 0, do: round(completed / total * 100), else: 0
    {completed, total, percentage}
  end
end
