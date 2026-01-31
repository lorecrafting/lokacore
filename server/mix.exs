defmodule Loka.MixProject do
  use Mix.Project

  def project do
    [
      app: :loka,
      version: "0.1.0",
      elixir: "~> 1.19",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      compilers: [:phoenix_live_view] ++ Mix.compilers(),
      listeners: [Phoenix.CodeReloader],

      # ExDoc configuration
      name: "Loka",
      source_url: "https://github.com/yourusername/lokacore",
      docs: docs()
    ]
  end

  defp docs do
    [
      main: "readme",
      extras: [
        "README.md",
        "../docs/architecture/README.md": [title: "Architecture Overview"],
        "../docs/architecture/entity-system.md": [title: "Entity System"],
        "../docs/architecture/prototypes.md": [title: "Prototypes"],
        "../docs/architecture/hooks-and-locks.md": [title: "Hooks & Locks"],
        "../docs/ui/living-ebook-style-guide.md": [title: "UI Style Guide"]
      ],
      groups_for_modules: [
        # Engine Core
        "Engine - Core":
          ~r/^Loka\.Engine\.(Entity|Entities|EntityServer|EntityRegistry|EntitySupervisor)$/,
        "Engine - Prototypes":
          ~r/^Loka\.Engine\.(Prototype|PrototypeLoader|Spawner|WorldLoader|WorldExporter)$/,
        "Engine - Systems":
          ~r/^Loka\.Engine\.(Event|EventBus|Command|Behavior|Hooks|Locks|Scripting|Scripts)$/,
        "Engine - Schema": ~r/^Loka\.Engine\.Schema/,

        # Framework Systems
        "Framework - Combat": ~r/^Loka\.Framework\.Combat/,
        "Framework - Inventory": ~r/^Loka\.Framework\.Inventory/,
        "Framework - Abilities": ~r/^Loka\.Framework\.Abilities/,
        "Framework - Status": ~r/^Loka\.Framework\.Status/,
        "Framework - Progression": ~r/^Loka\.Framework\.Progression/,
        "Framework - Skills": ~r/^Loka\.Framework\.Skills/,
        "Framework - Quest": ~r/^Loka\.Framework\.Quest/,
        "Framework - Resources": ~r/^Loka\.Framework\.Resources/,
        "Framework - Crafting": ~r/^Loka\.Framework\.Crafting/,
        "Framework - Farming": ~r/^Loka\.Framework\.Farming/,
        "Framework - Gathering": ~r/^Loka\.Framework\.Gathering/,
        "Framework - Economy": ~r/^Loka\.Framework\.Economy/,
        "Framework - World": ~r/^Loka\.Framework\.World/,
        "Framework - Dialogue": ~r/^Loka\.Framework\.Dialogue/,
        "Framework - Player": ~r/^Loka\.Framework\.Player/,
        "Framework - Other":
          ~r/^Loka\.Framework\.(Companion|Appearance|Messaging|Faction|Hometown|Housing|Magic)/,

        # Web Layer
        "Web - Controllers": ~r/^LokaWeb\..*Controller$/,
        "Web - LiveView": ~r/^LokaWeb\..*Live/,
        "Web - Components": ~r/^LokaWeb\.(Components|CoreComponents|Layouts)/,

        # Accounts & Auth
        Accounts: ~r/^Loka\.(Accounts|Auth)/
      ],
      groups_for_extras: [
        Architecture: ~r/architecture/,
        "UI & Design": ~r/ui/
      ]
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Loka.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  def cli do
    [
      preferred_envs: [precommit: :test]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:bcrypt_elixir, "~> 3.0"},
      {:phoenix, "~> 1.8.3"},
      {:phoenix_ecto, "~> 4.5"},
      {:ecto_sql, "~> 3.13"},
      {:ecto_sqlite3, "~> 0.22.0"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_reload, "~> 1.2", only: :dev},
      {:phoenix_live_view, "~> 1.1.0"},
      {:lazy_html, ">= 0.1.0", only: :test},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:esbuild, "~> 0.10", runtime: Mix.env() == :dev},
      {:tailwind, "~> 0.3", runtime: Mix.env() == :dev},
      {:heroicons,
       github: "tailwindlabs/heroicons",
       tag: "v2.2.0",
       sparse: "optimized",
       app: false,
       compile: false,
       depth: 1},
      {:swoosh, "~> 1.16"},
      {:req, "~> 0.5"},
      {:resend, "~> 0.4"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"},
      {:gettext, "~> 1.0"},
      {:jason, "~> 1.2"},
      {:dns_cluster, "~> 0.2.0"},
      {:bandit, "~> 1.5"},

      # Auth - JWT for mobile clients
      {:guardian, "~> 2.4"},

      # UUID generation for entities
      {:elixir_uuid, "~> 1.2"},

      # YAML parsing for prototype files
      {:yaml_elixir, "~> 2.9"},

      # Documentation generation
      {:ex_doc, "~> 0.34", only: :dev, runtime: false},
      {:nimble_publisher, "~> 1.1"},
      {:makeup_elixir, ">= 0.0.0"},
      {:makeup_js, ">= 0.0.0"},
      {:makeup_html, ">= 0.0.0"},
      {:makeup_eex, ">= 0.0.0"},

      # Tidewave MCP server for AI coding assistance
      {:tidewave, "~> 0.5", only: :dev},

      # Production monitoring
      {:prom_ex, "~> 1.11"},
      {:posthog, "~> 0.3"},

      # Structured JSON logging for production
      {:logger_json, "~> 6.2"},

      # Circuit breaker for external services
      {:fuse, "~> 2.5"},

      # Property-based testing
      {:stream_data, "~> 1.1", only: [:dev, :test]},

      # Performance benchmarking
      {:benchee, "~> 1.3", only: [:dev, :test]},

      # Architecture boundary enforcement (available but not in compiler chain)
      # Use `mix boundary.visualize` for layer analysis
      {:boundary, "~> 0.10", runtime: false, only: [:dev]}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "ecto.setup", "assets.setup", "assets.build"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["compile", "tailwind loka", "esbuild loka"],
      "assets.deploy": [
        "tailwind loka --minify",
        "esbuild loka --minify",
        "phx.digest"
      ],
      precommit: ["compile --warnings-as-errors", "deps.unlock --unused", "format", "test"]
    ]
  end
end
