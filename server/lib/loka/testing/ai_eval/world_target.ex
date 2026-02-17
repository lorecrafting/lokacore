defmodule Loka.Testing.AIEval.WorldTarget do
  @moduledoc """
  Configuration for different world targets (eval, dev, test).

  Controls which content directory and database the eval harness uses.
  Only `eval` is writable — dev and test are read-only for verification.
  """

  @type world :: :eval | :dev | :test

  @type config :: %{
          base_path: String.t(),
          db: String.t(),
          writable: boolean()
        }

  @spec config(world()) :: config()
  def config(:eval) do
    %{
      base_path: "priv/world/eval",
      db: "loka_eval.db",
      writable: true
    }
  end

  def config(:dev) do
    %{
      base_path: "priv/world",
      db: "loka_dev.db",
      writable: false
    }
  end

  def config(:test) do
    %{
      base_path: "priv/world",
      db: "loka_test.db",
      writable: false
    }
  end

  @doc """
  Returns the content directories for a given world target.
  """
  @spec content_dirs(world()) :: [String.t()]
  def content_dirs(world) do
    base = config(world).base_path

    [
      Path.join(base, "prototypes/npcs"),
      Path.join(base, "prototypes/items"),
      Path.join(base, "prototypes/rooms"),
      Path.join(base, "quests"),
      Path.join(base, "dialogues"),
      Path.join(base, "zones"),
      Path.join(base, "cutscenes"),
      Path.join(base, "scripts")
    ]
  end

  @doc """
  Ensures all eval directories exist.
  """
  @spec ensure_dirs!(world()) :: :ok
  def ensure_dirs!(world) do
    for dir <- content_dirs(world) do
      File.mkdir_p!(dir)
    end

    :ok
  end

  @doc """
  Cleans the eval world — removes all generated content.
  Only works for the :eval world target.
  """
  @spec clean!(world()) :: :ok | {:error, :not_writable}
  def clean!(:eval) do
    base = config(:eval).base_path

    if File.exists?(base) do
      File.rm_rf!(base)
    end

    # Also remove eval DB
    db = config(:eval).db
    if File.exists?(db), do: File.rm!(db)

    :ok
  end

  def clean!(_), do: {:error, :not_writable}
end
