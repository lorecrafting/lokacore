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

  # Break: action_completed runs inside the action, so a reaction's status row on a timed action
  # faults like the action's own step. An untimed action's reaction stays lawful.
  test "a reaction's status on a timed action's completion is refused", %{tmp_dir: tmp} do
    File.cp_r!("cartridges/spell_effects_sampler", tmp)

    edit = fn name, change ->
      path = Path.join(tmp, name)
      File.write!(path, path |> File.read!() |> JSON.decode!() |> change.() |> JSON.encode!())
    end

    edit.("cartridge.json", &Map.delete(&1, "time_policy"))

    edit.("resources.json", fn r ->
      update_in(r["resources"], &Map.new(&1, fn {k, v} -> {k, Map.delete(v, "regen")} end))
    end)

    # The status moves to the reactions below; the action's own step is refused first otherwise.
    edit.("actions/ward.json", fn a ->
      a
      |> Map.put("duration", 300)
      |> put_in(["outcomes", "success", "steps"], [
        %{"op" => "fact.assign", "fact" => "ward_landed", "value" => true}
      ])
    end)

    apply = ~s({"op": "status.apply", "status": "warded"})

    for {name, on} <- [
          {"named", ~s({"event": "action_completed", "action": "ward"})},
          {"any", ~s({"event": "action_completed"})},
          {"other_action", ~s({"event": "action_completed", "action": "lux"})},
          {"other_event", ~s({"event": "status_applied"})}
        ] do
      File.write!(
        Path.join(tmp, "reactions/#{name}.json"),
        ~s({"on": #{on}, "steps": [#{apply}]})
      )
    end

    {:error, diags} = Content.compile(tmp)

    assert ["reactions/any.steps[0]", "reactions/named.steps[0]"] =
             diags
             |> Enum.filter(&(&1["data"]["why"] == "duration_status"))
             |> Enum.map(& &1["path"])
             |> Enum.filter(&String.starts_with?(&1, "reactions/"))
             |> Enum.sort()
  end
end
