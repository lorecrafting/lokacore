/**
 * soundAssets - Maps server sound keys to bundled audio assets
 *
 * Sound keys from the server (defined in sound_mappings.yml) are mapped
 * to actual audio files bundled with the app.
 *
 * Add new sounds by:
 * 1. Adding the audio file to assets/audio/{category}/
 * 2. Adding the require() mapping here
 * 3. Adding the key to sound_mappings.yml on the server
 */

import { AudioManager } from './AudioManager';
import { AVPlaybackSource } from 'expo-av';

// Type for sound asset mapping
type SoundAssetMap = Record<string, AVPlaybackSource>;

/**
 * Ambient sounds - Biome/phase-based background audio
 *
 * These play as looping background ambience based on room tags and time phase.
 * Keys must match those in server/priv/world/config/sound_mappings.yml
 */
const AMBIENT_SOUNDS: SoundAssetMap = {
  // Monastery sounds
  temple_bells: require('../../assets/audio/ambient/temple_bells.mp3'),
  // temple_bells_distant: require('../../assets/audio/ambient/temple_bells_distant.mp3'),
  // monks_chanting_soft: require('../../assets/audio/ambient/monks_chanting_soft.mp3'),
  // morning_prayers: require('../../assets/audio/ambient/morning_prayers.mp3'),
  evening_gong: require('../../assets/audio/ambient/evening_gong.mp3'),
  // monastery_silence: require('../../assets/audio/ambient/monastery_silence.mp3'),
  // distant_chanting: require('../../assets/audio/ambient/distant_chanting.mp3'),

  // Outdoor sounds
  // birds_dawn_chorus: require('../../assets/audio/ambient/birds_dawn_chorus.mp3'),
  birds_occasional: require('../../assets/audio/ambient/birds_occasional.mp3'),
  wind_gentle: require('../../assets/audio/ambient/wind_gentle.mp3'),
  // wind_light: require('../../assets/audio/ambient/wind_light.mp3'),
  // wind_evening: require('../../assets/audio/ambient/wind_evening.mp3'),
  // wind_night: require('../../assets/audio/ambient/wind_night.mp3'),
  crickets: require('../../assets/audio/ambient/crickets.mp3'),
  // crickets_starting: require('../../assets/audio/ambient/crickets_starting.mp3'),
  // night_birds: require('../../assets/audio/ambient/night_birds.mp3'),

  // Forest sounds
  // forest_birds_dawn: require('../../assets/audio/ambient/forest_birds_dawn.mp3'),
  forest_ambient: require('../../assets/audio/ambient/forest_ambient.mp3'),
  // leaves_rustling: require('../../assets/audio/ambient/leaves_rustling.mp3'),
  // forest_dusk: require('../../assets/audio/ambient/forest_dusk.mp3'),
  // forest_night: require('../../assets/audio/ambient/forest_night.mp3'),
  // owls: require('../../assets/audio/ambient/owls.mp3'),

  // Mountain sounds
  // mountain_wind_dawn: require('../../assets/audio/ambient/mountain_wind_dawn.mp3'),
  // mountain_wind: require('../../assets/audio/ambient/mountain_wind.mp3'),
  // mountain_wind_dusk: require('../../assets/audio/ambient/mountain_wind_dusk.mp3'),
  // mountain_wind_night: require('../../assets/audio/ambient/mountain_wind_night.mp3'),
  // eagles_distant: require('../../assets/audio/ambient/eagles_distant.mp3'),

  // Cave sounds
  cave_drips: require('../../assets/audio/ambient/cave_drips.mp3'),
  cave_echo: require('../../assets/audio/ambient/cave_echo.mp3'),

  // Water sounds
  // stream_flowing: require('../../assets/audio/ambient/stream_flowing.mp3'),
  // water_ambient: require('../../assets/audio/ambient/water_ambient.mp3'),

  // Village sounds
  // village_bustle: require('../../assets/audio/ambient/village_bustle.mp3'),
  // voices_distant: require('../../assets/audio/ambient/voices_distant.mp3'),
  // village_evening: require('../../assets/audio/ambient/village_evening.mp3'),
  // village_quiet: require('../../assets/audio/ambient/village_quiet.mp3'),
  // dogs_distant: require('../../assets/audio/ambient/dogs_distant.mp3'),

  // Market sounds
  // market_crowd: require('../../assets/audio/ambient/market_crowd.mp3'),
  // vendors_calling: require('../../assets/audio/ambient/vendors_calling.mp3'),
  // market_closed: require('../../assets/audio/ambient/market_closed.mp3'),
  // wind_empty_stalls: require('../../assets/audio/ambient/wind_empty_stalls.mp3'),

  // Special sounds
  // room_tone: require('../../assets/audio/ambient/room_tone.mp3'),
  // peaceful_ambient: require('../../assets/audio/ambient/peaceful_ambient.mp3'),
  // ethereal_ambient: require('../../assets/audio/ambient/ethereal_ambient.mp3'),
  // bardo_whispers: require('../../assets/audio/ambient/bardo_whispers.mp3'),
};

/**
 * Weather sounds - Overlay sounds for weather conditions
 * Currently disabled - to be tweaked later
 */
const WEATHER_SOUNDS: SoundAssetMap = {
  // rain_light: require('../../assets/audio/weather/rain_light.mp3'),
  // rain_heavy: require('../../assets/audio/weather/rain_heavy.mp3'),
  // thunder_rumble: require('../../assets/audio/weather/thunder_rumble.mp3'),
  // fog_ambient: require('../../assets/audio/weather/fog_ambient.mp3'),
  // wind_muffled: require('../../assets/audio/weather/wind_muffled.mp3'),
  // snow_wind: require('../../assets/audio/weather/snow_wind.mp3'),
};

/**
 * Light source sounds - Sounds when player has a light source
 */
const LIGHT_SOUNDS: SoundAssetMap = {
  // torch_crackle: require('../../assets/audio/light/torch_crackle.mp3'),
};

/**
 * UI sounds - One-shot sounds for UI interactions
 *
 * These are triggered by the client, not from server state.
 */
const UI_SOUNDS: SoundAssetMap = {
  // modal_open: require('../../assets/audio/ui/modal_open.mp3'),
  // modal_close: require('../../assets/audio/ui/modal_close.mp3'),
  // button_tap: require('../../assets/audio/ui/button_tap.mp3'),
  // menu_select: require('../../assets/audio/ui/menu_select.mp3'),
  // notification: require('../../assets/audio/ui/notification.mp3'),
};

/**
 * Event sounds - One-shot sounds for game events
 *
 * These are triggered by channel events (combat, quests, etc.)
 */
const EVENT_SOUNDS: SoundAssetMap = {
  // combat_start: require('../../assets/audio/events/combat_start.mp3'),
  // combat_hit: require('../../assets/audio/events/combat_hit.mp3'),
  // combat_victory: require('../../assets/audio/events/combat_victory.mp3'),
  // combat_defeat: require('../../assets/audio/events/combat_defeat.mp3'),
  // dialogue_start: require('../../assets/audio/events/dialogue_start.mp3'),
  // quest_accepted: require('../../assets/audio/events/quest_accepted.mp3'),
  // quest_complete: require('../../assets/audio/events/quest_complete.mp3'),
  // item_pickup: require('../../assets/audio/events/item_pickup.mp3'),
  // item_equip: require('../../assets/audio/events/item_equip.mp3'),
  // level_up: require('../../assets/audio/events/level_up.mp3'),
};

/**
 * Transition sounds - One-shot sounds for phase transitions
 */
const TRANSITION_SOUNDS: SoundAssetMap = {
  // rooster_crow: require('../../assets/audio/events/rooster_crow.mp3'),
  // evening_bells: require('../../assets/audio/events/evening_bells.mp3'),
};

/**
 * Register all sound assets with the AudioManager
 *
 * Call this once during app initialization.
 */
export function registerSoundAssets(): void {
  AudioManager.registerAssets({
    ...AMBIENT_SOUNDS,
    ...WEATHER_SOUNDS,
    ...LIGHT_SOUNDS,
    ...UI_SOUNDS,
    ...EVENT_SOUNDS,
    ...TRANSITION_SOUNDS,
  });
}

/**
 * Sound key constants for type-safe access
 */
export const SoundKeys = {
  // UI sounds
  MODAL_OPEN: 'modal_open',
  MODAL_CLOSE: 'modal_close',
  BUTTON_TAP: 'button_tap',
  MENU_SELECT: 'menu_select',
  NOTIFICATION: 'notification',

  // Event sounds
  COMBAT_START: 'combat_start',
  COMBAT_HIT: 'combat_hit',
  COMBAT_VICTORY: 'combat_victory',
  COMBAT_DEFEAT: 'combat_defeat',
  DIALOGUE_START: 'dialogue_start',
  QUEST_ACCEPTED: 'quest_accepted',
  QUEST_COMPLETE: 'quest_complete',
  ITEM_PICKUP: 'item_pickup',
  ITEM_EQUIP: 'item_equip',
  LEVEL_UP: 'level_up',
} as const;
