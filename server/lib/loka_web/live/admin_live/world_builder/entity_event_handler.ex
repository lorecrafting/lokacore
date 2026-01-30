defmodule LokaWeb.AdminLive.WorldBuilder.EntityEventHandler do
  @moduledoc """
  Event handlers for NPC and Item CRUD operations in World Builder.

  Extracted from WorldBuilderLive to reduce file size and improve maintainability.
  Handles create, update, and delete operations for NPCs and Items.
  """

  import Phoenix.Component, only: [assign: 3]
  require Logger

  alias Loka.WorldBuilder.EntityManager
  alias Loka.Admin.Audit
  alias LokaWeb.AdminLive.WorldBuilder.InputValidator
  alias LokaWeb.AdminLive.WorldBuilder.Helpers

  # =============================================================================
  # NPC Event Handlers
  # =============================================================================

  def handle_event("create_npc", params, socket) do
    # Auto-generate key from name if not provided
    key =
      case params["key"] do
        nil -> Helpers.slugify(params["name"])
        "" -> Helpers.slugify(params["name"])
        k -> k
      end

    # Validate name and description (key is now auto-generated if empty)
    with {:ok, _} <- InputValidator.validate_key(key),
         {:ok, _} <- InputValidator.validate_name(params["name"] || ""),
         {:ok, _} <- InputValidator.validate_description(params["description"]) do
      attrs = %{
        key: key,
        name: params["name"],
        description: params["description"] || "",
        level: Helpers.parse_integer(params["level"], 1)
      }

      case EntityManager.create_entity(:npc, attrs) do
        {:ok, npc} ->
          {:noreply,
           socket
           |> assign(:npcs, EntityManager.list_entities(:npc))
           |> assign(:show_npc_editor, false)
           |> Helpers.log_console(:info, "Created NPC: #{npc.name}")
           |> Audit.log(:create, :npc, npc.key, nil, npc)}

        {:error, reason} ->
          {:noreply,
           Helpers.log_console(
             socket,
             :error,
             "Failed to create NPC: #{Helpers.sanitize_error(reason, "")}"
           )}
      end
    else
      {:error, msg} ->
        {:noreply, Helpers.log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("delete_npc", params, socket) do
    npc_key = params["id"] || params["key"]
    npc = Enum.find(socket.assigns.npcs, fn n -> n.key == npc_key end)
    npc_name = if npc, do: npc[:name] || npc.key, else: npc_key

    confirm_modal = %{
      title: "Delete NPC",
      message: "Are you sure you want to delete \"#{npc_name}\"?",
      warning: "This can be undone with Ctrl+Z",
      confirm_text: "Delete",
      danger: true,
      action: "delete_npc",
      data: %{"id" => nil, "key" => npc_key, "type" => nil}
    }

    {:noreply, assign(socket, :confirm_modal, confirm_modal)}
  end

  def handle_event("delete_npc_confirmed", %{"key" => npc_key}, socket) do
    # Get NPC before deletion for audit log
    npc_before = Enum.find(socket.assigns.npcs, fn n -> n.key == npc_key end)

    case EntityManager.delete_entity(npc_key) do
      :ok ->
        {:noreply,
         socket
         |> assign(:npcs, EntityManager.list_entities(:npc))
         |> assign(:selected_entity, nil)
         |> Helpers.log_console(:info, "Deleted NPC: #{npc_key}")
         |> Audit.log(:delete, :npc, npc_key, npc_before, nil)}

      {:error, reason} ->
        {:noreply,
         Helpers.log_console(
           socket,
           :error,
           "Failed to delete NPC: #{Helpers.sanitize_error(reason, "")}"
         )}
    end
  end

  def handle_event("update_npc_field", params, socket) do
    npc_key = params["npc_key"]
    # Remove npc_key from params to get only the update fields
    updates =
      params
      |> Map.drop(["npc_key", "_target"])
      |> Enum.into(%{}, fn {k, v} ->
        case k do
          "level" -> {:level, Helpers.parse_integer(v, 1)}
          _ -> {String.to_atom(k), v}
        end
      end)

    case EntityManager.update_entity(npc_key, updates) do
      {:ok, _npc} ->
        {:noreply,
         socket
         |> assign(:npcs, EntityManager.list_entities(:npc))}

      {:error, reason} ->
        {:noreply,
         Helpers.log_console(
           socket,
           :error,
           "Failed to update NPC: #{Helpers.sanitize_error(reason, "")}"
         )}
    end
  end

  # =============================================================================
  # Item Event Handlers
  # =============================================================================

  def handle_event("create_item", params, socket) do
    # Auto-generate key from name if not provided
    key =
      case params["key"] do
        nil -> Helpers.slugify(params["name"])
        "" -> Helpers.slugify(params["name"])
        k -> k
      end

    # Validate name and description (key is now auto-generated if empty)
    with {:ok, _} <- InputValidator.validate_key(key),
         {:ok, _} <- InputValidator.validate_name(params["name"] || ""),
         {:ok, _} <- InputValidator.validate_description(params["description"]) do
      attrs = %{
        key: key,
        name: params["name"],
        description: params["description"] || "",
        item_type: params["item_type"] || "misc"
      }

      case EntityManager.create_entity(:item, attrs) do
        {:ok, item} ->
          {:noreply,
           socket
           |> assign(:items, EntityManager.list_entities(:item))
           |> assign(:show_item_editor, false)
           |> Helpers.log_console(:info, "Created Item: #{item.name}")
           |> Audit.log(:create, :item, item.key, nil, item)}

        {:error, reason} ->
          {:noreply,
           Helpers.log_console(
             socket,
             :error,
             "Failed to create item: #{Helpers.sanitize_error(reason, "")}"
           )}
      end
    else
      {:error, msg} ->
        {:noreply, Helpers.log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("delete_item", params, socket) do
    item_key = params["id"] || params["key"]
    item = Enum.find(socket.assigns.items, fn i -> i.key == item_key end)
    item_name = if item, do: item[:name] || item.key, else: item_key

    confirm_modal = %{
      title: "Delete Item",
      message: "Are you sure you want to delete \"#{item_name}\"?",
      warning: "This can be undone with Ctrl+Z",
      confirm_text: "Delete",
      danger: true,
      action: "delete_item",
      data: %{"id" => nil, "key" => item_key, "type" => nil}
    }

    {:noreply, assign(socket, :confirm_modal, confirm_modal)}
  end

  def handle_event("delete_item_confirmed", %{"key" => item_key}, socket) do
    # Get item before deletion for audit log
    item_before = Enum.find(socket.assigns.items, fn i -> i.key == item_key end)

    case EntityManager.delete_entity(item_key) do
      :ok ->
        {:noreply,
         socket
         |> assign(:items, EntityManager.list_entities(:item))
         |> assign(:selected_entity, nil)
         |> Helpers.log_console(:info, "Deleted Item: #{item_key}")
         |> Audit.log(:delete, :item, item_key, item_before, nil)}

      {:error, reason} ->
        {:noreply,
         Helpers.log_console(
           socket,
           :error,
           "Failed to delete item: #{Helpers.sanitize_error(reason, "")}"
         )}
    end
  end

  def handle_event("update_item_field", params, socket) do
    item_key = params["item_key"]
    # Remove item_key from params to get only the update fields
    updates =
      params
      |> Map.drop(["item_key", "_target"])
      |> Enum.into(%{}, fn {k, v} -> {String.to_atom(k), v} end)

    case EntityManager.update_entity(item_key, updates) do
      {:ok, _item} ->
        {:noreply,
         socket
         |> assign(:items, EntityManager.list_entities(:item))}

      {:error, reason} ->
        {:noreply,
         Helpers.log_console(
           socket,
           :error,
           "Failed to update Item: #{Helpers.sanitize_error(reason, "")}"
         )}
    end
  end
end
