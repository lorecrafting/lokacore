defmodule Loka.CartridgeCrossKernelTest do
  # ADR-074 §3, 14 §R4: artifacts the Elixir compiler (mix loka.compile) writes load in the
  # TypeScript loader (kernel/ts/test/cartridge_peer.ts) with identical canonical bytes, hash
  # and lock; a source the compiler rejects writes no artifact. The hello source is also held
  # to the Python known answer (protocol/fixtures/cartridge_hash.json), never only to the
  # other kernel.
  use ExUnit.Case, async: true
  import ExUnit.CaptureIO

  @moduletag :tmp_dir
  @peer "kernel/ts/test/cartridge_peer.ts"
  @hello "cartridges/ashmere_hello"
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_hash.json"))
  @installed %{
    "kernel_api" => "1.0",
    "capabilities" =>
      Map.new(JSON.decode!(File.read!("protocol/capability_registry.json")), fn e ->
        {e["key"], [e["version"]]}
      end),
    "content_schema" => 1,
    "rule_ir" => 1,
    "client_features" => []
  }

  # Runs mix loka.compile; sends {:exit, :ok} or {:exit, reason}; returns its stderr.
  defp compile(dir, out) do
    capture_io(:stderr, fn ->
      result =
        try do
          Mix.Tasks.Loka.Compile.run([dir, out])
        catch
          :exit, reason -> reason
        end

      send(self(), {:exit, result})
    end)
  end

  # hello's source copied to `dir` with `files` (relative path => JSON value) written over it.
  defp variant(dir, files) do
    File.cp_r!(@hello, dir)
    for {rel, v} <- files, do: File.write!(Path.join(dir, rel), JSON.encode!(v))
    dir
  end

  defp read(rel), do: JSON.decode!(File.read!(Path.join(@hello, rel)))

  defp fact(key),
    do: %{
      "cartridge_id" => "ashmere_hello",
      "cartridge_version" => "0.0.1",
      "kind" => "fact",
      "key" => key
    }

  # More shapes than hello: enum and int facts under dotted names, nested all/any/not, a
  # second action whose command another capability owns.
  defp rich(dir) do
    facts = read("facts.json")

    mood = %{
      "version" => 1,
      "value_type" => %{"type" => "enum", "values" => ["calm", "lost"], "default" => "calm"},
      "scopes" => ["player"],
      "meaning" => "m"
    }

    oil = %{
      "version" => 1,
      "value_type" => %{"type" => "int", "minimum" => 0, "maximum" => 9, "default" => 3},
      "scopes" => ["instance"],
      "meaning" => "o"
    }

    root = %{
      "op" => "all",
      "items" => [
        %{
          "op" => "not",
          "item" => %{"op" => "fact_compare", "fact" => fact("bram_mood"), "equals" => "lost"}
        },
        %{
          "op" => "any",
          "items" => [
            %{"op" => "fact_compare", "fact" => fact("lantern_oil"), "equals" => 3},
            %{"op" => "target_present"}
          ]
        }
      ]
    }

    look =
      Map.merge(read("actions/talk.json"), %{
        "label" => "actions.look",
        "command" => "look",
        "accessibility" => "actions.look.a11y",
        "policy" => %{"policy_version" => 1, "root" => root}
      })

    variant(Path.join(dir, "rich"), %{
      "facts.json" =>
        put_in(
          facts,
          ["facts"],
          Map.merge(facts["facts"], %{"bram.mood" => mood, "lantern.oil" => oil})
        ),
      "policies/gate.json" => %{"policy_version" => 1, "root" => root},
      "actions/look.json" => look
    })
  end

  # Breaks: the kernels encode, hash or lock differently; the loader rejects a compiled artifact.
  test "compiled artifacts load in TypeScript with identical bytes, hash and lock", %{
    tmp_dir: tmp
  } do
    paths =
      for {name, src} <- [{"hello", @hello}, {"rich", rich(tmp)}] do
        out = Path.join(tmp, "#{name}.artifact.json")
        compile(src, out)
        assert_received {:exit, :ok}
        out
      end

    input = Path.join(tmp, "peer.json")
    File.write!(input, JSON.encode!(%{"installed" => @installed, "paths" => paths}))
    {stdout, 0} = System.cmd("node", [@peer, input])
    [hello, rich] = JSON.decode!(stdout)

    assert hello["hash"] == @kat["sha256"]
    assert hello["lock"] == @kat["value"]["lock"]

    for {theirs, path} <- Enum.zip([hello, rich], paths) do
      bytes = File.read!(path)
      ours = JSON.decode!(bytes)
      assert theirs["artifact"] == bytes, path
      assert theirs["hash"] == ours["content_hash"], path
      assert theirs["lock"] == ours["cartridge"]["lock"], path
    end
  end

  # Breaks: the task writes the artifact (or a partial file) before or despite diagnostics.
  test "a source the compiler rejects writes no artifact", %{tmp_dir: tmp} do
    manifest = read("cartridge.json")
    undeclared = update_in(manifest, ["requires", "capabilities"], &Map.delete(&1, "dialogue"))
    has_item = %{"op" => "has_item", "item" => %{fact("lantern") | "kind" => "item"}}
    talk = put_in(read("actions/talk.json"), ["policy", "root"], has_item)

    for {name, files, code} <- [
          {"undeclared", %{"cartridge.json" => undeclared}, "UNDECLARED_CAPABILITY"},
          {"unresolved", %{"actions/talk.json" => talk}, "UNRESOLVED_REFERENCE"}
        ] do
      out = Path.join(tmp, "#{name}.artifact.json")
      stderr = compile(variant(Path.join(tmp, name), files), out)
      assert stderr =~ ~s("code":"#{code}"), name
      assert_received {:exit, {:shutdown, 1}}
      refute File.exists?(out), name
    end
  end
end
