defmodule Loka.Content do
  @moduledoc """
  Cartridge parsing, compiler and definition registry. Compile-time definitions, not runtime authority.

  Dependency rules: spec document 02 §1.

  R4 minimal source layout (PM decision, 14 §R4): a cartridge source is a directory holding
  `cartridge.json` (the CartridgeManifest object form), `facts.json` (`{"facts": {name:
  FactSpec without key}}`, a dotted name mapping to its snake_case key) and one file per
  definition, `policies/<key>.json` and `actions/<key>.json`, the frozen shape without `key`.
  R5 adds `rooms/<key>.json` (RoomDefinition without `key`), `text.json` (the TextCatalog)
  and an optional `entry` room in `cartridge.json`; a source with any of them compiles to
  loka-cartridge-v2. References are full DefinitionRef objects naming this cartridge. Other
  files are ignored, except that a `.json` file anywhere else is UNKNOWN_FIELD.
  """
  use Boundary, deps: [Loka.Core], exports: []

  alias Loka.Content.{Compiler, Source}
  alias Loka.Core.{Canonical, Contracts}

  @registry_path Path.expand("../../protocol/capability_registry.json", __DIR__)
  @external_resource @registry_path
  @registry @registry_path |> File.read!() |> JSON.decode!()

  @doc """
  Compiles the source directory into CartridgeArtifact bytes (one canonical JSON document),
  or returns its diagnostics in the order Diagnostic defines. Options: `:max_bytes`
  (default ArtifactSize's maximum) and `:registry`, the decoded capability registry the
  cartridge is checked against (default protocol/capability_registry.json).
  """
  @spec compile(Path.t(), keyword()) :: {:ok, binary()} | {:error, [map()]}
  def compile(dir, opts \\ []) do
    max_bytes = Keyword.get(opts, :max_bytes, Contracts.defs()["ArtifactSize"]["maximum"])
    {files, diags} = Source.load(dir)

    with {:ok, cartridge} <- compiled(files, diags, Keyword.get(opts, :registry, @registry)) do
      # Checked values encode: NESTING_TOO_DEEP guards the only limit they can reach.
      {:ok, bytes} = Canonical.encode(cartridge)
      hash = :crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower)
      {:ok, artifact} = Canonical.encode(%{"content_hash" => hash, "cartridge" => cartridge})

      if byte_size(artifact) <= max_bytes,
        do: {:ok, artifact},
        else: too_large(byte_size(artifact), max_bytes)
    end
  end

  defp compiled(files, diags, registry) do
    with {:error, ds} <- Compiler.compile(files, diags, registry), do: {:error, sorted(ds)}
  end

  defp too_large(bytes, max) do
    data = %{"bytes" => bytes, "maximum" => max}
    {:error, [Source.diag("ARTIFACT_TOO_LARGE", "", data)]}
  end

  # Diagnostic: by path, then code (UTF-8 bytes), then canonical encoding; no repeats.
  defp sorted(diags) do
    diags
    |> Enum.uniq()
    |> Enum.sort_by(fn d -> {d["path"], d["code"], elem(Canonical.encode(d), 1)} end)
  end
end
