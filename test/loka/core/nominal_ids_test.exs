defmodule Loka.Core.NominalIdsTest do
  # What the compiler's type checker actually proves about the tagged ids in
  # Loka.Core.Contracts (03 §6), on the pinned toolchain. Each shape compiles a planted
  # PartyId misuse; `warns` is the observed result, hand-recorded. A shape that stops (or
  # starts) warning after an Elixir upgrade fails here, and the guarantee in contracts.ex
  # and docs/lessons/contracts.md must be restated.
  use ExUnit.Case, async: false

  @receiver """
  defmodule Probe.Receiver do
    def scope({:character_id, id}), do: id
    def actor(%{actor: {:character_id, id}}), do: id
    @spec player_scope(Loka.Core.Contracts.character_id()) :: map()
    def player_scope(id), do: %{kind: :player, character_id: id}
  end
  """

  @shapes [
    {"cross-module receiver matching the tag", true,
     "def x(v) do\n{:ok, p} = Contracts.party_id(v)\nProbe.Receiver.scope(p)\nend"},
    {"tag matched inside a map", true,
     "def x(v) do\n{:ok, p} = Contracts.party_id(v)\nProbe.Receiver.actor(%{actor: p})\nend"},
    {"@spec-only receiver (no pattern)", false,
     "def x(v) do\n{:ok, p} = Contracts.party_id(v)\nProbe.Receiver.player_scope(p)\nend"},
    {"runtime-selected CharacterId | PartyId forwarded", false,
     "def x(v, f) do\n{:ok, p} = if f, do: Contracts.character_id(v), else: Contracts.party_id(v)\nfwd(p)\nend\ndefp fwd(x), do: Probe.Receiver.scope(x)"},
    {"ids collected and consumed through Enum", false,
     "def x(vs) do\nps = Enum.map(vs, fn v -> {:ok, p} = Contracts.party_id(v); p end)\nEnum.map(ps, &Probe.Receiver.scope/1)\nend"},
    {"control: a CharacterId where a CharacterId is matched", false,
     "def x(v) do\n{:ok, c} = Contracts.character_id(v)\nProbe.Receiver.scope(c)\nend"}
  ]

  # `mix test` turns signature inference off; `mix compile` keeps the default, [:elixir].
  defp warns?(body) do
    dir = Path.join(System.tmp_dir!(), "loka-probe-#{System.unique_integer([:positive])}")
    File.mkdir_p!(dir)
    files = for {n, s} <- [receiver: @receiver, user: user(body)], do: write(dir, n, s)
    previous = Code.get_compiler_option(:infer_signatures)
    Code.put_compiler_option(:infer_signatures, [:elixir])

    try do
      compile = fn ->
        send(
          self(),
          Kernel.ParallelCompiler.compile_to_path(files, dir, return_diagnostics: true)
        )
      end

      ExUnit.CaptureIO.capture_io(:stderr, compile)
      assert_received {:ok, _, diagnostics}

      Enum.any?(
        diagnostics.compile_warnings ++ diagnostics.runtime_warnings,
        &(&1.message =~ "incompatible types")
      )
    after
      Code.put_compiler_option(:infer_signatures, previous)
      for m <- [Probe.Receiver, Probe.User], do: :code.purge(m) && :code.delete(m)
      File.rm_rf!(dir)
    end
  end

  defp user(body), do: "defmodule Probe.User do\nalias Loka.Core.Contracts\n#{body}\nend\n"

  defp write(dir, name, source),
    do: tap(Path.join(dir, "#{name}.ex"), &File.write!(&1, source))

  test "which PartyId misuses the compiler rejects" do
    observed = for {name, _, body} <- @shapes, do: {name, warns?(body)}
    assert observed == for({name, warns, _} <- @shapes, do: {name, warns})
  end
end
