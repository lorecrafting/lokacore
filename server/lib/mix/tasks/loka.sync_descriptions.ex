defmodule Mix.Tasks.Loka.SyncDescriptions do
  @moduledoc """
  Syncs description fields (long_desc, keywords, mood) from prototypes to existing entities.

  This is useful after updating prototype YAML files with new description values.
  It will update any entity that has a matching prototype key.

  ## Usage

      mix loka.sync_descriptions

  Options:
    --dry-run  Show what would be updated without making changes
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  alias Loka.Engine.Entities
  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

  @shortdoc "Sync description fields from prototypes to entities"

  @impl Mix.Task
  def run(args) do
    dry_run = "--dry-run" in args

    # Start the application to get access to Repo and TypedObjectLoader
    Mix.Task.run("app.start")

    if dry_run do
      Mix.shell().info("DRY RUN - No changes will be made\n")
    end

    # Get all prototypes
    prototypes = TypedObjectLoader.all()

    Mix.shell().info("Found #{length(prototypes)} prototypes\n")

    # For each prototype, find matching entities and check for updates
    updates =
      prototypes
      |> Enum.flat_map(fn proto ->
        case find_entities_by_prototype_key(proto.key) do
          [] ->
            []

          entities ->
            Enum.map(entities, fn entity ->
              {entity, proto, compute_changes(entity, proto)}
            end)
        end
      end)
      |> Enum.filter(fn {_entity, _proto, changes} ->
        # Only include if there are actual changes
        map_size(changes) > 0
      end)

    if length(updates) == 0 do
      Mix.shell().info("No entities need updating.")
    else
      Mix.shell().info("Found #{length(updates)} entities to update:\n")

      Enum.each(updates, fn {entity, _proto, changes} ->
        Mix.shell().info("  #{entity.key}:")

        Enum.each(changes, fn {field, {old, new}} ->
          Mix.shell().info("    #{field}: #{inspect(old)} → #{inspect(new)}")
        end)

        unless dry_run do
          update_attrs = Map.new(changes, fn {field, {_old, new}} -> {field, new} end)

          case Entities.update_entity(entity, update_attrs) do
            {:ok, _updated} ->
              Mix.shell().info("    ✓ Updated\n")

            {:error, changeset} ->
              Mix.shell().error("    ✗ Failed: #{inspect(changeset.errors)}\n")
          end
        else
          Mix.shell().info("")
        end
      end)

      if dry_run do
        Mix.shell().info("\nRun without --dry-run to apply changes.")
      else
        Mix.shell().info("\n✓ Done! Updated #{length(updates)} entities.")
      end
    end
  end

  # Compute which fields need updating
  defp compute_changes(entity, proto) do
    changes = %{}

    changes =
      if proto.description && proto.description != "" && entity.long_desc != proto.description do
        Map.put(changes, :long_desc, {entity.long_desc, proto.description})
      else
        changes
      end

    changes =
      if proto.keywords && proto.keywords != [] && entity.keywords != proto.keywords do
        Map.put(changes, :keywords, {entity.keywords, proto.keywords})
      else
        changes
      end

    changes =
      if proto.mood && proto.mood != "" && entity.mood != proto.mood do
        Map.put(changes, :mood, {entity.mood, proto.mood})
      else
        changes
      end

    changes
  end

  # Find entities whose key starts with the prototype key
  # (entities have unique suffixes like "novice_pema_f905a83e")
  defp find_entities_by_prototype_key(proto_key) do
    Entities.list_entities()
    |> Enum.filter(fn entity ->
      String.starts_with?(entity.key, proto_key <> "_") or entity.key == proto_key
    end)
  end
end
