defmodule Loka.Framework.Quest.Chain do
  @moduledoc """
  Quest chaining API for creating and managing sequential quest flows.

  Provides a programmatic interface for linking quests together with automatic
  progression, conditional branching, and progress tracking.

  ## Features

  - Define quest chains programmatically or via YAML
  - Automatic next-quest triggering on completion
  - Conditional branching based on player state/choices
  - Chain progress tracking and statistics
  - Support for optional/skippable quests

  ## Usage

  ### Defining Chains in YAML

      # priv/world/quests/_chains/main_story.yml
      id: main_story_chain
      name: "The Main Story"
      quests:
        - quest_id: intro_quest
          next:
            - quest_id: choice_quest
        - quest_id: choice_quest
          branches:
            - condition: {flag: chose_good}
              next: good_path_quest
            - condition: {flag: chose_evil}
              next: evil_path_quest
            - default: neutral_path_quest

  ### Programmatic Usage

      # Get chain for a quest
      {:ok, chain} = Chain.get_chain_for_quest("intro_quest")

      # Get next quest(s) in chain
      {:ok, next_quests} = Chain.get_next_quests(player_state, "intro_quest")

      # Check chain progress
      {:ok, progress} = Chain.get_chain_progress(player_state, "main_story_chain")

      # Manually trigger next quest
      {:ok, state} = Chain.trigger_next(player_state, "intro_quest")

  ## Chain Definition Structure

      %Chain{
        id: "main_story_chain",
        name: "The Main Story",
        description: "...",
        nodes: [
          %ChainNode{
            quest_id: "intro_quest",
            next: ["choice_quest"],
            branches: [],
            optional: false
          },
          %ChainNode{
            quest_id: "choice_quest",
            next: [],
            branches: [
              %Branch{condition: {:flag, "chose_good"}, next: "good_path"},
              %Branch{condition: {:flag, "chose_evil"}, next: "evil_path"},
              %Branch{condition: :default, next: "neutral_path"}
            ],
            optional: false
          }
        ],
        start_quest: "intro_quest"
      }
  """

  alias Loka.Framework.Conditions.Evaluator
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Quest.{ChainRegistry, Progress, Definitions}

  defmodule Chain do
    @moduledoc """
    Struct representing a quest chain definition.
    """
    defstruct [
      :id,
      :name,
      :description,
      nodes: [],
      start_quest: nil,
      tags: []
    ]

    @type t :: %__MODULE__{
            id: String.t(),
            name: String.t(),
            description: String.t() | nil,
            nodes: [ChainNode.t()],
            start_quest: String.t() | nil,
            tags: [String.t()]
          }
  end

  defmodule ChainNode do
    @moduledoc """
    Struct representing a node in a quest chain.
    """
    defstruct [
      :quest_id,
      next: [],
      branches: [],
      optional: false,
      auto_start: true
    ]

    @type t :: %__MODULE__{
            quest_id: String.t(),
            next: [String.t()],
            branches: [Branch.t()],
            optional: boolean(),
            auto_start: boolean()
          }
  end

  defmodule Branch do
    @moduledoc """
    Struct representing a conditional branch in a quest chain.
    """
    defstruct [
      :condition,
      :next
    ]

    @type condition ::
            {:flag, String.t()}
            | {:quest_completed, String.t()}
            | {:level_gte, non_neg_integer()}
            | {:item_has, String.t()}
            | :default

    @type t :: %__MODULE__{
            condition: condition(),
            next: String.t()
          }
  end

  # =============================================================================
  # Chain Queries
  # =============================================================================

  @doc """
  Gets the chain that contains a specific quest.

  Returns `{:ok, chain}` or `{:error, :not_found}`.
  """
  def get_chain_for_quest(quest_id) do
    ChainRegistry.get_chain_for_quest(quest_id)
  end

  @doc """
  Gets a chain by its ID.

  Returns `{:ok, chain}` or `{:error, :not_found}`.
  """
  def get_chain(chain_id) do
    ChainRegistry.get(chain_id)
  end

  @doc """
  Lists all defined quest chains.
  """
  def list_chains do
    ChainRegistry.all()
  end

  # =============================================================================
  # Chain Progression
  # =============================================================================

  @doc """
  Gets the next quest(s) that should be started after completing a quest.

  Evaluates any conditional branches based on player state.

  Returns `{:ok, [quest_ids]}` or `{:error, reason}`.
  """
  def get_next_quests(%GameState{} = state, completed_quest_id) do
    case get_chain_for_quest(completed_quest_id) do
      {:ok, chain} ->
        node = find_node(chain, completed_quest_id)

        if node do
          next_quests = resolve_next_quests(state, node)
          {:ok, next_quests}
        else
          {:ok, []}
        end

      {:error, :not_found} ->
        # Quest not in any chain, check for direct next_quest in quest definition
        case Definitions.get_quest_definition(completed_quest_id) do
          nil ->
            {:ok, []}

          quest_def ->
            next = Map.get(quest_def, :next_quest) || Map.get(quest_def, "next_quest")

            if next do
              {:ok, List.wrap(next)}
            else
              {:ok, []}
            end
        end

      error ->
        error
    end
  end

  @doc """
  Triggers the next quest(s) in the chain for a player.

  Automatically accepts the next quest(s) based on chain progression.

  Returns `{:ok, updated_state, [started_quest_ids]}` or `{:error, reason}`.
  """
  def trigger_next(%GameState{} = state, completed_quest_id, opts \\ []) do
    force = Keyword.get(opts, :force, false)

    case get_next_quests(state, completed_quest_id) do
      {:ok, []} ->
        {:ok, state, []}

      {:ok, next_quests} ->
        # Start each next quest
        {final_state, started} =
          Enum.reduce(next_quests, {state, []}, fn quest_id, {acc_state, acc_started} ->
            # Check if quest can be started (unless forcing)
            can_start = force || can_start_quest?(acc_state, quest_id)

            if can_start do
              case Progress.accept_quest(acc_state, quest_id) do
                {:ok, new_state} ->
                  {new_state, [quest_id | acc_started]}

                {:error, :already_active} ->
                  # Quest already active, skip
                  {acc_state, acc_started}

                {:error, :already_completed} ->
                  # Quest already done, skip
                  {acc_state, acc_started}

                {:error, _reason} ->
                  {acc_state, acc_started}
              end
            else
              {acc_state, acc_started}
            end
          end)

        {:ok, final_state, Enum.reverse(started)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Called when a quest is completed to handle chain progression.

  This is typically called from a hook after quest turn-in.

  Returns `{:ok, updated_state, [auto_started_quests]}` or `{:error, reason}`.
  """
  def on_quest_completed(%GameState{} = state, completed_quest_id) do
    case get_chain_for_quest(completed_quest_id) do
      {:ok, chain} ->
        node = find_node(chain, completed_quest_id)

        if node && node.auto_start do
          trigger_next(state, completed_quest_id)
        else
          {:ok, state, []}
        end

      {:error, :not_found} ->
        # Not in a chain, check for direct next_quest
        trigger_next(state, completed_quest_id)

      error ->
        error
    end
  end

  # =============================================================================
  # Chain Progress
  # =============================================================================

  @doc """
  Gets progress through a specific chain.

  Returns a map with:
  - `:chain_id` - The chain ID
  - `:total_quests` - Total quests in chain
  - `:completed_quests` - Number completed
  - `:active_quests` - Currently active quest IDs
  - `:next_quests` - Next available quest IDs
  - `:percent_complete` - Completion percentage
  """
  def get_chain_progress(%GameState{} = state, chain_id) do
    case get_chain(chain_id) do
      {:ok, chain} ->
        completed = Progress.get_completed_quests(state)
        active = Progress.get_active_quests(state) |> Enum.map(& &1.id)

        chain_quest_ids = Enum.map(chain.nodes, & &1.quest_id)
        completed_in_chain = Enum.filter(chain_quest_ids, &(&1 in completed))
        active_in_chain = Enum.filter(chain_quest_ids, &(&1 in active))

        # Find next available quests
        next_available =
          chain.nodes
          |> Enum.filter(fn node ->
            node.quest_id not in completed &&
              node.quest_id not in active &&
              can_start_quest?(state, node.quest_id)
          end)
          |> Enum.map(& &1.quest_id)

        total = length(chain_quest_ids)
        completed_count = length(completed_in_chain)

        progress = %{
          chain_id: chain_id,
          chain_name: chain.name,
          total_quests: total,
          completed_quests: completed_count,
          completed_quest_ids: completed_in_chain,
          active_quests: active_in_chain,
          next_quests: next_available,
          percent_complete: if(total > 0, do: completed_count / total * 100, else: 0.0)
        }

        {:ok, progress}

      error ->
        error
    end
  end

  @doc """
  Gets progress for all chains the player has interacted with.
  """
  def get_all_chain_progress(%GameState{} = state) do
    chains = list_chains()

    chains
    |> Enum.map(fn chain ->
      {:ok, progress} = get_chain_progress(state, chain.id)
      progress
    end)
    |> Enum.filter(fn progress ->
      # Only include chains player has started
      progress.completed_quests > 0 || progress.active_quests != []
    end)
  end

  # =============================================================================
  # Programmatic Chain Building
  # =============================================================================

  @doc """
  Creates a new chain definition programmatically.

  ## Example

      Chain.define("my_chain",
        name: "My Quest Chain",
        quests: [
          {"quest_1", next: "quest_2"},
          {"quest_2", next: "quest_3"},
          {"quest_3", branches: [
            {flag: "good", next: "good_ending"},
            {flag: "evil", next: "evil_ending"},
            {:default, next: "neutral_ending"}
          ]},
          "good_ending",
          "evil_ending",
          "neutral_ending"
        ]
      )
  """
  def define(chain_id, opts) do
    name = Keyword.get(opts, :name, chain_id)
    description = Keyword.get(opts, :description)
    quests = Keyword.get(opts, :quests, [])
    tags = Keyword.get(opts, :tags, [])

    nodes = Enum.map(quests, &parse_quest_spec/1)
    start_quest = if nodes != [], do: hd(nodes).quest_id

    %Chain{
      id: chain_id,
      name: name,
      description: description,
      nodes: nodes,
      start_quest: start_quest,
      tags: tags
    }
  end

  @doc """
  Registers a programmatically-defined chain.

  Returns `:ok` or `{:error, reason}`.
  """
  def register_chain(%Chain{} = chain) do
    ChainRegistry.register(chain)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp find_node(%Chain{nodes: nodes}, quest_id) do
    Enum.find(nodes, &(&1.quest_id == quest_id))
  end

  defp resolve_next_quests(%GameState{} = state, %ChainNode{} = node) do
    if Enum.empty?(node.branches) do
      # No branches, return direct next quests
      node.next
    else
      # Evaluate branches in order
      Enum.find_value(node.branches, node.next, fn branch ->
        if Evaluator.evaluate(branch.condition, state) do
          List.wrap(branch.next)
        else
          nil
        end
      end)
    end
  end

  defp can_start_quest?(%GameState{} = state, quest_id) do
    completed = Progress.get_completed_quests(state)
    active = Progress.get_active_quests(state) |> Enum.map(& &1.id)

    # Not already completed or active
    # Quest definition exists
    quest_id not in completed &&
      quest_id not in active &&
      Definitions.get_quest_definition(quest_id) != nil
  end

  defp parse_quest_spec(spec) when is_binary(spec) do
    %ChainNode{quest_id: spec}
  end

  defp parse_quest_spec({quest_id, opts}) when is_binary(quest_id) and is_list(opts) do
    next = Keyword.get(opts, :next, []) |> List.wrap()
    branches = Keyword.get(opts, :branches, []) |> Enum.map(&parse_branch/1)
    optional = Keyword.get(opts, :optional, false)
    auto_start = Keyword.get(opts, :auto_start, true)

    %ChainNode{
      quest_id: quest_id,
      next: next,
      branches: branches,
      optional: optional,
      auto_start: auto_start
    }
  end

  defp parse_branch({:default, next: next_quest}) do
    %Branch{condition: :default, next: next_quest}
  end

  defp parse_branch({:flag, flag_name, next: next_quest}) do
    %Branch{condition: {:flag, flag_name}, next: next_quest}
  end

  defp parse_branch({:quest_completed, quest_id, next: next_quest}) do
    %Branch{condition: {:quest_completed, quest_id}, next: next_quest}
  end

  defp parse_branch({:level_gte, level, next: next_quest}) do
    %Branch{condition: {:level_gte, level}, next: next_quest}
  end

  defp parse_branch({:item_has, item_id, next: next_quest}) do
    %Branch{condition: {:item_has, item_id}, next: next_quest}
  end
end
