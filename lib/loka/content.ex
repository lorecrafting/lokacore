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
  loka-cartridge-v2. R5 S4 adds `items/<key>.json` and `npcs/<key>.json` (ItemDefinition and
  NpcDefinition without `key`); R5 S5 `actions/<key>.json` without `command` (ActionRecipe without `key`); R5
  S6b `resources.json` (`Loka.Content.Resources`: overrides of the default pools every v2
  cartridge gets, and further resources). A reference is a full DefinitionRef object naming
  this cartridge, or short: the key alone, of the kind its field takes (owner decision
  2026-09-25, `Loka.Content.Checks.expand/2`). A definition may `extends` another of its kind,
  flattened before any stage reads it, and an area bundle `areas/<name>.json` may hold
  definitions of several kinds, and a text field may hold `{"prose": "<words>"}`, lowered to
  a generated text key (docs/system/cartridge.md, Source shortcuts). Other files are ignored, except that a `.json`
  file anywhere else is UNKNOWN_FIELD.
  """
  use Boundary, deps: [Loka.Core], exports: []

  alias Loka.Content.{Compiler, Source}
  alias Loka.Core.{Canonical, Contracts}

  @registry_path Path.expand("../../protocol/capability_registry.json", __DIR__)
  @external_resource @registry_path
  @registry @registry_path |> File.read!() |> JSON.decode!()

  @doc """
  Compiles the source directory into CartridgeArtifact bytes (one canonical JSON document)
  and its warnings (severity warning), or returns its diagnostics, each list in the order
  Diagnostic defines. Options: `:max_bytes`
  (default ArtifactSize's maximum) and `:registry`, the decoded capability registry the
  cartridge is checked against (default protocol/capability_registry.json).
  """
  @spec compile(Path.t(), keyword()) :: {:ok, binary(), [map()]} | {:error, [map()]}
  def compile(dir, opts \\ []) do
    max_bytes = Keyword.get(opts, :max_bytes, Contracts.defs()["ArtifactSize"]["maximum"])
    {files, diags} = Source.load(dir)

    with {:ok, cartridge, warnings} <-
           compiled(files, diags, Keyword.get(opts, :registry, @registry)) do
      artifact = artifact(cartridge)

      if byte_size(artifact) <= max_bytes,
        do: {:ok, artifact, warnings},
        else: too_large(byte_size(artifact), max_bytes)
    end
  end

  @doc "The author-time lint findings for a story cartridge source (Loka.Content.Lint)."
  @spec lint(Path.t()) :: [String.t()]
  defdelegate lint(dir), to: Loka.Content.Lint, as: :run

  @doc "The source JSON Schema files, name => text (Loka.Content.SourceSchema)."
  @spec source_schema() :: %{String.t() => binary()}
  defdelegate source_schema(), to: Loka.Content.SourceSchema, as: :files

  # Checked values encode: NESTING_TOO_DEEP guards the only limit they can reach.
  defp artifact(cartridge) do
    {:ok, bytes} = Canonical.encode(cartridge)
    hash = :crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower)
    {:ok, artifact} = Canonical.encode(%{"content_hash" => hash, "cartridge" => cartridge})
    artifact
  end

  defp compiled(files, diags, registry) do
    case Compiler.compile(files, diags, registry) do
      {:ok, cartridge, warnings} -> {:ok, cartridge, sorted(warnings)}
      {:error, ds} -> {:error, sorted(ds)}
    end
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
