/**
 * EnvironmentDebugPanel - Comprehensive controls for testing environmental effects
 *
 * This component provides a control panel for manually adjusting all visual state
 * parameters to test and preview environmental effects without needing a server.
 *
 * Usage:
 *   <EnvironmentDebugPanel
 *     visualState={visualState}
 *     onStateChange={setVisualState}
 *   />
 *
 * Extensibility:
 *   To add new effects, update the corresponding section:
 *   - New phases: Add to PHASES array
 *   - New weather: Add to WEATHER_OPTIONS array
 *   - New biomes: Add to BIOME_OPTIONS array
 *   - New light sources: Add to LIGHT_SOURCE_OPTIONS array
 *   - New moon phases: Add to MOON_PHASES array
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { fonts, spacing } from '../theme';
import type {
  VisualState,
  TimePhase,
  MoonPhase,
  Weather,
  Biome,
  LightSource,
} from '../types/game';

// =============================================================================
// Configuration Arrays - Add new options here for extensibility
// =============================================================================

export const PHASES: { key: TimePhase; label: string; icon: string }[] = [
  { key: 'dawn', label: 'Dawn', icon: '🌅' },
  { key: 'day', label: 'Day', icon: '☀️' },
  { key: 'dusk', label: 'Dusk', icon: '🌇' },
  { key: 'night', label: 'Night', icon: '🌙' },
];

export const MOON_PHASES: { key: MoonPhase; label: string; icon: string }[] = [
  { key: 'new', label: 'New', icon: '🌑' },
  { key: 'waxing_crescent', label: 'Wax Cres', icon: '🌒' },
  { key: 'first_quarter', label: '1st Qtr', icon: '🌓' },
  { key: 'waxing_gibbous', label: 'Wax Gib', icon: '🌔' },
  { key: 'full', label: 'Full', icon: '🌕' },
  { key: 'waning_gibbous', label: 'Wan Gib', icon: '🌖' },
  { key: 'last_quarter', label: 'Last Qtr', icon: '🌗' },
  { key: 'waning_crescent', label: 'Wan Cres', icon: '🌘' },
];

export const WEATHER_OPTIONS: { key: Weather; label: string; icon: string }[] = [
  { key: 'clear', label: 'Clear', icon: '☀️' },
  { key: 'cloudy', label: 'Cloudy', icon: '☁️' },
  { key: 'rain', label: 'Rain', icon: '🌧️' },
  { key: 'storm', label: 'Storm', icon: '⛈️' },
  { key: 'fog', label: 'Fog', icon: '🌫️' },
  { key: 'snow', label: 'Snow', icon: '❄️' },
];

export const BIOME_OPTIONS: { key: Biome; label: string; icon: string }[] = [
  { key: 'default', label: 'Default', icon: '🏠' },
  { key: 'forest', label: 'Forest', icon: '🌲' },
  { key: 'mountain', label: 'Mountain', icon: '⛰️' },
  { key: 'cave', label: 'Cave', icon: '🕳️' },
  { key: 'village', label: 'Village', icon: '🏘️' },
  { key: 'monastery', label: 'Monastery', icon: '🛕' },
  { key: 'market', label: 'Market', icon: '🏪' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'desert', label: 'Desert', icon: '🏜️' },
  { key: 'swamp', label: 'Swamp', icon: '🐸' },
  { key: 'enchanted', label: 'Enchanted', icon: '✨' },
  { key: 'bardo', label: 'Bardo', icon: '👻' },
];

export const LIGHT_SOURCE_OPTIONS: { key: LightSource | null; label: string; icon: string }[] = [
  { key: null, label: 'None', icon: '🌑' },
  { key: 'candle', label: 'Candle', icon: '🕯️' },
  { key: 'torch', label: 'Torch', icon: '🔦' },
  { key: 'lantern', label: 'Lantern', icon: '🏮' },
];

// =============================================================================
// Component Props
// =============================================================================

interface EnvironmentDebugPanelProps {
  visualState: VisualState;
  onStateChange: (newState: VisualState) => void;
  onTriggerTransition?: (type: 'sunrise' | 'sunset') => void;
  isAutoCycling?: boolean;
  onToggleAutoCycle?: () => void;
  autoCycleSpeed?: number;
  onAutoCycleSpeedChange?: (speed: number) => void;
  /** Layout mode: 'bottom' for bottom panel, 'left' for left sidebar */
  layout?: 'bottom' | 'left';
}

// =============================================================================
// Sub-Components
// =============================================================================

interface OptionButtonProps<T> {
  option: { key: T; label: string; icon: string };
  isSelected: boolean;
  onSelect: (key: T) => void;
  compact?: boolean;
}

function OptionButton<T>({ option, isSelected, onSelect, compact }: OptionButtonProps<T>) {
  return (
    <Pressable
      style={[
        styles.optionButton,
        isSelected && styles.optionButtonSelected,
        compact && styles.optionButtonCompact,
      ]}
      onPress={() => onSelect(option.key)}
    >
      <Text style={styles.optionIcon}>{option.icon}</Text>
      <Text
        style={[
          styles.optionLabel,
          isSelected && styles.optionLabelSelected,
          compact && styles.optionLabelCompact,
        ]}
        numberOfLines={1}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function EnvironmentDebugPanel({
  visualState,
  onStateChange,
  onTriggerTransition,
  isAutoCycling = false,
  onToggleAutoCycle,
  autoCycleSpeed = 5,
  onAutoCycleSpeedChange,
  layout = 'bottom',
}: EnvironmentDebugPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const isLeftLayout = layout === 'left';

  // Update a single field in visual state
  const updateField = useCallback(
    <K extends keyof VisualState>(field: K, value: VisualState[K]) => {
      onStateChange({ ...visualState, [field]: value });
    },
    [visualState, onStateChange]
  );

  // Calculate light level based on phase
  const getLightLevelForPhase = (phase: TimePhase): number => {
    switch (phase) {
      case 'day': return 1.0;
      case 'dawn': return 0.5;
      case 'dusk': return 0.5;
      case 'night': return 0.1;
      default: return 1.0;
    }
  };

  // Calculate moon illumination based on phase
  const getMoonIllumination = (moonPhase: MoonPhase): number => {
    const illuminations: Record<MoonPhase, number> = {
      new: 0,
      waxing_crescent: 0.25,
      first_quarter: 0.5,
      waxing_gibbous: 0.75,
      full: 1.0,
      waning_gibbous: 0.75,
      last_quarter: 0.5,
      waning_crescent: 0.25,
    };
    return illuminations[moonPhase];
  };

  // Handle phase change with automatic light level update
  const handlePhaseChange = useCallback(
    (phase: TimePhase) => {
      onStateChange({
        ...visualState,
        phase,
        light_level: getLightLevelForPhase(phase),
      });
    },
    [visualState, onStateChange]
  );

  // Handle moon phase change with automatic illumination update
  const handleMoonPhaseChange = useCallback(
    (moonPhase: MoonPhase) => {
      onStateChange({
        ...visualState,
        moon_phase: moonPhase,
        moon_illumination: getMoonIllumination(moonPhase),
      });
    },
    [visualState, onStateChange]
  );

  // Left layout doesn't support collapsing
  if (!expanded && !isLeftLayout) {
    return (
      <Pressable style={styles.collapsedBar} onPress={() => setExpanded(true)}>
        <Text style={styles.collapsedText}>
          🎨 Debug Panel · {visualState.phase} · {visualState.weather} · {visualState.biome}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, isLeftLayout && styles.containerLeft]}>
      {/* Header */}
      <View style={[styles.header, isLeftLayout && styles.headerLeft]}>
        <Text style={styles.headerTitle}>Debug</Text>
        {!isLeftLayout && (
          <Pressable onPress={() => setExpanded(false)}>
            <Text style={styles.collapseButton}>−</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Time Phase */}
        <Section title="Time Phase">
          <View style={styles.optionRow}>
            {PHASES.map((phase) => (
              <OptionButton
                key={phase.key}
                option={phase}
                isSelected={visualState.phase === phase.key}
                onSelect={handlePhaseChange}
              />
            ))}
          </View>
        </Section>

        {/* Moon Phase */}
        <Section title="Moon Phase">
          <View style={styles.optionGrid}>
            {MOON_PHASES.map((moon) => (
              <OptionButton
                key={moon.key}
                option={moon}
                isSelected={visualState.moon_phase === moon.key}
                onSelect={handleMoonPhaseChange}
                compact
              />
            ))}
          </View>
        </Section>

        {/* Weather */}
        <Section title="Weather">
          <View style={styles.optionRow}>
            {WEATHER_OPTIONS.map((weather) => (
              <OptionButton
                key={weather.key}
                option={weather}
                isSelected={visualState.weather === weather.key}
                onSelect={(key) => updateField('weather', key)}
              />
            ))}
          </View>
        </Section>

        {/* Biome */}
        <Section title="Biome">
          <View style={styles.optionGrid}>
            {BIOME_OPTIONS.map((biome) => (
              <OptionButton
                key={biome.key}
                option={biome}
                isSelected={visualState.biome === biome.key}
                onSelect={(key) => updateField('biome', key)}
                compact
              />
            ))}
          </View>
        </Section>

        {/* Light Source */}
        <Section title="Player Light Source">
          <View style={styles.optionRow}>
            {LIGHT_SOURCE_OPTIONS.map((light) => (
              <OptionButton
                key={light.key ?? 'none'}
                option={light}
                isSelected={visualState.player_light_source === light.key}
                onSelect={(key) => updateField('player_light_source', key)}
              />
            ))}
          </View>
        </Section>

        {/* Indoor/Outdoor Toggle */}
        <Section title="Location">
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Indoor</Text>
            <Switch
              value={visualState.is_indoor}
              onValueChange={(value) => updateField('is_indoor', value)}
              trackColor={{ false: '#444', true: '#666' }}
              thumbColor={visualState.is_indoor ? '#fff' : '#888'}
            />
            <Text style={styles.toggleLabel}>
              {visualState.is_indoor ? '(No weather/sky)' : '(Full effects)'}
            </Text>
          </View>
        </Section>

        {/* Transition Triggers */}
        {onTriggerTransition && (
          <Section title="Transitions">
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.actionButton}
                onPress={() => onTriggerTransition('sunrise')}
              >
                <Text style={styles.actionButtonText}>🌅 Trigger Sunrise</Text>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={() => onTriggerTransition('sunset')}
              >
                <Text style={styles.actionButtonText}>🌇 Trigger Sunset</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* Auto-Cycle */}
        {onToggleAutoCycle && (
          <Section title="Auto-Cycle">
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Enable</Text>
              <Switch
                value={isAutoCycling}
                onValueChange={onToggleAutoCycle}
                trackColor={{ false: '#444', true: '#666' }}
                thumbColor={isAutoCycling ? '#fff' : '#888'}
              />
              {isAutoCycling && (
                <Text style={styles.toggleLabel}>
                  (Cycling every {autoCycleSpeed}s)
                </Text>
              )}
            </View>
            {isAutoCycling && onAutoCycleSpeedChange && (
              <View style={styles.speedButtons}>
                {[2, 5, 10, 30].map((speed) => (
                  <Pressable
                    key={speed}
                    style={[
                      styles.speedButton,
                      autoCycleSpeed === speed && styles.speedButtonSelected,
                    ]}
                    onPress={() => onAutoCycleSpeedChange(speed)}
                  >
                    <Text
                      style={[
                        styles.speedButtonText,
                        autoCycleSpeed === speed && styles.speedButtonTextSelected,
                      ]}
                    >
                      {speed}s
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
        )}

        {/* Current State Display */}
        <Section title="Current State">
          <View style={styles.stateDisplay}>
            <Text style={styles.stateText}>
              Phase: {visualState.phase} (light: {visualState.light_level.toFixed(1)})
            </Text>
            <Text style={styles.stateText}>
              Moon: {visualState.moon_phase} ({(visualState.moon_illumination * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.stateText}>
              Weather: {visualState.weather}
            </Text>
            <Text style={styles.stateText}>
              Biome: {visualState.biome}
            </Text>
            <Text style={styles.stateText}>
              Light: {visualState.player_light_source ?? 'none'}
            </Text>
            <Text style={styles.stateText}>
              Location: {visualState.is_indoor ? 'Indoor' : 'Outdoor'}
            </Text>
            <Text style={styles.stateText}>
              Time: {visualState.hour.toString().padStart(2, '0')}:{visualState.minute.toString().padStart(2, '0')}
            </Text>
          </View>
        </Section>

        {/* Presets */}
        <Section title="Quick Presets">
          <View style={styles.presetGrid}>
            <Pressable
              style={styles.presetButton}
              onPress={() => onStateChange({
                ...visualState,
                phase: 'night',
                light_level: 0.1,
                moon_phase: 'full',
                moon_illumination: 1.0,
                weather: 'clear',
                biome: 'forest',
                is_indoor: false,
                player_light_source: null,
              })}
            >
              <Text style={styles.presetText}>🌲🌕 Forest Night</Text>
            </Pressable>
            <Pressable
              style={styles.presetButton}
              onPress={() => onStateChange({
                ...visualState,
                phase: 'night',
                light_level: 0.1,
                weather: 'rain',
                biome: 'village',
                is_indoor: false,
                player_light_source: 'lantern',
              })}
            >
              <Text style={styles.presetText}>🌧️🏮 Rainy Night</Text>
            </Pressable>
            <Pressable
              style={styles.presetButton}
              onPress={() => onStateChange({
                ...visualState,
                phase: 'dawn',
                light_level: 0.5,
                weather: 'fog',
                biome: 'swamp',
                is_indoor: false,
                player_light_source: null,
              })}
            >
              <Text style={styles.presetText}>🌫️🐸 Foggy Swamp</Text>
            </Pressable>
            <Pressable
              style={styles.presetButton}
              onPress={() => onStateChange({
                ...visualState,
                phase: 'day',
                light_level: 1.0,
                weather: 'clear',
                biome: 'monastery',
                is_indoor: true,
                player_light_source: null,
              })}
            >
              <Text style={styles.presetText}>🛕☀️ Temple Day</Text>
            </Pressable>
            <Pressable
              style={styles.presetButton}
              onPress={() => onStateChange({
                ...visualState,
                phase: 'night',
                light_level: 0.1,
                moon_phase: 'new',
                moon_illumination: 0,
                weather: 'clear',
                biome: 'cave',
                is_indoor: true,
                player_light_source: 'torch',
              })}
            >
              <Text style={styles.presetText}>🕳️🔦 Dark Cave</Text>
            </Pressable>
            <Pressable
              style={styles.presetButton}
              onPress={() => onStateChange({
                ...visualState,
                phase: 'dusk',
                light_level: 0.5,
                weather: 'snow',
                biome: 'mountain',
                is_indoor: false,
                player_light_source: null,
              })}
            >
              <Text style={styles.presetText}>⛰️❄️ Snowy Dusk</Text>
            </Pressable>
          </View>
        </Section>

        {/* Spacer for scroll */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const LEFT_PANEL_WIDTH = 280;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    maxHeight: '60%',
  },
  containerLeft: {
    width: LEFT_PANEL_WIDTH,
    maxHeight: '100%',
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
  },
  collapsedBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  collapsedText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  collapseButton: {
    fontSize: 24,
    color: '#fff',
    paddingHorizontal: spacing.sm,
  },
  scrollView: {
    paddingHorizontal: spacing.md,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sectionContent: {},
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    gap: 4,
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  optionButtonCompact: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  optionIcon: {
    fontSize: 14,
  },
  optionLabel: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  optionLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  optionLabelCompact: {
    fontSize: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleLabel: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: '#fff',
  },
  speedButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  speedButton: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  speedButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  speedButtonText: {
    fontFamily: fonts.serif,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  speedButtonTextSelected: {
    color: '#fff',
  },
  stateDisplay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: spacing.sm,
    borderRadius: 4,
  },
  stateText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 16,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
  },
  presetText: {
    fontFamily: fonts.serif,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default EnvironmentDebugPanel;
