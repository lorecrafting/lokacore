defmodule Exmud.Ecto.TermTest do
  use ExUnit.Case, async: true

  alias Exmud.Ecto.Term

  describe "type/0" do
    test "returns :binary" do
      assert Term.type() == :binary
    end
  end

  describe "cast/1" do
    test "casts any term" do
      assert {:ok, "string"} = Term.cast("string")
      assert {:ok, 123} = Term.cast(123)
      assert {:ok, [1, 2, 3]} = Term.cast([1, 2, 3])
      assert {:ok, %{a: 1}} = Term.cast(%{a: 1})
      assert {:ok, {:tuple, "value"}} = Term.cast({:tuple, "value"})
    end
  end

  describe "load/1" do
    test "loads nil as nil" do
      assert {:ok, nil} = Term.load(nil)
    end

    test "loads binary to term" do
      binary = :erlang.term_to_binary(%{foo: "bar", nums: [1, 2, 3]})
      assert {:ok, %{foo: "bar", nums: [1, 2, 3]}} = Term.load(binary)
    end

    test "loads complex nested structures" do
      complex = %{
        name: "test",
        stats: %{health: 100, mana: 50},
        inventory: [%{id: 1, name: "sword"}, %{id: 2, name: "shield"}],
        flags: {:some, :tuple}
      }
      binary = :erlang.term_to_binary(complex)
      assert {:ok, ^complex} = Term.load(binary)
    end

    test "returns error for invalid binary" do
      assert :error = Term.load("not a valid erlang term binary")
    end
  end

  describe "dump/1" do
    test "dumps nil as nil" do
      assert {:ok, nil} = Term.dump(nil)
    end

    test "dumps term to binary" do
      term = %{foo: "bar"}
      {:ok, binary} = Term.dump(term)
      assert is_binary(binary)
      assert :erlang.binary_to_term(binary) == term
    end

    test "dumps complex nested structures" do
      complex = %{
        name: "test",
        stats: %{health: 100, mana: 50},
        inventory: [%{id: 1, name: "sword"}, %{id: 2, name: "shield"}],
        flags: {:some, :tuple}
      }
      {:ok, binary} = Term.dump(complex)
      assert :erlang.binary_to_term(binary) == complex
    end

    test "dumps lists" do
      list = [1, "two", :three, %{four: 4}]
      {:ok, binary} = Term.dump(list)
      assert :erlang.binary_to_term(binary) == list
    end

    test "dumps tuples" do
      tuple = {:ok, "result", 42}
      {:ok, binary} = Term.dump(tuple)
      assert :erlang.binary_to_term(binary) == tuple
    end
  end

  describe "equal?/2" do
    test "compares terms for equality" do
      assert Term.equal?(%{a: 1}, %{a: 1})
      refute Term.equal?(%{a: 1}, %{a: 2})
      assert Term.equal?([1, 2, 3], [1, 2, 3])
      refute Term.equal?([1, 2, 3], [1, 2])
    end
  end

  describe "round trip" do
    test "preserves data through dump and load" do
      terms = [
        "string",
        123,
        3.14,
        :atom,
        [1, 2, 3],
        %{key: "value"},
        {:tuple, 1, 2},
        %{nested: %{deeply: %{value: [1, 2, 3]}}}
      ]

      for term <- terms do
        {:ok, binary} = Term.dump(term)
        {:ok, loaded} = Term.load(binary)
        assert loaded == term, "Round trip failed for: #{inspect(term)}"
      end
    end
  end
end
