defmodule Loka.Engine.SocialSubstitutionTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.SocialSubstitution

  describe "substitute/3" do
    test "replaces {actor} with actor name" do
      actor = %{short_desc: "Alice"}
      result = SocialSubstitution.substitute("{actor} smiles.", actor, nil)
      assert result == "Alice smiles."
    end

    test "replaces {target} with target name" do
      actor = %{short_desc: "Alice"}
      target = %{short_desc: "Bob"}
      result = SocialSubstitution.substitute("You wave at {target}.", actor, target)
      assert result == "You wave at Bob."
    end

    test "replaces both actor and target" do
      actor = %{short_desc: "Alice"}
      target = %{short_desc: "Bob"}
      result = SocialSubstitution.substitute("{actor} hugs {target}.", actor, target)
      assert result == "Alice hugs Bob."
    end

    test "capitalizes first letter of result" do
      actor = %{short_desc: "alice"}
      result = SocialSubstitution.substitute("{actor} smiles.", actor, nil)
      assert result == "Alice smiles."
    end

    test "handles nil target gracefully" do
      actor = %{short_desc: "Alice"}
      result = SocialSubstitution.substitute("{actor} waves at {target}.", actor, nil)
      assert result == "Alice waves at someone."
    end
  end

  describe "pronoun/2" do
    test "returns male subjective pronoun" do
      entity = %{components: %{gender: :male}}
      assert SocialSubstitution.pronoun(entity, :subjective) == "he"
    end

    test "returns male objective pronoun" do
      entity = %{components: %{gender: :male}}
      assert SocialSubstitution.pronoun(entity, :objective) == "him"
    end

    test "returns male possessive pronoun" do
      entity = %{components: %{gender: :male}}
      assert SocialSubstitution.pronoun(entity, :possessive) == "his"
    end

    test "returns female subjective pronoun" do
      entity = %{components: %{gender: :female}}
      assert SocialSubstitution.pronoun(entity, :subjective) == "she"
    end

    test "returns female objective pronoun" do
      entity = %{components: %{gender: :female}}
      assert SocialSubstitution.pronoun(entity, :objective) == "her"
    end

    test "returns female possessive pronoun" do
      entity = %{components: %{gender: :female}}
      assert SocialSubstitution.pronoun(entity, :possessive) == "her"
    end

    test "returns neutral subjective pronoun" do
      entity = %{components: %{gender: :neutral}}
      assert SocialSubstitution.pronoun(entity, :subjective) == "they"
    end

    test "returns neutral objective pronoun" do
      entity = %{components: %{gender: :neutral}}
      assert SocialSubstitution.pronoun(entity, :objective) == "them"
    end

    test "returns neutral possessive pronoun" do
      entity = %{components: %{gender: :neutral}}
      assert SocialSubstitution.pronoun(entity, :possessive) == "their"
    end

    test "defaults to neutral for nil entity" do
      assert SocialSubstitution.pronoun(nil, :subjective) == "they"
    end

    test "defaults to neutral when no gender component" do
      entity = %{components: %{}}
      assert SocialSubstitution.pronoun(entity, :subjective) == "they"
    end
  end

  describe "self_pronoun/1" do
    test "returns himself for male" do
      entity = %{components: %{gender: :male}}
      assert SocialSubstitution.self_pronoun(entity) == "himself"
    end

    test "returns herself for female" do
      entity = %{components: %{gender: :female}}
      assert SocialSubstitution.self_pronoun(entity) == "herself"
    end

    test "returns themself for neutral" do
      entity = %{components: %{gender: :neutral}}
      assert SocialSubstitution.self_pronoun(entity) == "themself"
    end

    test "returns themself for nil" do
      assert SocialSubstitution.self_pronoun(nil) == "themself"
    end
  end

  describe "get_name/1" do
    test "returns short_desc when available" do
      entity = %{short_desc: "the guard"}
      assert SocialSubstitution.get_name(entity) == "the guard"
    end

    test "returns character_name when short_desc missing" do
      entity = %{character_name: "Sir Bob"}
      assert SocialSubstitution.get_name(entity) == "Sir Bob"
    end

    test "returns name field as fallback" do
      entity = %{name: "Merchant"}
      assert SocialSubstitution.get_name(entity) == "Merchant"
    end

    test "returns 'someone' for nil" do
      assert SocialSubstitution.get_name(nil) == "someone"
    end

    test "returns 'someone' for empty map" do
      assert SocialSubstitution.get_name(%{}) == "someone"
    end
  end

  describe "pronoun substitution in templates" do
    test "substitutes actor pronouns" do
      actor = %{short_desc: "Alice", components: %{gender: :female}}
      template = "{actor} waves {actor_possessive} hand."
      result = SocialSubstitution.substitute(template, actor, nil)
      assert result == "Alice waves her hand."
    end

    test "substitutes target pronouns" do
      actor = %{short_desc: "Alice", components: %{gender: :female}}
      target = %{short_desc: "Bob", components: %{gender: :male}}
      template = "{actor} hugs {target_objective}."
      result = SocialSubstitution.substitute(template, actor, target)
      assert result == "Alice hugs him."
    end

    test "substitutes self_pronoun" do
      actor = %{short_desc: "Alice", components: %{gender: :female}}
      template = "{actor} smiles to {self_pronoun}."
      result = SocialSubstitution.substitute(template, actor, nil)
      assert result == "Alice smiles to herself."
    end
  end
end
