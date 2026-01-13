/**
 * Debug Environment Screen
 *
 * A development screen for testing and previewing all environmental effects
 * without needing a server connection. Useful for:
 * - Designers testing visual effects
 * - Developers verifying theming calculations
 * - QA validating phase transitions
 *
 * Access: Navigate to /debug-environment in the app
 *
 * Features:
 * - Left pane with manual controls for all visual state parameters
 * - Auto-cycle mode for testing transitions
 * - Quick presets for common scenarios
 * - Sample room content to preview effects in context
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { EnvironmentProvider, useEnvironment } from '../src/components/EnvironmentContext';
import { DynamicBackground } from '../src/components/DynamicBackground';
import { RoomView } from '../src/components/RoomView';
import { BottomBar } from '../src/components/BottomBar';
import EnvironmentDebugPanel, { PHASES } from '../src/components/EnvironmentDebugPanel';
import { fonts, spacing } from '../src/theme';
import type { VisualState, TimePhase, Room, CalendarState } from '../src/types/game';

// =============================================================================
// Sample Data for Preview
// =============================================================================

const sampleRoom: Room = {
  id: 'debug-room',
  title: 'Test Chamber',
  description:
    'A mystical chamber designed for testing environmental effects. The walls shimmer with ancient runes that respond to the light, and the air itself seems to shift with the passage of time. Strange instruments line the walls, each calibrated to measure the subtle changes in atmosphere.',
  exits: [
    { direction: 'north', destination_id: 'room-1', description: 'A passage leads north' },
    { direction: 'east', destination_id: 'room-2', description: 'An archway opens to the east' },
    { direction: 'south', destination_id: null, description: 'The way is blocked' },
    { direction: 'west', destination_id: null, description: 'A sealed door' },
  ],
  entities: [
    {
      id: 'npc-1',
      name: 'Test Monk',
      type: 'npc',
      long_desc: 'A serene monk stands here, observing the environmental changes.',
      primary_keyword: 'monk',
    },
    {
      id: 'npc-2',
      name: 'Wandering Scholar',
      type: 'npc',
      long_desc: 'A scholar with an ancient tome studies the light patterns.',
      primary_keyword: 'scholar',
    },
  ],
  items: [
    {
      id: 'item-1',
      name: 'Light Crystal',
      long_desc: 'A crystal that glows softly, its color changing with the time of day.',
      primary_keyword: 'crystal',
    },
    {
      id: 'item-2',
      name: 'Weather Vane',
      long_desc: 'An ornate weather vane spins slowly, tracking invisible currents.',
      primary_keyword: 'vane',
    },
  ],
  tags: ['indoor', 'monastery', 'magical'],
};

// Default visual state for initialization
const defaultVisualState: VisualState = {
  phase: 'day',
  hour: 12,
  minute: 0,
  light_level: 1.0,
  moon_phase: 'full',
  moon_illumination: 1.0,
  weather: 'clear',
  player_light_source: null,
  is_indoor: false,
  biome: 'default',
};

// =============================================================================
// Inner Content Component (inside EnvironmentProvider)
// =============================================================================

interface DebugContentProps {
  visualState: VisualState;
  onStateChange: (state: VisualState) => void;
  isAutoCycling: boolean;
  onToggleAutoCycle: () => void;
  autoCycleSpeed: number;
  onAutoCycleSpeedChange: (speed: number) => void;
  onTriggerTransition: (type: 'sunrise' | 'sunset') => void;
}

function DebugContent({
  visualState,
  onStateChange,
  isAutoCycling,
  onToggleAutoCycle,
  autoCycleSpeed,
  onAutoCycleSpeedChange,
  onTriggerTransition,
}: DebugContentProps) {
  const { colors, animatedColors } = useEnvironment();

  // Create calendar state for BottomBar
  const calendar: CalendarState = {
    hour_char: '午',
    hour_animal: 'Horse',
    phase: visualState.phase,
    day: 15,
    month: 8,
    month_name: 'Osmanthus Moon',
    month_char: '桂月',
    year: 2024,
    year_animal: 'Dragon',
    year_element: 'wood',
    year_char: '甲辰',
    moon_phase: visualState.moon_phase,
    moon_phase_name: 'Full Moon',
    moon_phase_char: '望',
    moon_illumination: visualState.moon_illumination,
    solar_term: null,
  };

  // Sample event log
  const events = [
    { text: 'The light shifts subtly as time passes.', type: 'normal' as const },
    { text: 'A cool breeze carries the scent of incense.', type: 'normal' as const },
  ];

  const handleEntityPress = useCallback((id: string, type: string) => {
    console.log(`Entity pressed: ${id} (${type})`);
  }, []);

  const handleNavigate = useCallback((direction: string) => {
    console.log(`Navigate: ${direction}`);
  }, []);

  const handleSay = useCallback((message: string) => {
    console.log(`Say: ${message}`);
  }, []);

  const handleShout = useCallback((message: string) => {
    console.log(`Shout: ${message}`);
  }, []);

  const handleOpenMenu = useCallback(() => {
    console.log('Menu opened');
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.mainLayout}>
          {/* Left pane - Debug controls */}
          <EnvironmentDebugPanel
            visualState={visualState}
            onStateChange={onStateChange}
            onTriggerTransition={onTriggerTransition}
            isAutoCycling={isAutoCycling}
            onToggleAutoCycle={onToggleAutoCycle}
            autoCycleSpeed={autoCycleSpeed}
            onAutoCycleSpeedChange={onAutoCycleSpeedChange}
            layout="left"
          />

          {/* Right pane - Preview content wrapped in DynamicBackground */}
          <View style={styles.previewPane}>
            <DynamicBackground>
              {/* Header with back button */}
              <Animated.View style={[styles.header, { borderBottomColor: animatedColors.border }]}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                  <Animated.Text style={[styles.backText, { color: animatedColors.text }] as any}>Back</Animated.Text>
                </Pressable>
                <Animated.Text style={[styles.headerTitle, { color: animatedColors.text }] as any}>
                  Environment Preview
                </Animated.Text>
                <View style={styles.headerSpacer} />
              </Animated.View>

              {/* Main content area */}
              <View style={styles.roomContainer}>
                <RoomView
                  room={sampleRoom}
                  otherPlayers={[{ id: 'player-2', name: 'TestPlayer' }]}
                  events={events}
                  onEntityPress={handleEntityPress}
                />
              </View>

              {/* Bottom bar preview */}
              <BottomBar
                exits={sampleRoom.exits}
                health={{ current: 85, max: 100 }}
                resources={{ mv: { current: 120, max: 150 } }}
                calendar={calendar}
                activeQuest={null}
                onNavigate={handleNavigate}
                onSay={handleSay}
                onShout={handleShout}
                onOpenMenu={handleOpenMenu}
              />
            </DynamicBackground>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// =============================================================================
// Main Debug Screen
// =============================================================================

export default function DebugEnvironmentScreen() {
  const [visualState, setVisualState] = useState<VisualState>(defaultVisualState);
  const [isAutoCycling, setIsAutoCycling] = useState(false);
  const [autoCycleSpeed, setAutoCycleSpeed] = useState(5);
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-cycle through phases
  useEffect(() => {
    if (isAutoCycling) {
      autoCycleRef.current = setInterval(() => {
        setVisualState((prev) => {
          const currentIndex = PHASES.findIndex((p) => p.key === prev.phase);
          const nextIndex = (currentIndex + 1) % PHASES.length;
          const nextPhase = PHASES[nextIndex].key as TimePhase;

          // Calculate new light level for the phase
          const lightLevels: Record<TimePhase, number> = {
            dawn: 0.5,
            day: 1.0,
            dusk: 0.5,
            night: 0.1,
          };

          return {
            ...prev,
            phase: nextPhase,
            light_level: lightLevels[nextPhase],
          };
        });
      }, autoCycleSpeed * 1000);

      return () => {
        if (autoCycleRef.current) {
          clearInterval(autoCycleRef.current);
        }
      };
    }
  }, [isAutoCycling, autoCycleSpeed]);

  const handleToggleAutoCycle = useCallback(() => {
    setIsAutoCycling((prev) => !prev);
  }, []);

  const handleTriggerTransition = useCallback((type: 'sunrise' | 'sunset') => {
    // Trigger appropriate phase change
    if (type === 'sunrise') {
      setVisualState((prev) => ({
        ...prev,
        phase: 'dawn',
        light_level: 0.5,
      }));
      // Then transition to day after a short delay
      setTimeout(() => {
        setVisualState((prev) => ({
          ...prev,
          phase: 'day',
          light_level: 1.0,
        }));
      }, 2000);
    } else {
      setVisualState((prev) => ({
        ...prev,
        phase: 'dusk',
        light_level: 0.5,
      }));
      // Then transition to night after a short delay
      setTimeout(() => {
        setVisualState((prev) => ({
          ...prev,
          phase: 'night',
          light_level: 0.1,
        }));
      }, 2000);
    }
  }, []);

  return (
    <EnvironmentProvider visualState={visualState} fastTransitions>
      <DebugContent
        visualState={visualState}
        onStateChange={setVisualState}
        isAutoCycling={isAutoCycling}
        onToggleAutoCycle={handleToggleAutoCycle}
        autoCycleSpeed={autoCycleSpeed}
        onAutoCycleSpeedChange={setAutoCycleSpeed}
        onTriggerTransition={handleTriggerTransition}
      />
    </EnvironmentProvider>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  previewPane: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 50, // Balance the back button
  },
  roomContainer: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
});
