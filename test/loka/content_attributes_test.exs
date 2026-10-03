defmodule Loka.ContentAttributesTest do
  # c1-attributes: attributes.json and the leaves stat_compare and resource_compare (06 §21 and
  # 00 §4.3 amendments 2026-10-03; cartridge.schema.json AttributeSpec). Paths and codes are
  # hand-written from DiagnosticCode; the loader's twins are protocol/fixtures/cartridge_loader.json
  # attribute_*, stat_compare_* and resource_compare_* cases.
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @src "cartridges/ashmere_road"
  @pray "ashmere_road@0.0.1:recipe/pray"
  @stats %{"str" => 14, "dex" => 12, "con" => 13, "int" => 10, "spi" => 9, "per" => 11}

  # ashmere_road with `attributes` (nil: no attributes.json), attributes@1 locked when `lock`,
  # and pray's policy root `root`.
  defp compile(
         dir,
         root,
         lock \\ true,
         attributes \\ Map.new(@stats, &{elem(&1, 0), %{"start" => elem(&1, 1)}})
       ) do
    File.cp_r!(@src, dir)
    File.rm_rf!(Path.join(dir, "transcripts"))
    write = &File.write!(Path.join(dir, &1), JSON.encode!(&2))
    caps = if lock, do: %{"attributes" => 1}, else: %{}

    write.(
      "cartridge.json",
      update_in(src("cartridge.json"), ["requires", "capabilities"], &Map.merge(&1, caps))
    )

    write.("recipes/pray.json", put_in(src("recipes/pray.json"), ["policy", "root"], root))
    if attributes, do: write.("attributes.json", %{"attributes" => attributes})
    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "ashmere_road",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  defp d(code, path, data, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp stat(key, at_least),
    do: %{"op" => "stat_compare", "attribute" => key, "at_least" => at_least}

  defp pool(key, at_least),
    do: %{"op" => "resource_compare", "resource" => key, "at_least" => at_least}

  # Breaks: an attribute dropped, renamed or given another start, or a leaf's short reference left
  # short (the loader would reject the artifact).
  test "attributes compile as authored and the leaves' short references expand", %{tmp_dir: dir} do
    {:ok, a, []} = compile(dir, %{"op" => "all", "items" => [stat("str", 14), pool("mv", 2)]})
    a = JSON.decode!(a)["cartridge"]

    assert a["attributes"] == %{
             "ashmere_road@0.0.1:attribute/con" => %{"key" => "con", "start" => 13},
             "ashmere_road@0.0.1:attribute/dex" => %{"key" => "dex", "start" => 12},
             "ashmere_road@0.0.1:attribute/int" => %{"key" => "int", "start" => 10},
             "ashmere_road@0.0.1:attribute/per" => %{"key" => "per", "start" => 11},
             "ashmere_road@0.0.1:attribute/spi" => %{"key" => "spi", "start" => 9},
             "ashmere_road@0.0.1:attribute/str" => %{"key" => "str", "start" => 14}
           }

    assert a["recipes"][@pray]["policy"]["root"]["items"] == [
             %{"op" => "stat_compare", "attribute" => ref("attribute", "str"), "at_least" => 14},
             %{"op" => "resource_compare", "resource" => ref("resource", "mv"), "at_least" => 2}
           ]
  end

  # Breaks: the attribute kind or a leaf accepted without its owner attributes@1, a leaf's
  # reference unchecked, or a schema bound of a leaf or of attributes.json lost, each compiling
  # what the loader rejects.
  test "unlocked, unresolved and malformed attributes and leaves", %{tmp_dir: dir} do
    root = "recipes/pray.policy.root"
    str = %{"str" => %{"start" => 14}}
    {s, u} = {"SCHEMA_VIOLATION", "UNKNOWN_FIELD"}

    undeclared =
      &d("UNDECLARED_CAPABILITY", &1, %{"capability" => "attributes"}, ["attributes@1"])

    unresolved =
      &d("UNRESOLVED_REFERENCE", "#{root}.#{&1}", %{"target" => "ashmere_road@0.0.1:#{&1}/#{&2}"})

    cases = [
      pool_unlocked: {pool("mv", 2), false, nil, [undeclared.("#{root}.op")]},
      stat_unlocked:
        {stat("str", 14), false, str,
         [undeclared.("attributes.attributes.str"), undeclared.("#{root}.op")]},
      attribute_unlocked:
        {%{"op" => "all", "items" => []}, false, str, [undeclared.("attributes.attributes.str")]},
      luck: {stat("luck", 1), true, str, [unresolved.("attribute", "luck")]},
      stamina: {pool("stamina", 1), true, str, [unresolved.("resource", "stamina")]},
      over:
        {stat("str", 2_147_483_648), true, str,
         [d(s, "#{root}.at_least", %{"error" => "above_maximum"})]},
      missing:
        {Map.delete(pool("mv", 1), "at_least"), true, str,
         [d(s, "#{root}.at_least", %{"error" => "missing_property"})]},
      extra: {Map.put(stat("str", 1), "x", 1), true, str, [d(u, "#{root}.x", %{})]},
      authored_key:
        {stat("str", 1), true, %{"str" => %{"key" => "str", "start" => 14}},
         [d(u, "attributes.attributes.str.key", %{})]},
      start:
        {stat("str", 1), true, %{"str" => %{"start" => -2_147_483_649}},
         [d(s, "attributes.attributes.str.start", %{"error" => "below_minimum"})]}
    ]

    for {name, {p, lock, attributes, diags}} <- cases,
        do:
          assert(
            compile(Path.join(dir, "#{name}"), p, lock, attributes) == {:error, diags},
            "#{name}"
          )
  end

  # Breaks: a v1 source's resource_compare resolved against the default pools, which only a v2
  # artifact carries, so the compiler writes an artifact the loader rejects (refStage, any format).
  test "a v1 cartridge's resource_compare names no pool", %{tmp_dir: dir} do
    hello = "cartridges/ashmere_hello"
    File.cp_r!(hello, dir)
    m = JSON.decode!(File.read!(Path.join(hello, "cartridge.json")))
    m = put_in(m, ["requires", "capabilities", "attributes"], 1)
    File.write!(Path.join(dir, "cartridge.json"), JSON.encode!(m))
    policy = %{"policy_version" => 1, "root" => pool("hp", 1)}
    File.write!(Path.join(dir, "policies/village_arrived.json"), JSON.encode!(policy))
    target = %{"target" => "ashmere_hello@0.0.1:resource/hp"}
    path = "policies/village_arrived.root.resource"
    assert Loka.Content.compile(dir) == {:error, [d("UNRESOLVED_REFERENCE", path, target)]}
  end

  # Breaks: attributes.json's file schema loses additionalProperties false (resources.ex
  # file_schema), so a top-level key beside "attributes" (here an attribute written outside the
  # map) is silently dropped instead of rejected (c1-attributes review N-3).
  test "a key beside attributes in attributes.json is UNKNOWN_FIELD", %{tmp_dir: dir} do
    File.mkdir_p!(dir)
    file = %{"attributes" => %{"str" => %{"start" => 14}}, "dex" => %{"start" => 12}}
    File.write!(Path.join(dir, "attributes.json"), JSON.encode!(file))

    assert compile(dir, stat("str", 1), true, nil) ==
             {:error, [d("UNKNOWN_FIELD", "attributes.dex", %{})]}
  end
end
