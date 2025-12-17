defmodule Exmud.Engine.Command do
  @moduledoc """
  Command behaviour for the ExMUD engine.

  Commands are the primary way players interact with the world.
  They are parsed, validated, and executed in a pipeline.
  """

  alias Exmud.Engine.Event

  @type parse_result :: {:ok, map()} | {:error, String.t()}
  @type execute_result :: {:ok, [Event.t()]} | {:error, String.t()}
  @type context :: %{
          actor: map(),
          location: map(),
          session: pid()
        }

  @doc """
  Returns the primary command key (e.g., "look", "say", "move").
  """
  @callback key() :: String.t()

  @doc """
  Returns a list of command aliases (e.g., ["l"] for "look").
  """
  @callback aliases() :: [String.t()]

  @doc """
  Returns the help text for the command.
  """
  @callback help() :: String.t()

  @doc """
  Returns required permissions/locks for this command.
  """
  @callback locks() :: [atom()]

  @doc """
  Parses the command arguments and returns structured data.
  """
  @callback parse(args :: String.t(), context :: context()) :: parse_result()

  @doc """
  Executes the command and returns events to emit.
  """
  @callback execute(parsed :: map(), context :: context()) :: execute_result()

  @optional_callbacks [aliases: 0, locks: 0]

  @doc """
  Default implementation for aliases - returns empty list.
  """
  defmacro __using__(_opts) do
    quote do
      @behaviour Exmud.Engine.Command

      def aliases, do: []
      def locks, do: []

      defoverridable aliases: 0, locks: 0
    end
  end
end
