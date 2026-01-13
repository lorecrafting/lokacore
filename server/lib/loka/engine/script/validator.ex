defmodule Loka.Engine.Script.Validator do
  @moduledoc """
  Static analysis to block dangerous patterns in builder scripts.

  Runs BEFORE script is saved, not at runtime. This provides early
  feedback to builders and prevents dangerous code from ever being stored.

  ## Security Model

  Scripts are sandboxed Elixir code that builders can write to customize
  game content. They have access to a restricted API but must not be able to:

  - Access the file system, network, or OS
  - Spawn processes or manipulate existing ones
  - Load arbitrary code dynamically
  - Access Elixir introspection features
  - Define modules or functions

  ## Validation Stages

  1. Length check - prevent resource exhaustion
  2. Forbidden pattern check - block dangerous constructs
  3. Syntax check - ensure valid Elixir
  4. AST analysis - deeper analysis of parsed code
  """

  @forbidden_patterns [
    # Module/code manipulation
    ~r/\bdefmodule\b/,
    ~r/\bdef\s+\w+/,
    ~r/\bdefp\s+\w+/,
    ~r/\bdefmacro\b/,
    ~r/\bdefmacrop\b/,
    ~r/\bdefstruct\b/,
    ~r/\bdefprotocol\b/,
    ~r/\bdefimpl\b/,
    ~r/\bdefdelegate\b/,
    ~r/\bdefexception\b/,
    ~r/\bdefguard\b/,
    ~r/\bdefguardp\b/,
    ~r/\bCode\./,
    ~r/\bMacro\./,
    ~r/\bKernel\.def/,

    # Import/require/use/alias (module loading)
    ~r/\bimport\s+/,
    ~r/\brequire\s+/,
    ~r/\buse\s+/,
    ~r/\balias\s+/,

    # System access
    ~r/\bSystem\./,
    ~r/\bFile\./,
    ~r/\bIO\./,
    ~r/\bPath\./,
    ~r/\bPort\./,
    ~r/\bStringIO\./,

    # Process manipulation
    ~r/\bspawn\b/,
    ~r/\bspawn_link\b/,
    ~r/\bspawn_monitor\b/,
    ~r/\bProcess\./,
    ~r/\bAgent\./,
    ~r/\bGenServer\./,
    ~r/\bTask\./,
    ~r/\bSupervisor\./,
    ~r/\bDynamicSupervisor\./,
    ~r/\bRegistry\./,
    ~r/\bGenStage\./,

    # Dangerous operations
    ~r/\bsend\s*\(/,
    ~r/\breceive\s+do\b/,
    ~r/\bapply\s*\(/,
    ~r/\bKernel\.apply/,
    ~r/\bFunction\.capture/,
    ~r/\b:erlang\./,
    ~r/\b:os\./,
    ~r/\b:file\./,
    ~r/\b:io\./,
    ~r/\b:code\./,
    ~r/\b:ets\./,
    ~r/\b:dets\./,
    ~r/\b:mnesia\./,
    ~r/\b:persistent_term\./,
    ~r/\b:atomics\./,
    ~r/\b:counters\./,

    # Network
    ~r/\b:httpc\./,
    ~r/\b:gen_tcp\./,
    ~r/\b:gen_udp\./,
    ~r/\b:ssl\./,
    ~r/\b:inet\./,
    ~r/\bHTTP/,
    ~r/\bFinch\./,
    ~r/\bReq\./,
    ~r/\bTesla\./,

    # Introspection (can bypass sandbox)
    ~r/\b__ENV__\b/,
    ~r/\b__MODULE__\b/,
    ~r/\b__CALLER__\b/,
    ~r/\b__DIR__\b/,
    ~r/\b__STACKTRACE__\b/,

    # Metaprogramming
    ~r/\bquote\s+do\b/,
    ~r/\bunquote\b/,
    ~r/\bunquote_splicing\b/,
    ~r/\bvar!\b/,
    ~r/\bbinding\b/,

    # Reflection
    ~r/\bModule\./,
    ~r/\bApplication\./,
    ~r/\bNode\./,
    ~r/\b:global\./,
    ~r/\b:pg\./,

    # Dangerous Kernel functions
    ~r/\bexit\s*\(/,
    ~r/\bthrow\s*\(/,
    ~r/\braise\s+/,
    ~r/\breraise\s*\(/,

    # Binary manipulation that could cause issues
    ~r/\b:binary\./,
    ~r/\b:zlib\./,

    # Ecto/Database (scripts should use action queue)
    ~r/\bRepo\./,
    ~r/\bEcto\./,

    # Pipe operator (can chain to bypass restrictions)
    ~r/\|>/
  ]

  @max_script_length 50_000

  @doc """
  Validates a script source before saving.

  Returns `:ok` if valid, `{:error, reason}` if invalid.

  ## Examples

      iex> Validator.validate("quest_active?(\\"main_quest\\")")
      :ok

      iex> Validator.validate("System.cmd(\\"rm\\", [\\"-rf\\", \\"/\\"])")
      {:error, {:forbidden_pattern, ~r/\\bSystem\\./}}
  """
  @spec validate(String.t()) :: :ok | {:error, term()}
  def validate(source) when is_binary(source) do
    with :ok <- check_length(source),
         :ok <- check_forbidden_patterns(source),
         :ok <- check_syntax(source),
         :ok <- check_ast(source) do
      :ok
    end
  end

  def validate(_), do: {:error, :not_a_string}

  @doc """
  Validates and returns detailed errors for UI display.
  """
  @spec validate_with_details(String.t()) ::
          :ok | {:error, %{type: atom(), message: String.t(), details: term()}}
  def validate_with_details(source) when is_binary(source) do
    case validate(source) do
      :ok ->
        :ok

      {:error, :script_too_long} ->
        {:error,
         %{
           type: :length,
           message: "Script exceeds maximum length of #{@max_script_length} characters",
           details: %{length: String.length(source), max: @max_script_length}
         }}

      {:error, {:forbidden_pattern, pattern}} ->
        {:error,
         %{
           type: :forbidden_pattern,
           message: "Script contains forbidden pattern: #{inspect(pattern)}",
           details: %{pattern: pattern}
         }}

      {:error, {:syntax_error, {line, message, token}}} ->
        # Handle both old string format and new keyword list format for message and token
        message_str = if is_list(message), do: inspect(message), else: to_string(message)
        token_str = if is_list(token), do: inspect(token), else: to_string(token)

        {:error,
         %{
           type: :syntax_error,
           message: "Syntax error on line #{line}: #{message_str}",
           details: %{line: line, message: message_str, token: token_str}
         }}

      {:error, {:ast_error, reason}} ->
        {:error,
         %{
           type: :ast_error,
           message: "Code analysis error: #{reason}",
           details: %{reason: reason}
         }}

      {:error, reason} ->
        {:error,
         %{
           type: :unknown,
           message: "Validation failed: #{inspect(reason)}",
           details: %{reason: reason}
         }}
    end
  end

  @doc """
  Checks if a script has valid syntax.
  """
  @spec valid_syntax?(String.t()) :: boolean()
  def valid_syntax?(source) when is_binary(source) do
    case Code.string_to_quoted(source) do
      {:ok, _ast} -> true
      {:error, _} -> false
    end
  end

  def valid_syntax?(_), do: false

  # Check script length
  defp check_length(source) do
    if String.length(source) <= @max_script_length do
      :ok
    else
      {:error, :script_too_long}
    end
  end

  # Check for forbidden patterns using regex
  defp check_forbidden_patterns(source) do
    case Enum.find(@forbidden_patterns, &Regex.match?(&1, source)) do
      nil -> :ok
      pattern -> {:error, {:forbidden_pattern, pattern}}
    end
  end

  # Check for valid Elixir syntax
  defp check_syntax(source) do
    case Code.string_to_quoted(source) do
      {:ok, _ast} ->
        :ok

      # Elixir 1.19+ format: {location_kw, error_kw, hint_string}
      {:error, {location, error_info, _hint}} when is_list(location) and is_list(error_info) ->
        line = Keyword.get(location, :line, 1)
        {:error, {:syntax_error, {line, error_info, ""}}}

      # Older format: {line, {message, token}, extra}
      {:error, {line, {message, token}, _}} when is_integer(line) ->
        {:error, {:syntax_error, {line, message, token}}}

      # Older format: {line, message, token}
      {:error, {line, message, token}} when is_integer(line) ->
        {:error, {:syntax_error, {line, message, token}}}

      # Catch-all for any other format
      {:error, error} ->
        {:error, {:syntax_error, {1, inspect(error), ""}}}
    end
  end

  # Deeper AST analysis for patterns that regex might miss
  defp check_ast(source) do
    case Code.string_to_quoted(source) do
      {:ok, ast} ->
        analyze_ast(ast)

      {:error, _} ->
        # Syntax error already caught above
        :ok
    end
  end

  # Walk the AST looking for dangerous patterns
  defp analyze_ast(ast) do
    try do
      Macro.postwalk(ast, :ok, fn
        # Block function captures that could bypass sandbox
        {:&, _, [{:/, _, [{{:., _, _}, _, _}, _]}]} = node, :ok ->
          {node, {:error, {:ast_error, "Function captures of external modules not allowed"}}}

        # Block remote calls to dangerous modules
        {{:., _, [{:__aliases__, _, module_parts}, _func]}, _, _args} = node, :ok ->
          module = Module.concat(module_parts)

          if dangerous_module?(module) do
            {node, {:error, {:ast_error, "Calls to #{module} not allowed"}}}
          else
            {node, :ok}
          end

        # Block Erlang module calls
        {{:., _, [erlang_module, _func]}, _, _args} = node, :ok when is_atom(erlang_module) ->
          if String.starts_with?(Atom.to_string(erlang_module), ":") or
               erlang_module in [:erlang, :os, :file, :io, :code, :ets, :dets, :mnesia] do
            {node, {:error, {:ast_error, "Calls to #{erlang_module} not allowed"}}}
          else
            {node, :ok}
          end

        # Allow anonymous functions (needed for Enum operations)
        {:fn, _, _} = node, acc ->
          {node, acc}

        # Detect attempts to call apply dynamically
        {:apply, _, [_m, _f, _a]} = node, :ok ->
          {node, {:error, {:ast_error, "Dynamic function application not allowed"}}}

        node, acc ->
          {node, acc}
      end)
      |> elem(1)
    rescue
      _ -> :ok
    end
  end

  # List of modules that scripts cannot call
  defp dangerous_module?(module) do
    dangerous_modules = [
      System,
      File,
      IO,
      Path,
      Port,
      StringIO,
      Code,
      Macro,
      Module,
      Process,
      Agent,
      GenServer,
      Task,
      Supervisor,
      DynamicSupervisor,
      Registry,
      Application,
      Node,
      Kernel,
      # Add Loka modules that shouldn't be directly called
      Loka.Repo,
      Loka.Engine.Scripting
    ]

    module in dangerous_modules or
      String.starts_with?(Atom.to_string(module), "Elixir.Ecto") or
      String.starts_with?(Atom.to_string(module), "Elixir.Phoenix")
  end

  @doc """
  Returns the list of forbidden patterns (for documentation/UI).
  """
  @spec forbidden_patterns() :: [Regex.t()]
  def forbidden_patterns, do: @forbidden_patterns

  @doc """
  Returns the maximum script length.
  """
  @spec max_length() :: non_neg_integer()
  def max_length, do: @max_script_length
end
