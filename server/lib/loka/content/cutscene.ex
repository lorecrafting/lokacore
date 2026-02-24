defmodule Loka.Content.Cutscene do
  @moduledoc """
  Cutscene definition - content entity.

  Cutscenes are timed sequences of narration and dialogue lines
  played to a single player via the channel.

  ## Usage

      {:ok, cutscene} = Cutscene.get("grove_awakening")
      sequence = Cutscene.sequence(cutscene)
  """

  alias Loka.Engine.{Entity, Entities}

  @doc """
  Gets a cutscene by key.
  """
  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Entities.find_one(key: key, type: :cutscene)
  end

  @doc """
  Gets the sequence of lines from a cutscene entity.

  Each line is a map with `"text"`, `"delay"` (ms), and optional `"class"`.
  """
  @spec sequence(Entity.t()) :: [map()]
  def sequence(%Entity{type: :cutscene} = cutscene) do
    data = cutscene.components["data"] || %{}
    data["sequence"] || []
  end
end
