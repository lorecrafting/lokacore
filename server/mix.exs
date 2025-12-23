defmodule Exmud.MixProject do
  use Mix.Project

  def project do
    [
      app: :exmud,
      version: "0.1.0",
      elixir: "~> 1.19",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      compilers: [:phoenix_live_view] ++ Mix.compilers(),
      listeners: [Phoenix.CodeReloader],

      # ExDoc configuration
      name: "ExMUD",
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
        "Engine - Core": ~r/^Exmud\.Engine\.(Entity|Entities|EntityServer|EntityRegistry|EntitySupervisor)$/,
        "Engine - Prototypes": ~r/^Exmud\.Engine\.(Prototype|PrototypeLoader|Spawner|WorldLoader|WorldExporter)$/,
        "Engine - Systems": ~r/^Exmud\.Engine\.(Event|EventBus|Command|Behavior|Hooks|Locks|Scripting|Scripts)$/,
        "Engine - Schema": ~r/^Exmud\.Engine\.Schema/,

        # Framework Systems
        "Framework - Combat": ~r/^Exmud\.Framework\.Combat/,
        "Framework - Inventory": ~r/^Exmud\.Framework\.Inventory/,
        "Framework - Abilities": ~r/^Exmud\.Framework\.Abilities/,
        "Framework - Status": ~r/^Exmud\.Framework\.Status/,
        "Framework - Progression": ~r/^Exmud\.Framework\.Progression/,
        "Framework - Skills": ~r/^Exmud\.Framework\.Skills/,
        "Framework - Quest": ~r/^Exmud\.Framework\.Quest/,
        "Framework - Resources": ~r/^Exmud\.Framework\.Resources/,
        "Framework - Crafting": ~r/^Exmud\.Framework\.Crafting/,
        "Framework - Farming": ~r/^Exmud\.Framework\.Farming/,
        "Framework - Gathering": ~r/^Exmud\.Framework\.Gathering/,
        "Framework - Economy": ~r/^Exmud\.Framework\.Economy/,
        "Framework - World": ~r/^Exmud\.Framework\.World/,
        "Framework - Dialogue": ~r/^Exmud\.Framework\.Dialogue/,
        "Framework - Player": ~r/^Exmud\.Framework\.Player/,
        "Framework - Other": ~r/^Exmud\.Framework\.(Companion|Appearance|Messaging|Faction|Hometown|Housing|Magic)/,

        # Web Layer
        "Web - Controllers": ~r/^ExmudWeb\..*Controller$/,
        "Web - LiveView": ~r/^ExmudWeb\..*Live/,
        "Web - Components": ~r/^ExmudWeb\.(Components|CoreComponents|Layouts)/,

        # Accounts & Auth
        "Accounts": ~r/^Exmud\.(Accounts|Auth)/
      ],
      groups_for_extras: [
        "Architecture": ~r/architecture/,
        "UI & Design": ~r/ui/
      ]
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Exmud.Application, []},
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
      {:ecto_sqlite3, ">= 0.0.0"},
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

      # Lua scripting for game logic
      {:luerl, "~> 1.5"},

      # UUID generation for entities
      {:elixir_uuid, "~> 1.2"},

      # YAML parsing for prototype files
      {:yaml_elixir, "~> 2.9"},

      # Documentation generation
      {:ex_doc, "~> 0.34", only: :dev, runtime: false}

      # TUI for game editor (blocked by ex_termbox/Python 3.11+ incompatibility)
      # {:ratatouille, "~> 0.5"}
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
      "assets.build": ["compile", "tailwind exmud", "esbuild exmud"],
      "assets.deploy": [
        "tailwind exmud --minify",
        "esbuild exmud --minify",
        "phx.digest"
      ],
      precommit: ["compile --warnings-as-errors", "deps.unlock --unused", "format", "test"]
    ]
  end
end
