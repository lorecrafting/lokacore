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

  @doc """
  Get the Spark's status for display.
  """
  @spec status(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def status(_ctx) do
    # Spark module removed in V2
    {:error, "Spark companion is not available."}
  end

  @doc """
  Get pending "while you were away" updates.
  """
  @spec get_updates(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def get_updates(_ctx) do
    # Spark module removed in V2
    {:error, "Spark companion is not available."}
  end

  @doc """
  Mark pending updates as delivered.
  """
  @spec dismiss_updates(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def dismiss_updates(_ctx) do
    # Spark module removed in V2
    {:error, "Spark companion is not available."}
  end

  @doc """
  Ask Spark a question or for help.

  This is a placeholder for future AI-enhanced responses.
  Currently provides basic help information.
  """
  @spec ask(Context.t(), String.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def ask(_ctx, _question) do
    # Spark module removed in V2
    {:error, "Spark companion is not available."}
  end
end
