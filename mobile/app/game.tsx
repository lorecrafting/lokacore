/**
 * Game Screen
 * Main gameplay interface with room view, panels, and overlays
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/hooks/useAuth';
import { usePhoenix } from '../src/hooks/usePhoenix';
import { RoomView } from '../src/components/RoomView';
import { BottomBar } from '../src/components/BottomBar';
import { EntityContextModal } from '../src/components/EntityContext';
import { MenuPanel } from '../src/components/MenuPanel';
import { ShopModal } from '../src/components/ShopModal';
import { ContainerModal } from '../src/components/ContainerModal';
import { CombatOverlay } from '../src/components/CombatOverlay';
import { BardoOverlay } from '../src/components/BardoOverlay';
import { PageContainer } from '../src/components/PageContainer';
import { EnvironmentProvider } from '../src/components/EnvironmentContext';
import { DesignVariantsProvider, useDesignVariants } from '../src/contexts/DesignVariantsContext';
import { DesignVariantPicker } from '../src/components/DesignVariantPicker';
import { useSound, useAmbientSound } from '../src/audio';
import { colors, fonts, spacing, getPhaseColors } from '../src/theme';
import { API_BASE_URL } from '../src/config';
import {
  initScreenshotCapture,
  setScreenshotPlayerName,
  setScreenshotRoom,
  cleanupScreenshotCapture,
} from '../src/utils/screenshotCapture';

export default function GameScreen() {
  const { token, player, loading: authLoading, logout } = useAuth();

  // Ref for screenshot capture - use callback ref to track when view is mounted
  const gameViewRef = useRef<View>(null);
  const [viewMounted, setViewMounted] = useState(false);

  const setGameViewRef = useCallback((node: View | null) => {
    gameViewRef.current = node;
    setViewMounted(!!node);
  }, []);

  // Panel visibility state
  const [menuVisible, setMenuVisible] = useState(false);

  const handleDisconnect = useCallback(() => {
    console.log('Disconnected from game');
    cleanupScreenshotCapture();
  }, []);

  const {
    connected,
    connecting,
    error,
    gameState,
    events,
    entityContext,
    dialogueState,
    dialogueHistory,
    combatState,
    shopState,
    containerState,
    bardoState,
    channel,
    navigate,
    say,
    shout,
    clickEntity,
    performAction,
    closeEntityContext,
    selectDialogueOption,
    dropItem,
    equipItem,
    unequipItem,
    useItem,
    flee,
    buyItem,
    sellItem,
    closeShop,
    takeFromContainer,
    closeContainer,
    reincarnate,
    craft,
    setMood,
    setPose,
    clearEvents,
  } = usePhoenix({
    token,
    onDisconnect: handleDisconnect,
  });

  // Sound system
  const { setSoundState } = useSound();

  // Update sound state when it changes from server
  useEffect(() => {
    if (gameState?.sound_state) {
      setSoundState(gameState.sound_state);
    }
  }, [gameState?.sound_state, setSoundState]);

  // Enable ambient sound playback (disabled during bardo)
  useAmbientSound({ enabled: connected && !bardoState?.active });

  // Initialize screenshot capture when channel connects and view is mounted
  useEffect(() => {
    if (channel && viewMounted && gameViewRef.current) {
      initScreenshotCapture(channel, gameViewRef, API_BASE_URL, player?.name || undefined);
    }
    return () => {
      cleanupScreenshotCapture();
    };
  }, [channel, player?.name, viewMounted]);

  // Update screenshot context when room changes
  useEffect(() => {
    if (gameState?.room?.title) {
      setScreenshotRoom(gameState.room.title);
    }
  }, [gameState?.room?.title]);

  // Update player name for screenshots
  useEffect(() => {
    if (player?.name) {
      setScreenshotPlayerName(player.name);
    }
  }, [player?.name]);

  // Handle action from entity context menu
  const handleEntityAction = useCallback(
    (action: string) => {
      if (entityContext) {
        performAction(action, entityContext.id);
        // Don't close modal for 'talk' action - dialogue will appear in the modal
        if (action !== 'talk') {
          closeEntityContext();
        }
      }
    },
    [entityContext, performAction, closeEntityContext]
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace('/');
    }
  }, [token, authLoading]);

  // Get dynamic theme based on time phase - must be called before early returns (hooks rule)
  const timePhase = gameState?.visual_state?.phase || 'day';
  const phaseColors = getPhaseColors(timePhase);

  // Status bar style: auto lets system decide based on theme
  const statusBarStyle = 'auto' as const;

  // Show loading while connecting
  if (authLoading || connecting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: phaseColors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={phaseColors.text} />
          <Text style={[styles.loadingText, { color: phaseColors.textMuted }]}>
            {authLoading ? 'Loading...' : 'Connecting to the world...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: phaseColors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: phaseColors.text }]}>{error}</Text>
          <Text
            style={[styles.retryLink, { color: phaseColors.text }]}
            onPress={() => {
              router.replace('/');
            }}
          >
            Return to login
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show waiting state if connected but no game state yet
  if (!gameState || !gameState.room) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: phaseColors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={phaseColors.text} />
          <Text style={[styles.loadingText, { color: phaseColors.textMuted }]}>Entering the world...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render Bardo overlay if in death state
  if (bardoState?.active) {
    return (
      <SafeAreaView style={[styles.container, styles.bardoContainer]} edges={['top']}>
        <StatusBar style="light" />
        <BardoOverlay bardo={bardoState} onReincarnate={reincarnate} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: phaseColors.background }]} edges={['top']}>
      <StatusBar style={statusBarStyle} />
      <DesignVariantsProvider>
      <View ref={setGameViewRef} style={styles.screenshotContainer} collapsable={false}>
        <EnvironmentProvider visualState={gameState.visual_state}>
          {/* Design Variant Picker Modal */}
          <DesignVariantPicker />
          <PageContainer>
          {/* Combat Overlay - shown at top during combat */}
          {combatState?.active && (
            <CombatOverlay
              combat={combatState}
              playerHealth={gameState.health}
              onFlee={flee}
            />
          )}

          {/* Main Room View */}
          <RoomView
            room={gameState.room}
            otherPlayers={gameState.other_players}
            events={events}
            onEntityPress={clickEntity}
            style={combatState?.active ? styles.roomViewWithCombat : undefined}
          />

          {/* Bottom Bar (Navigation, Chat, Menu access) */}
          <BottomBar
            exits={gameState.room.exits}
            health={gameState.health}
            resources={gameState.resources}
            calendar={gameState.calendar}
            activeQuest={gameState.quests.find(q => !q.completed) || null}
            onNavigate={navigate}
            onSay={say}
            onShout={shout}
            onOpenMenu={() => setMenuVisible(true)}
          />
        </PageContainer>

        {/* Entity Context Modal (includes Dialogue) */}
        <EntityContextModal
          entity={entityContext}
          roomTitle={gameState.room.title}
          dialogueState={dialogueState}
          dialogueHistory={dialogueHistory}
          onAction={handleEntityAction}
          onDialogueChoice={selectDialogueOption}
          onClose={closeEntityContext}
        />

        {/* Menu Panel (Character, Inventory, Quest, Craft, Socials, Settings) */}
        <MenuPanel
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          playerName={gameState.player?.name || 'Adventurer'}
          stats={gameState.stats || {}}
          health={gameState.health}
          resources={gameState.resources || {}}
          inventory={gameState.inventory || []}
          equipped={gameState.equipped || {}}
          gold={gameState.stats?.gold}
          onDropItem={dropItem}
          onEquipItem={equipItem}
          onUnequipItem={unequipItem}
          onUseItem={useItem}
          activeQuests={gameState.quests || []}
          completedQuests={gameState.completedQuests || []}
          recipes={[]}
          onCraft={craft}
          currentMood={gameState.social?.mood}
          currentPose={gameState.social?.pose}
          onSetMood={setMood}
          onSetPose={setPose}
          onLogout={logout}
        />

        {/* Shop Modal */}
        {shopState?.open && (
          <ShopModal
            shop={shopState}
            inventory={gameState.inventory || []}
            playerGold={gameState.stats?.gold || 0}
            onBuy={buyItem}
            onSell={sellItem}
            onClose={closeShop}
          />
        )}

          {/* Container Modal */}
          {containerState?.open && (
            <ContainerModal
              container={containerState}
              onTake={takeFromContainer}
              onClose={closeContainer}
            />
          )}
        </EnvironmentProvider>
      </View>
      </DesignVariantsProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenshotContainer: {
    flex: 1,
  },
  bardoContainer: {
    backgroundColor: colors.bardoBackground,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryLink: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  roomViewWithCombat: {
    marginTop: 180, // Offset for combat overlay height
  },
});
