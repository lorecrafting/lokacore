defmodule Loka.ContentFaultsTest do
  # Content that once crashed the compiler or faulted at runtime gets a plain refusal (loka-vduxr.7).
  use ExUnit.Case, async: true

  alias Loka.Content

  @moduletag :tmp_dir

  # Break: a rejected text.json crashes the compiler (BadMapError) in the checks that read prose
  # keys of a population or a bleed, instead of reporting the file.
  test "a rejected text catalog is reported, not a crash", %{tmp_dir: tmp} do
    for name <- ~w(shoo_sampler bleed_sampler) do
      dir = Path.join(tmp, name)
      File.cp_r!("cartridges/#{name}", dir)
      File.write!(Path.join(dir, "text.json"), ~s({"x": 1}))
      assert {:error, diags} = Content.compile(dir), name
      assert Enum.any?(diags, &String.starts_with?(&1["path"], "text")), name
    end
  end

  # Break: a duration on an action that applies a status compiles, and the first cast faults
  # because the status row is written before the action's own time.advance.
  test "a timed action that applies a status is refused", %{tmp_dir: tmp} do
    File.cp_r!("cartridges/spell_effects_sampler", tmp)

    edit =
      &File.write!(
        Path.join(tmp, &1),
        Path.join(tmp, &1) |> File.read!() |> JSON.decode!() |> &2.() |> JSON.encode!()
      )

    edit.("cartridge.json", &Map.delete(&1, "time_policy"))

    edit.("resources.json", fn r ->
      update_in(r["resources"], &Map.new(&1, fn {k, v} -> {k, Map.delete(v, "regen")} end))
    end)

    edit.("actions/ward.json", &Map.put(&1, "duration", 300))

    {:error, diags} = Content.compile(tmp)

    assert [%{"path" => "actions/ward.outcomes.success.steps[0]"}] =
             Enum.filter(diags, &(&1["data"]["why"] == "duration_status"))

    assert Enum.any?(
             Content.explained(diags, tmp),
             &(&1 =~ "An action with a duration cannot apply a status")
           )
  end
end
