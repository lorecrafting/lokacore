defmodule Loka.PluginFixtures do
  @moduledoc """
  Test fixtures for the plugin system.
  """

  defmodule MinimalPlugin do
    @moduledoc "A minimal plugin with only required callbacks."
    use Loka.Engine.Plugin

    @impl true
    def name, do: :minimal_plugin

    @impl true
    def version, do: "1.0.0"

    @impl true
    def description, do: "A minimal test plugin"
  end

  defmodule FullPlugin do
    @moduledoc "A plugin that overrides all optional callbacks."
    use Loka.Engine.Plugin

    @impl true
    def name, do: :full_plugin

    @impl true
    def version, do: "2.0.0"

    @impl true
    def description, do: "A fully-featured test plugin"

    @impl true
    def dependencies, do: [:minimal_plugin]

    @impl true
    def commands, do: []

    @impl true
    def hooks, do: []

    @impl true
    def validators, do: []

    @impl true
    def scripting_extensions, do: []

    @impl true
    def prototype_paths, do: []

    @impl true
    def balance_config_path, do: nil

    @impl true
    def children, do: []

    @impl true
    def init do
      # Track that init was called (only if tracker is running)
      if Process.whereis(__MODULE__.InitTracker) do
        Agent.update(__MODULE__.InitTracker, fn _ -> true end)
      end

      :ok
    end
  end

  defmodule PluginA do
    @moduledoc "Plugin A - no dependencies"
    use Loka.Engine.Plugin

    def name, do: :plugin_a
    def version, do: "1.0.0"
    def description, do: "Plugin A"
  end

  defmodule PluginB do
    @moduledoc "Plugin B - depends on A"
    use Loka.Engine.Plugin

    def name, do: :plugin_b
    def version, do: "1.0.0"
    def description, do: "Plugin B"
    def dependencies, do: [:plugin_a]
  end

  defmodule PluginC do
    @moduledoc "Plugin C - depends on B"
    use Loka.Engine.Plugin

    def name, do: :plugin_c
    def version, do: "1.0.0"
    def description, do: "Plugin C"
    def dependencies, do: [:plugin_b]
  end

  defmodule CyclicPluginA do
    @moduledoc "Cyclic Plugin A - depends on B (creates cycle)"
    use Loka.Engine.Plugin

    def name, do: :cyclic_a
    def version, do: "1.0.0"
    def description, do: "Cyclic A"
    def dependencies, do: [:cyclic_b]
  end

  defmodule CyclicPluginB do
    @moduledoc "Cyclic Plugin B - depends on A (creates cycle)"
    use Loka.Engine.Plugin

    def name, do: :cyclic_b
    def version, do: "1.0.0"
    def description, do: "Cyclic B"
    def dependencies, do: [:cyclic_a]
  end

  defmodule MissingDepPlugin do
    @moduledoc "Plugin with missing dependency"
    use Loka.Engine.Plugin

    def name, do: :missing_dep
    def version, do: "1.0.0"
    def description, do: "Missing dep"
    def dependencies, do: [:nonexistent_plugin]
  end

  defmodule TestChildServer do
    @moduledoc "A simple GenServer for testing plugin children."
    use GenServer

    def start_link(opts \\ []) do
      name = Keyword.get(opts, :name, __MODULE__)
      GenServer.start_link(__MODULE__, opts, name: name)
    end

    @impl true
    def init(opts) do
      {:ok, %{started_at: DateTime.utc_now(), opts: opts}}
    end

    @impl true
    def handle_call(:ping, _from, state) do
      {:reply, :pong, state}
    end
  end

  defmodule PluginWithChild do
    @moduledoc "Plugin that registers a child GenServer."
    use Loka.Engine.Plugin

    def name, do: :plugin_with_child
    def version, do: "1.0.0"
    def description, do: "Plugin with child"

    def children do
      [{TestChildServer, name: :test_child_from_plugin}]
    end
  end
end
