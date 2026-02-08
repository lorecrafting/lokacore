# Elixir Resilient Content Loader Pattern

## Trigger
- Content not loading at runtime despite files existing
- Validation reports "0 quests" or "0 objects" when files clearly exist
- Single bad file causes entire content system to fail
- Error messages about missing content that exists on disk

## Problem

Content loaders that fail-fast on any parse error can cause cascading failures:

```elixir
# ❌ BRITTLE - One bad file breaks everything
defp do_load_all_paths(state, paths) do
  {raw_objects, parse_errors} = parse_yaml_files(yaml_files)

  if Enum.any?(parse_errors) do
    {:error, parse_errors}  # Returns error, loads NOTHING
  else
    # ... load objects
  end
end
```

With this pattern, a single test file with invalid data (e.g., `invalid_type.yml`) prevents ALL valid content from loading.

## Solution

Make loaders resilient - log errors but continue loading valid content:

```elixir
# ✅ RESILIENT - Bad files logged, valid files loaded
defp do_load_all_paths(state, paths) do
  {raw_objects, parse_errors} = parse_yaml_files(yaml_files)

  # Log errors but continue with valid objects
  if Enum.any?(parse_errors) do
    Logger.warning(
      "ContentLoader: #{length(parse_errors)} files had errors: #{inspect(parse_errors)}"
    )
  end

  # Resolve and load valid objects
  case resolve_all_parents(raw_objects) do
    {:ok, resolved} ->
      Registry.clear()
      Registry.put_all(resolved)
      Logger.info("ContentLoader loaded #{map_size(resolved)} objects")
      {:ok, %{state | raw_objects: raw_objects, load_errors: parse_errors}}

    {:error, errors} ->
      {:error, errors}
  end
end
```

## Key Principles

1. **Log warnings, don't fail** - Invalid files should be visible but not blocking
2. **Track errors in state** - Store `load_errors` for later inspection/reporting
3. **Log success count** - Makes it obvious when loading works vs. fails silently
4. **Match TypedObject.Loader behavior** - Consistency across content systems

## When This Pattern Applies

- YAML content loaders (prototypes, quests, dialogues, scripts)
- Configuration file loading
- Plugin/module discovery systems
- Any system where partial success is better than total failure

## Debugging Checklist

When content isn't loading:

1. Check loader logs for "loaded X objects" message
2. Look for warning messages about parse errors
3. Search for test files with invalid data in content directories
4. Verify `load_errors` state if available

## Related Files

- `lib/loka/engine/typed_object/loader.ex` - Fixed in this pattern
- `lib/loka/engine/prototype_loader.ex` - Reference implementation

## Verification

After implementing resilient loading:
- Run `mix test test/integration/storyline_channel_test.exs` - Should pass
- Check logs for "TypedObject.Loader loaded N objects" where N > 0
