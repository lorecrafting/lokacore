defmodule Loka.ContentRoadTest do
  # Resources, costs, threshold checks and cooldowns in the compiler (R5 S6b; resource.schema.json
  # ResourceSpec; action.schema.json ActionRecipe). Expected diagnostics are hand-written from
  # protocol/cartridge.schema.json DiagnosticCode, with the loader's paths in
  # kernel/ts/test/recipes_loader.test.ts; the known answer is
  # protocol/fixtures/cartridge_road_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_road_hash.json"))
  @src "cartridges/ashmere_road"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  # ashmere_road's source with `files` merged over it (nil removes a file).
  defp compile(dir, files) do
    base =
      for rel <- Path.wildcard("#{@src}/**/*.json"),
          not String.contains?(rel, "transcripts"),
          into: %{},
          do: {Path.relative_to(rel, @src), JSON.decode!(File.read!(rel))}

    for {rel, v} <- Map.merge(base, files), v != nil do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))
  defp edit(rel, path, v), do: %{rel => put_in(src(rel), path, v)}
  defp resources(r), do: %{"resources.json" => %{"resources" => r}}
  defp artifact({:ok, a, []}), do: JSON.decode!(a)["cartridge"]

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "ashmere_road",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  defp d(code, path, data \\ %{}) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => []
    }
  end

  # Breaks: a default pool, an override, resource@1, a cost, threshold, cooldown or
  # resource.adjust step dropped or reshaped.
  test "ashmere_road compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a short resource reference left short (the loader would reject the artifact).
  test "full resource references compile to the same artifact", %{tmp_dir: dir} do
    shove =
      src("recipes/shove_cart.json")
      |> put_in(["costs", Access.at(0), "resource"], ref("resource", "mv"))
      |> put_in(["check", "resource"], ref("resource", "hp"))

    pray =
      put_in(
        src("recipes/pray.json"),
        ["outcomes", "success", "sequence", Access.at(0), "resource"],
        ref("resource", "hp")
      )

    files = %{"recipes/shove_cart.json" => shove, "recipes/pray.json" => pray}
    assert compile(dir, files) == {:ok, @expected, []}
  end

  # Breaks: the defaults missing without resources.json, or an authored resource not declared.
  test "the default pools come without resources.json; a new resource joins them",
       %{tmp_dir: dir} do
    plain = artifact(compile(Path.join(dir, "a"), %{"resources.json" => nil}))
    assert plain["lock"]["capabilities"]["resource"] == 1
    assert plain["manifest"]["requires"]["capabilities"]["resource"] == 1

    assert plain["resources"]["ashmere_road@0.0.1:resource/hp"] ==
             %{"key" => "hp", "minimum" => 0, "maximum" => 20, "start" => 20, "gain" => 5}

    coins = %{"minimum" => 0, "maximum" => 50, "start" => 3, "gain" => 0}
    rich = artifact(compile(Path.join(dir, "b"), resources(%{"coins" => coins})))

    assert rich["resources"]["ashmere_road@0.0.1:resource/coins"] ==
             Map.put(coins, "key", "coins")

    assert map_size(rich["resources"]) == 4
  end

  # Breaks: a spec whose bounds do not hold its start compiles (the loader rejects it), or a
  # partial new resource compiles.
  test "resources.json: bounds, missing fields and authored keys", %{tmp_dir: dir} do
    bad = {:error, [d("RESOURCE_SPEC_INVALID", "resources.resources.hp")]}
    assert compile(Path.join(dir, "a"), resources(%{"hp" => %{"start" => 30}})) == bad
    assert compile(Path.join(dir, "b"), resources(%{"hp" => %{"minimum" => 30}})) == bad

    assert compile(Path.join(dir, "c"), resources(%{"coins" => %{"maximum" => 5}})) ==
             {:error,
              for(
                f <- ~w(gain minimum start),
                do:
                  d("SCHEMA_VIOLATION", "resources.resources.coins.#{f}", %{
                    "error" => "missing_property"
                  })
              )}

    assert compile(Path.join(dir, "d"), resources(%{"hp" => %{"key" => "hp"}})) ==
             {:error, [d("UNKNOWN_FIELD", "resources.resources.hp.key")]}
  end

  # Breaks: a recipe naming a resource the cartridge lacks compiles (the loader rejects it).
  test "a cost's, threshold's or resource.adjust's unknown resource is UNRESOLVED_REFERENCE",
       %{tmp_dir: dir} do
    target = %{"target" => "ashmere_road@0.0.1:resource/sp"}

    assert compile(
             Path.join(dir, "a"),
             edit("recipes/shove_cart.json", ["costs", Access.at(0), "resource"], "sp")
           ) ==
             {:error, [d("UNRESOLVED_REFERENCE", "recipes/shove_cart.costs[0].resource", target)]}

    assert compile(
             Path.join(dir, "b"),
             edit("recipes/shove_cart.json", ["check", "resource"], "sp")
           ) ==
             {:error, [d("UNRESOLVED_REFERENCE", "recipes/shove_cart.check.resource", target)]}

    step = ["outcomes", "success", "sequence", Access.at(0), "resource"]

    assert compile(Path.join(dir, "c"), edit("recipes/pray.json", step, "sp")) ==
             {:error,
              [
                d(
                  "UNRESOLVED_REFERENCE",
                  "recipes/pray.outcomes.success.sequence[0].resource",
                  target
                )
              ]}
  end
end
