/**
 * Audio module exports
 *
 * Usage:
 *   import { SoundProvider, useSound, useAmbientSound, SoundKeys } from '../audio';
 */

export { AudioManager } from './AudioManager';
export { SoundProvider, useSound, type SoundState, type SoundSettings } from './SoundContext';
export { useAmbientSound } from './useAmbientSound';
export { registerSoundAssets, SoundKeys } from './soundAssets';
