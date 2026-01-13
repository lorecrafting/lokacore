defmodule Loka.WorldBuilder.LLM.StylePresets do
  @moduledoc """
  Style presets for LLM content generation.

  Provides pre-configured tone/style guidelines that inject into system prompts.

  ## Available Presets

  - `medieval_fantasy` - Classic sword-and-sorcery with castles, knights, and magic
  - `cyberpunk` - High-tech dystopia with neon, hackers, and megacorporations
  - `cosmic_horror` - Lovecraftian dread with unknowable entities
  - `lighthearted` - Whimsical and cheerful with playful tone

  ## Usage

      {:ok, prompt} = StylePresets.apply_preset(base_prompt, "medieval_fantasy")

      # List available presets
      presets = StylePresets.list_presets()
  """

  @presets %{
    "medieval_fantasy" => %{
      name: "Medieval Fantasy",
      description: "Classic sword-and-sorcery with castles, knights, and magic",
      guidelines: """
      Style: Medieval Fantasy

      - Use archaic language sparingly (thee, thou, forsooth - only for flavor)
      - Focus on stone architecture, torches, tapestries
      - Describe medieval weaponry and armor
      - Include fantasy elements: magic, mythical creatures, ancient ruins
      - Tone: Epic, adventurous, with hints of mystery
      - Sensory details: Smell of smoke, sound of clashing steel, cold stone walls
      """
    },
    "cyberpunk" => %{
      name: "Cyberpunk",
      description: "High-tech dystopia with neon, hackers, and megacorporations",
      guidelines: """
      Style: Cyberpunk

      - Neon lighting, holographic displays, digital interfaces
      - Gritty urban environments: rain-slicked streets, towering arcologies
      - Technology: Neural implants, data jacks, AR overlays
      - Atmosphere: Noir-influenced, morally gray, corporate oppression
      - Language: Tech jargon, slang, abbreviations (corp, netrunner, chrome)
      - Sensory: Smell of ozone, buzz of electronics, distant sirens
      """
    },
    "cosmic_horror" => %{
      name: "Cosmic Horror",
      description: "Lovecraftian dread with unknowable entities and sanity loss",
      guidelines: """
      Style: Cosmic Horror

      - Emphasize the unknowable and incomprehensible
      - Describe geometries that don't make sense
      - Use unsettling details: wrong colors, strange sounds, impossible angles
      - Build dread through implication, not explicit description
      - Language: Academic, antiquated, slightly stilted
      - Avoid gore; focus on psychological unease
      - Themes: Forbidden knowledge, insignificance of humanity, elder beings
      """
    },
    "lighthearted" => %{
      name: "Lighthearted",
      description: "Whimsical and cheerful with playful tone",
      guidelines: """
      Style: Lighthearted

      - Bright, colorful descriptions
      - Friendly NPCs with quirky personalities
      - Humorous details and wordplay
      - Avoid darkness, violence, or serious themes
      - Tone: Optimistic, playful, welcoming
      - Setting: Vibrant markets, cozy taverns, sunny meadows
      - Language: Casual, accessible, warm
      """
    }
  }

  @doc """
  Lists all available style presets.

  ## Returns

  List of preset info maps with keys: :key, :name, :description
  """
  @spec list_presets() :: [map()]
  def list_presets do
    @presets
    |> Enum.map(fn {key, preset} ->
      %{key: key, name: preset.name, description: preset.description}
    end)
  end

  @doc """
  Gets a specific preset by key.

  ## Returns

    * `{:ok, preset}` - Preset map with :name, :description, :guidelines
    * `{:error, :not_found}` - Preset key doesn't exist
  """
  @spec get_preset(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_preset(key) do
    case Map.get(@presets, key) do
      nil -> {:error, :not_found}
      preset -> {:ok, preset}
    end
  end

  @doc """
  Applies a style preset to a system prompt.

  ## Parameters

    * `system_prompt` - Base system prompt to enhance
    * `preset_key` - Key of the preset to apply

  ## Returns

    * `{:ok, enhanced_prompt}` - Prompt with style guidelines appended
    * `{:error, :preset_not_found}` - Invalid preset key

  ## Example

      {:ok, prompt} = apply_preset("You are a world builder.", "medieval_fantasy")
  """
  @spec apply_preset(String.t(), String.t()) :: {:ok, String.t()} | {:error, :preset_not_found}
  def apply_preset(system_prompt, preset_key) do
    case get_preset(preset_key) do
      {:ok, preset} ->
        enhanced_prompt = """
        #{system_prompt}

        #{preset.guidelines}
        """

        {:ok, enhanced_prompt}

      {:error, :not_found} ->
        {:error, :preset_not_found}
    end
  end

  @doc """
  Applies a style preset to a system prompt, returning the original on error.

  This is a convenience function that falls back to the original prompt
  if the preset is not found. Use `apply_preset/2` if you need to handle
  errors explicitly.

  ## Parameters

    * `system_prompt` - Base system prompt
    * `preset_key` - Key of the preset to apply

  ## Returns

  Enhanced prompt string, or original prompt if preset not found.
  """
  @spec apply_preset!(String.t(), String.t()) :: String.t()
  def apply_preset!(system_prompt, preset_key) do
    case apply_preset(system_prompt, preset_key) do
      {:ok, enhanced} -> enhanced
      {:error, _} -> system_prompt
    end
  end

  @doc """
  Checks if a preset key is valid.

  ## Returns

    * `true` - Preset exists
    * `false` - Preset doesn't exist
  """
  @spec valid_preset?(String.t()) :: boolean()
  def valid_preset?(key) do
    Map.has_key?(@presets, key)
  end

  @doc """
  Save custom user preset (stored in DB).

  NOT YET IMPLEMENTED: Custom preset persistence requires Ecto schema
  and database migration.

  ## Returns

    * `{:error, :not_implemented}` - Feature not yet available
  """
  @spec save_custom_preset(term(), String.t(), String.t()) :: {:error, :not_implemented}
  def save_custom_preset(_user_id, _name, _guidelines) do
    {:error, :not_implemented}
  end
end
