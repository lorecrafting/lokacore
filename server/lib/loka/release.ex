defmodule Loka.Release do
  @moduledoc """
  Used for executing DB release tasks when run in production without Mix
  installed.
  """
  @app :loka

  def migrate do
    load_app()

    case ensure_db_directory() do
      :ok ->
        for repo <- repos() do
          {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
        end

      :skip ->
        # Volume not mounted - migrations will run at app startup instead
        IO.puts("Skipping migrations - volume not mounted (will run at app startup)")
    end
  end

  defp ensure_db_directory do
    # Ensure the SQLite database directory exists
    # On Fly.io, the release command runs in an ephemeral machine without
    # the volume mounted, so we skip migrations in that case
    case System.get_env("DATABASE_PATH") do
      nil ->
        :ok

      path ->
        dir = Path.dirname(path)

        case File.mkdir_p(dir) do
          :ok ->
            :ok

          {:error, :eacces} ->
            # Permission denied - volume not mounted in release command
            :skip

          {:error, reason} ->
            raise "Failed to create database directory #{dir}: #{inspect(reason)}"
        end
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    # Many platforms require SSL when connecting to the database
    Application.ensure_all_started(:ssl)
    Application.ensure_loaded(@app)
  end
end
