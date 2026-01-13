defmodule Loka.Engine.Script.ValidatorTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Script.Validator

  describe "validate/1" do
    test "accepts valid simple script" do
      source = """
      cond do
        quest_active?("main_quest") -> :handled
        true -> :default
      end
      """

      assert :ok = Validator.validate(source)
    end

    test "accepts valid script with conditionals" do
      source = """
      if has_flag?("spoke_to_elder") do
        say("Welcome back!")
        :handled
      else
        say("Hello, traveler!")
        set_flag("spoke_to_elder", true)
        :handled
      end
      """

      assert :ok = Validator.validate(source)
    end

    test "accepts script with Enum operations" do
      source = """
      items = ["sword", "shield", "potion"]
      any?(items, fn item -> has_item?(item) end)
      """

      assert :ok = Validator.validate(source)
    end

    test "accepts script with chance and roll" do
      source = """
      if chance?(50) do
        say("You got lucky!")
      end
      roll("2d6+3")
      """

      assert :ok = Validator.validate(source)
    end

    test "rejects script with System access" do
      source = "System.cmd(\"ls\", [\"-la\"])"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with File access" do
      source = "File.read(\"/etc/passwd\")"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with IO access" do
      source = "IO.puts(\"hack\")"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with Code module" do
      source = "Code.eval_string(\"1+1\")"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with Process manipulation" do
      source = "Process.exit(pid, :kill)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with spawn" do
      source = "spawn(fn -> :loop end)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with send" do
      source = "send(pid, :message)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with receive" do
      source = """
      receive do
        msg -> msg
      end
      """

      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with defmodule" do
      source = """
      defmodule Hack do
        def run, do: :hacked
      end
      """

      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with def" do
      source = """
      def my_function do
        :ok
      end
      """

      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with import" do
      source = "import File"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with require" do
      source = "require Logger"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with use" do
      source = "use GenServer"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with alias" do
      source = "alias Loka.Repo"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with __ENV__" do
      source = "__ENV__.module"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with pipe operator" do
      source = "\"test\" |> String.upcase()"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with erlang module call" do
      source = ":os.cmd(~c\"whoami\")"
      # May be caught by regex pattern or AST analysis
      result = Validator.validate(source)
      assert {:error, _reason} = result

      assert match?({:error, {:forbidden_pattern, _}}, result) or
               match?({:error, {:ast_error, _}}, result)
    end

    test "rejects script with apply" do
      source = "apply(System, :cmd, args)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with GenServer" do
      source = "GenServer.call(pid, :get)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with Task" do
      source = "Task.async(fn -> :ok end)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with Agent" do
      source = "Agent.start_link(fn -> 0 end)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with Repo" do
      source = "Repo.all(User)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script with Ecto" do
      source = "Ecto.Query.from(u in User)"
      assert {:error, {:forbidden_pattern, _}} = Validator.validate(source)
    end

    test "rejects script exceeding max length" do
      source = String.duplicate("x", 60_000)
      assert {:error, :script_too_long} = Validator.validate(source)
    end

    test "rejects script with syntax error" do
      source = "if true do"
      assert {:error, {:syntax_error, _}} = Validator.validate(source)
    end

    test "rejects non-string input" do
      assert {:error, :not_a_string} = Validator.validate(123)
      assert {:error, :not_a_string} = Validator.validate(nil)
    end
  end

  describe "valid_syntax?/1" do
    test "returns true for valid syntax" do
      assert Validator.valid_syntax?("1 + 1")
      assert Validator.valid_syntax?("if true, do: 1, else: 2")
      assert Validator.valid_syntax?("cond do\n  true -> :ok\nend")
    end

    test "returns false for invalid syntax" do
      refute Validator.valid_syntax?("if true do")
      refute Validator.valid_syntax?("def foo(")
      refute Validator.valid_syntax?("{:ok")
    end
  end

  describe "validate_with_details/1" do
    test "returns detailed error for forbidden pattern" do
      source = "System.cmd(\"test\", args)"

      assert {:error, %{type: :forbidden_pattern, message: msg}} =
               Validator.validate_with_details(source)

      assert String.contains?(msg, "forbidden pattern")
    end

    test "returns detailed error for syntax error" do
      source = "if true do"

      assert {:error, %{type: :syntax_error, message: msg, details: details}} =
               Validator.validate_with_details(source)

      assert String.contains?(msg, "Syntax error")
      assert is_map(details)
    end

    test "returns detailed error for length exceeded" do
      source = String.duplicate("x", 60_000)

      assert {:error, %{type: :length, details: %{length: len, max: max}}} =
               Validator.validate_with_details(source)

      assert len > max
    end
  end

  describe "forbidden_patterns/0" do
    test "returns list of regex patterns" do
      patterns = Validator.forbidden_patterns()
      assert is_list(patterns)
      assert Enum.all?(patterns, &is_struct(&1, Regex))
    end
  end

  describe "max_length/0" do
    test "returns maximum script length" do
      assert Validator.max_length() == 50_000
    end
  end
end
