defmodule LokaWeb.AdminLive.WorldBuilder.DialogueEventHandler do
  @moduledoc """
  Event handlers for dialogue tree editing in World Builder.

  Extracted from WorldBuilderLive to reduce file size and improve maintainability.
  All dialogue_* events are delegated to this module.
  """

  import Phoenix.Component, only: [assign: 3]
  require Logger

  alias Loka.WorldBuilder.EntityManager
  alias LokaWeb.AdminLive.WorldBuilder.Helpers

  # =============================================================================
  # Public Event Handlers (called via delegate from WorldBuilderLive)
  # =============================================================================

  def handle_event("dialogue_update_entity", %{"npc_key" => npc_key}, socket) do
    npc_key = if npc_key == "", do: nil, else: npc_key

    # Load existing dialogue tree when NPC is selected
    existing_tree =
      if npc_key do
        npc = Enum.find(socket.assigns.npcs, fn n -> n.key == npc_key end)

        if npc do
          components = Map.get(npc, :components) || %{}
          Map.get(components, :dialogue_tree) || Map.get(components, "dialogue_tree") || %{}
        else
          %{}
        end
      else
        %{}
      end

    {:noreply,
     socket
     |> assign(:editing_dialogue_npc, npc_key)
     |> assign(:editing_dialogue_tree, existing_tree)
     |> assign(:dialogue_selected_node, nil)
     |> Helpers.log_console(:info, "Dialogue entity set to: #{npc_key || "none"}")}
  end

  def handle_event("dialogue_select_node", %{"key" => node_key}, socket) do
    {:noreply, assign(socket, :dialogue_selected_node, node_key)}
  end

  def handle_event("dialogue_toggle_preview", _params, socket) do
    {:noreply, assign(socket, :dialogue_preview_mode, !socket.assigns.dialogue_preview_mode)}
  end

  def handle_event("dialogue_preview_reset", _params, socket) do
    {:noreply,
     socket
     |> assign(:dialogue_selected_node, "start")
     |> assign(:dialogue_preview_mode, true)}
  end

  def handle_event("dialogue_preview_choice", %{"next" => next}, socket) do
    if next && next != "" do
      {:noreply, assign(socket, :dialogue_selected_node, next)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("dialogue_add_node", params, socket) do
    key = params["key"] || "node_#{:erlang.unique_integer([:positive])}"
    tree = socket.assigns.editing_dialogue_tree

    new_node = %{
      "text" => "Enter dialogue text...",
      "choices" => []
    }

    updated_tree = Map.put(tree, key, new_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> assign(:dialogue_selected_node, key)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_delete_node", %{"key" => node_key}, socket) do
    # Show confirmation modal
    confirm_modal = %{
      title: "Delete Dialogue Node",
      message: "Are you sure you want to delete the node \"#{node_key}\"?",
      warning: "Choices pointing to this node will break.",
      confirm_text: "Delete Node",
      danger: true,
      action: "dialogue_delete_node_confirmed",
      data: %{"key" => node_key}
    }

    {:noreply, assign(socket, :confirm_modal, confirm_modal)}
  end

  def handle_event("dialogue_delete_node_confirmed", %{"key" => node_key}, socket) do
    tree = socket.assigns.editing_dialogue_tree
    updated_tree = Map.delete(tree, node_key)

    selected =
      if socket.assigns.dialogue_selected_node == node_key do
        nil
      else
        socket.assigns.dialogue_selected_node
      end

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> assign(:dialogue_selected_node, selected)
     |> assign(:confirm_modal, nil)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_update_node", params, socket) do
    node_key = params["node_key"]
    tree = socket.assigns.editing_dialogue_tree
    node = tree[node_key] || %{}

    # Update basic fields
    updated_node =
      node
      |> maybe_update("text", params["text"])
      |> maybe_update("speaker", params["speaker"])

    # Update choices from form params
    updated_node = update_node_choices(updated_node, params)

    updated_tree = Map.put(tree, node_key, updated_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_add_choice", %{"node_key" => node_key}, socket) do
    tree = socket.assigns.editing_dialogue_tree
    node = tree[node_key] || %{}
    choices = Map.get(node, "choices", [])

    new_choice = %{
      "text" => "Response option...",
      "next" => nil
    }

    updated_node = Map.put(node, "choices", choices ++ [new_choice])
    updated_tree = Map.put(tree, node_key, updated_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_delete_choice", %{"node_key" => node_key, "index" => index}, socket) do
    index = String.to_integer(index)
    tree = socket.assigns.editing_dialogue_tree
    node = tree[node_key] || %{}
    choices = Map.get(node, "choices", [])

    updated_choices = List.delete_at(choices, index)
    updated_node = Map.put(node, "choices", updated_choices)
    updated_tree = Map.put(tree, node_key, updated_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> save_dialogue_tree(updated_tree)}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp maybe_update(map, _key, nil), do: map
  defp maybe_update(map, key, value), do: Map.put(map, key, value)

  defp update_node_choices(node, params) do
    choices = Map.get(node, "choices", [])

    # Group choice params by index
    choice_params =
      params
      |> Enum.filter(fn {k, _v} -> String.starts_with?(k, "choice_") end)
      |> Enum.group_by(fn {k, _v} ->
        # Extract index from "choice_0_text" -> 0
        case Regex.run(~r/choice_(\d+)_/, k) do
          [_, idx] -> String.to_integer(idx)
          _ -> -1
        end
      end)
      |> Map.delete(-1)

    updated_choices =
      Enum.with_index(choices)
      |> Enum.map(fn {choice, index} ->
        choice_updates = Map.get(choice_params, index, [])

        choice
        |> update_choice_field(choice_updates, index, "text")
        |> update_choice_field(choice_updates, index, "next")
        |> update_choice_condition(choice_updates, index)
        |> update_choice_action(choice_updates, index)
      end)

    Map.put(node, "choices", updated_choices)
  end

  defp update_choice_field(choice, updates, index, field) do
    key = "choice_#{index}_#{field}"

    case Enum.find(updates, fn {k, _v} -> k == key end) do
      {_, ""} when field == "next" -> Map.put(choice, field, nil)
      {_, value} -> Map.put(choice, field, value)
      nil -> choice
    end
  end

  defp update_choice_condition(choice, updates, index) do
    type_key = "choice_#{index}_condition_type"
    value_key = "choice_#{index}_condition_value"

    type = get_param_value(updates, type_key)
    value = get_param_value(updates, value_key)

    if type && type != "" && value && value != "" do
      Map.put(choice, "show_if", %{type => value})
    else
      Map.delete(choice, "show_if")
    end
  end

  defp update_choice_action(choice, updates, index) do
    type_key = "choice_#{index}_action_type"
    value_key = "choice_#{index}_action_value"

    type = get_param_value(updates, type_key)
    value = get_param_value(updates, value_key)

    if type && type != "" && value && value != "" do
      Map.put(choice, "action", [type, value])
    else
      Map.delete(choice, "action")
    end
  end

  defp get_param_value(updates, key) do
    case Enum.find(updates, fn {k, _} -> k == key end) do
      {_, value} -> value
      nil -> nil
    end
  end

  defp save_dialogue_tree(socket, tree) do
    npc_key = socket.assigns.editing_dialogue_npc

    if npc_key do
      # Find NPC and update its dialogue tree
      npcs = socket.assigns.npcs
      npc = Enum.find(npcs, fn n -> n.key == npc_key end)

      if npc do
        # Update NPC's dialogue tree component
        components = Map.get(npc, :components) || %{}
        updated_components = Map.put(components, :dialogue_tree, tree)

        case EntityManager.update_entity(npc.id, %{components: updated_components}) do
          {:ok, _updated_npc} ->
            updated_npcs = EntityManager.list_entities(:npc)

            socket
            |> assign(:npcs, updated_npcs)
            |> Helpers.log_console(:info, "Dialogue saved for #{npc_key}")

          {:error, _reason} ->
            Helpers.log_console(socket, :error, "Failed to save dialogue")
        end
      else
        socket
      end
    else
      socket
    end
  end
end
