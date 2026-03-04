import { useEffect } from "react";
import phoenixClient from "../services/phoenixClient";
import { useGameStore } from "../store/gameStore";

export function usePhoenixChannel() {
  const token = useGameStore((s) => s.token);
  const setConnected = useGameStore((s) => s.setConnected);
  const clearAuth = useGameStore((s) => s.clearAuth);
  const setRoom = useGameStore((s) => s.setRoom);
  const addEvent = useGameStore((s) => s.addEvent);
  const startDialogue = useGameStore((s) => s.startDialogue);
  const updateDialogue = useGameStore((s) => s.updateDialogue);
  const endDialogue = useGameStore((s) => s.endDialogue);
  const setCurrentEntity = useGameStore((s) => s.setCurrentEntity);
  const setPage = useGameStore((s) => s.setPage);
  const openShop = useGameStore((s) => s.openShop);
  const closeShop = useGameStore((s) => s.closeShop);
  const openContainer = useGameStore((s) => s.openContainer);
  const updateContainer = useGameStore((s) => s.updateContainer);
  const closeContainer = useGameStore((s) => s.closeContainer);
  const updateInventory = useGameStore((s) => s.updateInventory);
  const updateQuests = useGameStore((s) => s.updateQuests);
  const updateQuestProgress = useGameStore((s) => s.updateQuestProgress);
  const updateCharacter = useGameStore((s) => s.updateCharacter);
  const startCutscene = useGameStore((s) => s.startCutscene);
  const addCutsceneLine = useGameStore((s) => s.addCutsceneLine);
  const endCutscene = useGameStore((s) => s.endCutscene);
  const setAtmosphere = useGameStore((s) => s.setAtmosphere);

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function connect() {
      try {
        phoenixClient.connect(token!);
        const gameState = await phoenixClient.joinGame();

        if (!active) return;

        setConnected(true);

        if (gameState.room) setRoom(gameState.room);
        if (gameState.inventory) updateInventory(gameState.inventory);
        if (gameState.quests) updateQuests(gameState.quests);
        if (gameState.character) updateCharacter(gameState.character);

        registerHandlers();
      } catch (err) {
        if (!active) return;
        console.error("PhoenixChannel: failed to connect or join", err);
        setConnected(false);
      }
    }

    function registerHandlers() {
      phoenixClient.onEvent("room_update", (payload) => {
        setRoom(payload);
      });

      phoenixClient.onEvent("event", (payload) => {
        addEvent(payload.text ?? payload.message ?? "", payload.class);
      });

      phoenixClient.onEvent("dialogue_start", (payload) => {
        startDialogue(payload);
      });

      phoenixClient.onEvent("dialogue_update", (payload) => {
        updateDialogue(payload);
      });

      phoenixClient.onEvent("dialogue_end", (_payload) => {
        endDialogue();
      });

      phoenixClient.onEvent("entity_context", (payload) => {
        setCurrentEntity(payload);
        setPage("ENTITY");
      });

      phoenixClient.onEvent("shop_open", (payload) => {
        openShop(payload);
      });

      phoenixClient.onEvent("shop_close", (_payload) => {
        closeShop();
      });

      phoenixClient.onEvent("container_open", (payload) => {
        openContainer(payload);
      });

      phoenixClient.onEvent("container_update", (payload) => {
        updateContainer(payload);
      });

      phoenixClient.onEvent("container_close", (_payload) => {
        closeContainer();
      });

      phoenixClient.onEvent("inventory_update", (payload) => {
        updateInventory(payload.items ?? payload);
      });

      phoenixClient.onEvent("quest_accepted", (payload) => {
        addEvent(payload.message ?? `Quest accepted: ${payload.quest?.title ?? ""}`, "quest");
        if (payload.quests) updateQuests(payload.quests);
      });

      phoenixClient.onEvent("quest_completed", (payload) => {
        addEvent(payload.message ?? `Quest completed: ${payload.quest?.title ?? ""}`, "quest");
        if (payload.quests) updateQuests(payload.quests);
      });

      phoenixClient.onEvent("quest_progress", (payload) => {
        updateQuestProgress(payload.quest_key, payload.objective_id);
      });

      phoenixClient.onEvent("cutscene_start", (_payload) => {
        startCutscene();
      });

      phoenixClient.onEvent("cutscene_line", (payload) => {
        addCutsceneLine(payload);
      });

      phoenixClient.onEvent("cutscene_end", (_payload) => {
        endCutscene();
      });

      phoenixClient.onEvent("atmosphere_update", (payload) => {
        setAtmosphere(payload);
      });

      phoenixClient.onEvent("stats_update", (payload) => {
        updateCharacter(payload);
      });

      phoenixClient.onEvent("ghost_entered", (payload) => {
        addEvent(payload.message ?? `${payload.name ?? "Someone"} appears.`, "ghost");
      });

      phoenixClient.onEvent("ghost_exited", (payload) => {
        addEvent(payload.message ?? `${payload.name ?? "Someone"} fades away.`, "ghost");
      });

      phoenixClient.onEvent("force_disconnected", (_payload) => {
        phoenixClient.disconnect();
        setConnected(false);
        clearAuth();
      });
    }

    connect();

    return () => {
      active = false;
      phoenixClient.disconnect();
      setConnected(false);
    };
  }, [token]);

  return {
    navigate: (direction: string) => phoenixClient.navigate(direction),
    clickEntity: (entityId: string) => phoenixClient.clickEntity(entityId),
    talkTo: (entityId: string) => phoenixClient.action("talk", entityId),
    dialogueSelect: (choiceIndex: number) => phoenixClient.dialogueSelect(choiceIndex),
    shopAction: (action: string, itemIndex?: number) => phoenixClient.shopAction(action, itemIndex),
    containerAction: (action: string, itemIndex?: number) => phoenixClient.containerAction(action, itemIndex),
  };
}
