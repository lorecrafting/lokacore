// The sound module in the browser (book-ui.md, Effects, sound and haptics; tokens.ts `mix`). A sound
// with no sample, locked or failing audio is silence, never a throw.
import { mix, sound } from './tokens.ts';

type SoundName = keyof typeof sound;
type Bus = keyof typeof mix.bus;

// ponytail: one sample per name, no variants or pitch spread until the files land (loka-gj82.4).
let urls: Partial<Record<SoundName, string>> = {};
/** The samples; the manifest fills them (loka-p2s8). */
export const sources = (given: typeof urls) => {
  urls = given;
};

const busOf = (name: SoundName): Bus =>
  name === 'chapter' ? 'music' : name === 'pageTurn' ? 'ui' : 'sfx';
const live: Record<Bus, (() => void)[]> = { ambience: [], sfx: [], ui: [], music: [] };
const muted = { sound: false, music: false };
const groupOf = (bus: Bus) => (bus === 'music' ? 'music' : 'sound');
const amp = (db: number) => 10 ** (db / 20);

// Made on the first gesture: until then the browser has locked audio and a sound is dropped.
let audio: { ctx: AudioContext; ambience: GainNode } | undefined;
const unlock = () => {
  try {
    if (audio) return;
    const ctx = new AudioContext();
    const ambience = ctx.createGain();
    ambience.connect(ctx.destination);
    audio = { ctx, ambience };
    void ctx.resume();
  } catch {} // no audio in this browser
};
for (const gesture of ['pointerdown', 'keydown'])
  globalThis.addEventListener?.(gesture, unlock, { once: true });

let ducking = 0;
const duck = (db: number, ms: number) => {
  const { ctx, ambience } = audio!;
  const now = ctx.currentTime;
  ambience.gain.cancelScheduledValues(now);
  ambience.gain.setValueAtTime(ambience.gain.value, now);
  ambience.gain.linearRampToValueAtTime(amp(db), now + ms / 1000);
};

export function play(name: SoundName) {
  const url = urls[name];
  const bus = busOf(name);
  if (!audio || !url || muted[groupOf(bus)]) return;
  try {
    const voices = live[bus];
    if (voices.length >= mix.bus[bus]) voices[0]!(); // the oldest is stolen
    const el = new Audio(url);
    el.volume = amp(mix.tier[sound[name].tier as keyof typeof mix.tier]);
    const node = audio.ctx.createMediaElementSource(el);
    node.connect(bus === 'ambience' ? audio.ambience : audio.ctx.destination);
    const ducks = bus === 'sfx' && sound[name].tier === 'beat';
    const stop = () => {
      const at = voices.indexOf(stop);
      if (at < 0) return;
      voices.splice(at, 1);
      el.pause();
      node.disconnect();
      if (ducks && --ducking === 0) duck(0, mix.duck.out);
    };
    voices.push(stop);
    if (ducks && ducking++ === 0) duck(mix.duck.db, mix.duck.duration);
    el.onended = el.onerror = stop;
    void el.play().catch(stop);
  } catch {} // a browser refusing the element is silence too
}

/** Sound or Music off (book-ui.md, Settings): what plays stops and nothing new starts. */
export function setMuted(group: 'sound' | 'music', on: boolean) {
  muted[group] = on;
  if (!on) return;
  for (const bus of Object.keys(live) as Bus[])
    if (groupOf(bus) === group) for (const stop of [...live[bus]]) stop();
}
