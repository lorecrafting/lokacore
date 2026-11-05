defmodule Mix.Tasks.Loka.CompileServeTest do
  # Synchronous: it captures :stderr, one device shared by every test (loka-kgd.211).
  use ExUnit.Case, async: false

  @moduletag :tmp_dir
  @moduletag timeout: 300_000

  # Break: the author preview's resident compiler (docs/system/cartridge.md, Author preview) answers
  # a save differently from the one-shot it replaces: other artifact, diagnostics or placeholder map
  # bytes, other status or said lines, or state carried from one compile into the next (each source
  # is served again after all the others).
  test "--serve answers every compile as the one-shot does", %{tmp_dir: tmp} do
    error = Loka.ContentSource.copy("cartridges/resource_sampler")
    pray = Path.join(error, "actions/pray.json")
    File.write!(pray, String.replace(File.read!(pray), ~r/\n}\n$/, ",\n  \"comand\": \"x\"\n}\n"))
    held = Loka.ContentSource.copy("cartridges/speech_sampler")
    text = Path.join(held, "text.json")
    File.write!(text, String.replace(File.read!(text), ~r/^{/, "{\n  \"room.unwritten\": \"~\","))
    cartridges = Enum.map(Path.wildcard("cartridges/*"), &{&1, true})
    sources = cartridges ++ [{error, true}, {held, true}, {held, false}]
    requests = Enum.with_index(sources ++ [hd(sources) | Enum.take(sources, -3)])

    args = fn {{dir, preview}, i}, mode ->
      out = Path.join([tmp, mode, "#{i}"])
      File.mkdir_p!(out)
      json = ["--json", Path.join(out, "d.json")]
      held = ["--placeholders", Path.join(out, "h.json")]
      flags = if preview, do: ["--allow-placeholders" | json] ++ held, else: json
      [dir, Path.join(out, "a.json") | flags]
    end

    one_shot =
      for request <- requests do
        said =
          ExUnit.CaptureIO.capture_io(:stderr, fn ->
            status =
              try do
                Mix.Tasks.Loka.Compile.run(args.(request, "one"))
                0
              catch
                :exit, {:shutdown, 1} -> 1
              end

            IO.write(:stderr, "#{status}\n")
          end)

        {status, said} = String.split(said, "\n", trim: true) |> List.pop_at(-1)
        %{"status" => String.to_integer(status), "stderr" => Enum.map_join(said, &(&1 <> "\n"))}
      end

    input = Enum.map_join(requests, &(Enum.join(args.(&1, "serve"), "\t") <> "\n"))
    out = ExUnit.CaptureIO.capture_io(input, fn -> Mix.Tasks.Loka.Compile.run(["--serve"]) end)

    served =
      for "loka.compile " <> reply <- String.split(out, "\n"), do: JSON.decode!(reply)

    assert served == one_shot
    n = length(cartridges)
    assert Enum.all?(Enum.take(served, n), &(&1["status"] == 0))
    assert %{"status" => 1, "stderr" => "error: actions/pray.json:33 " <> _} = Enum.at(served, n)
    assert %{"status" => 0, "stderr" => ""} = Enum.at(served, n + 1)
    assert %{"status" => 1, "stderr" => "error: text.json:2 " <> _} = Enum.at(served, n + 2)

    for {_, i} <- requests, file <- ~w(a.json d.json h.json) do
      assert File.read(Path.join([tmp, "serve", "#{i}", file])) ==
               File.read(Path.join([tmp, "one", "#{i}", file]))
    end
  end
end
