defmodule Exmud.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      ExmudWeb.Telemetry,
      Exmud.Repo,
      {Ecto.Migrator,
       repos: Application.fetch_env!(:exmud, :ecto_repos), skip: skip_migrations?()},
      {DNSCluster, query: Application.get_env(:exmud, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Exmud.PubSub},

      # Engine Core - New Components (order matters!)
      Exmud.Engine.Hooks,
      Exmud.Engine.PrototypeLoader,
      {Registry, keys: :unique, name: Exmud.Engine.EntityRegistry.Registry},
      {Exmud.Engine.EntitySupervisor, name: Exmud.Engine.EntitySupervisor},
      Exmud.Engine.EntityRegistry,

      # Framework layer
      Exmud.Framework.Combat.Spawner,

      # Start to serve requests, typically the last entry
      ExmudWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Exmud.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ExmudWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp skip_migrations?() do
    # By default, sqlite migrations are run when using a release
    System.get_env("RELEASE_NAME") == nil
  end
end
