/**
 * Shared types for BottomBar variants
 */

import type { Exit, Resources, CalendarState, Quest } from '../../types/game';

export interface BottomBarVariantProps {
  exits: Exit[];
  health: { current: number; max: number };
  resources: Resources;
  calendar?: CalendarState;
  activeQuest?: Quest | null;
  onNavigate: (direction: string) => void;
  onSay: (message: string) => void;
  onShout: (message: string) => void;
  onOpenMenu: () => void;
  // Preview mode disables interactions
  previewMode?: boolean;
}

// Helper to check if exit is available
export function hasExit(exits: Exit[], direction: string): boolean {
  return exits.filter(e => e.destination_id).some(e => e.direction === direction);
}

// Get condition text from movement points
export function getConditionText(mv: { current: number; max: number }): string {
  const ratio = mv.current / mv.max;
  if (ratio >= 1) return 'rested';
  if (ratio >= 0.75) return 'well';
  if (ratio >= 0.5) return 'tired';
  if (ratio >= 0.25) return 'weary';
  return 'exhausted';
}

// Get time of day text
export function getTimeOfDayText(phase?: string): string {
  if (!phase) return '';
  switch (phase) {
    case 'dawn': return 'Dawn';
    case 'day': return 'Day';
    case 'dusk': return 'Dusk';
    case 'night': return 'Night';
    default: return '';
  }
}
