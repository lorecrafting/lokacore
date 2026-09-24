defmodule Loka.MixProject do
  use Mix.Project

  def project do
    [
      app: :loka,
      version: "0.1.0",
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
      {:boundary, "~> 0.11.0", runtime: false},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false}
    ]
  end
end
