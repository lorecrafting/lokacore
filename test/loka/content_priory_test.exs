defmodule Loka.ContentPrioryTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Break: item-readable short refs, its text or API floor bypass the compiler boundary.
  test "book authoring rejects malformed metadata and undeclared topic references", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/ashmere_missing_child", dir)

    for {rel, keys, value, code} <- [
          {"items/ward_of_the_fen.json", ["readable", "topic"], "missing",
           "UNRESOLVED_REFERENCE"},
          {"items/ward_of_the_fen.json", ["readable", "topic"],
           %{
             "cartridge_id" => "ashmere_missing_child",
             "cartridge_version" => "0.0.28",
             "kind" => "fact",
             "key" => "topic_ward_known"
           }, "UNRESOLVED_REFERENCE"},
          {"items/ward_of_the_fen.json", ["readable", "label"], "missing",
           "UNRESOLVED_REFERENCE"},
          {"items/ward_of_the_fen.json", ["readable", "text"], "missing", "UNRESOLVED_REFERENCE"},
          {"items/ward_of_the_fen.json", ["readable"], %{"label" => "actions.read_book"},
           "SCHEMA_VIOLATION"},
          {"items/ward_of_the_fen.json", ["readable"], %{"text" => "readable.ward_of_the_fen"},
           "SCHEMA_VIOLATION"},
          {"cartridge.json", ["requires", "kernel_api", "at_least"], "1.23",
           "KERNEL_API_RANGE_INVALID"}
        ] do
      path = Path.join(dir, rel)
      original = File.read!(path)
      changed = put_in(JSON.decode!(original), Enum.map(keys, &Access.key!/1), value)
      File.write!(path, JSON.encode!(changed))
      assert {:error, errors} = Loka.Content.compile(dir)
      assert Enum.any?(errors, &(&1["code"] == code)), inspect(errors)
      File.write!(path, original)
    end
  end
end
