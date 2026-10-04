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

  # ashmere_road with a world move cost on a short ref, the cartridge's and mv's own condition
  # bands and their band.<key> text (c1-numbers; cartridge.schema.json WorldSettings).
  defp numbered(dir) do
    road = "cartridges/ashmere_road"
    dir = Path.join(dir, "numbered")
    File.cp_r!(road, dir)
    src = &JSON.decode!(File.read!(Path.join(road, &1)))
    band = &%{"at_percent" => &1, "key" => &2, "tone" => &3}
    bands = [band.(50, "fresh", "normal"), band.(0, "winded", "danger")]
    cost = %{"resource" => "ma", "amount" => 2}

    files = %{
      "cartridge.json" =>
        Map.put(src.("cartridge.json"), "world", %{
          "movement" => %{"cost" => cost},
          "bands" => bands
        }),
      "resources.json" => put_in(src.("resources.json"), ["resources", "mv", "bands"], bands),
      "text.json" =>
        Map.merge(src.("text.json"), %{"band.fresh" => "fresh", "band.winded" => "winded"})
    }

    for {rel, v} <- files, do: File.write!(Path.join(dir, rel), JSON.encode!(v))
    dir
  end

  # ashmere_road with six attributes, attributes@1 and pray gated on both leaves, short refs
  # (c1-attributes; cartridge.schema.json AttributeSpec, policy.schema.json Policy).
  defp attributed(dir) do
    road = "cartridges/ashmere_road"
    dir = Path.join(dir, "attributed")
    File.cp_r!(road, dir)
    src = &JSON.decode!(File.read!(Path.join(road, &1)))
    stats = %{"str" => 14, "dex" => 12, "con" => 13, "int" => 10, "spi" => 9, "per" => 11}

    root = %{
      "op" => "all",
      "items" => [
        %{"op" => "stat_compare", "attribute" => "str", "at_least" => 14},
        %{"op" => "resource_compare", "resource" => "mv", "at_least" => 2}
      ]
    }

    files = %{
      "cartridge.json" =>
        put_in(src.("cartridge.json"), ["requires", "capabilities", "attributes"], 1),
      "attributes.json" => %{
        "attributes" => Map.new(stats, fn {k, v} -> {k, %{"start" => v}} end)
      },
      "recipes/pray.json" => put_in(src.("recipes/pray.json"), ["policy", "root"], root)
    }

    for {rel, v} <- files, do: File.write!(Path.join(dir, rel), JSON.encode!(v))
    dir
  end

  # Breaks: the kernels encode, hash or lock differently; the loader rejects a compiled artifact.
  test "compiled artifacts load in TypeScript with identical bytes, hash and lock", %{
    tmp_dir: tmp
  } do
    paths =
      for {name, src} <- [
            {"hello", @hello},
            {"rich", rich(tmp)},
            {"numbered", numbered(tmp)},
            {"attributed", attributed(tmp)},
            {"wear", "cartridges/ashmere_wear"},
            {"locks", "cartridges/ashmere_locks"},
            {"rest", "cartridges/ashmere_rest"},
            {"journal", "cartridges/ashmere_journal"},
            {"sampler", "cartridges/ashmere_sampler"}
          ] do
        out = Path.join(tmp, "#{name}.artifact.json")
        compile(src, out)
        assert_received {:exit, :ok}
        out
      end

    input = Path.join(tmp, "peer.json")
    File.write!(input, JSON.encode!(%{"installed" => @installed, "paths" => paths}))
    {stdout, 0} = System.cmd("node", [@peer, input])
    [hello | _] = loaded = JSON.decode!(stdout)

    assert hello["hash"] == @kat["sha256"]
    assert hello["lock"] == @kat["value"]["lock"]

    for {theirs, path} <- Enum.zip(loaded, paths) do
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
