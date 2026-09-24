defmodule LokaWeb.MixProject do
  use Mix.Project

  def project do
    [
      app: :loka_web,
      version: "0.1.0",
      build_path: "../../_build",
      config_path: "../../config/config.exs",
      deps_path: "../../deps",
      lockfile: "../../mix.lock",
      elixir: "~> 1.20",
      start_permanent: Mix.env() == :prod,
      compilers: [:boundary | Mix.compilers()],
      boundary: [default: [type: :strict]],
      deps: deps()
    ]
  end

  def application do
    [extra_applications: [:logger]]
  end

  defp deps do
    [
      {:loka_core, in_umbrella: true},
      {:loka_platform, in_umbrella: true},
      {:loka_runtime, in_umbrella: true},
      {:loka_builder, in_umbrella: true},
      {:boundary, "~> 0.11.0", runtime: false}
    ]
  end
end
