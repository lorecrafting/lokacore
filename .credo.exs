# Complexity limits only; style checks stay off. `mix credo --strict`.
%{
  configs: [
    %{
      name: "default",
      files: %{included: ["lib/", "bin/", "test/"]},
      checks: %{
        enabled: [
          {Credo.Check.Refactor.CyclomaticComplexity, max_complexity: 9},
          {Credo.Check.Refactor.Nesting, max_nesting: 2},
          {Credo.Check.Refactor.ABCSize, max_size: 30},
          {Credo.Check.Refactor.FunctionArity, max_arity: 6}
        ]
      }
    }
  ]
}
