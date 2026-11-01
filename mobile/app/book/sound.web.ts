// The sound module in the browser (book-ui.md, Effects, sound and haptics; tokens.ts `mix`). A sound
// with no sample, locked or failing audio is silence, never a throw.
import { mix, sound } from './tokens.ts';

type SoundName = keyof typeof sound;
type Bus = keyof typeof mix.bus;

// ponytail: no pitch spread (mix.spread) and a new element per play, so a load at each press, until
// the samples are auditioned (loka-gj82.4).
let urls: Partial<Record<SoundName, string[]>> = {};
const played: Partial<Record<SoundName, number>> = {};
/** Each name's samples, played round-robin (samples.web.ts). */
export const sources = (given: typeof urls) => {
  urls = given;
};

const busOf = (name: SoundName): Bus =>
  name === 'chapter'
    ? 'music'
    : name === 'pageTurn' || name === 'pickup' || name === 'tick'
      ? 'ui'
      : 'sfx';
const live: Record<Bus, (() => void)[]> = { ambience: [], sfx: [], ui: [], music: [] };
const muted = { sound: false, music: false };
const groupOf = (bus: Bus) => (bus === 'music' ? 'music' : 'sound');
const amp = (db: number) => 10 ** (db / 20);

// Made on the first gesture: until then the browser has locked audio and a sound is dropped. Every
// later gesture resumes it too: a touch's press-in does not count as activation, and a phone call
// suspends a running context. `ambience` is what ducking ramps; no bed plays through it yet.
let audio: { ctx: AudioContext; ambience: GainNode } | undefined;
const unlock = () => {
  try {
    if (!audio) {
      const ctx = new AudioContext();
      const ambience = ctx.createGain();
      ambience.connect(ctx.destination);
      audio = { ctx, ambience };
    }
    if (audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
  } catch {} // no audio in this browser
};
for (const gesture of ['pointerup', 'touchend', 'keydown'])
  globalThis.addEventListener?.(gesture, unlock);

let ducking = 0;
const duck = (db: number, ms: number) => {
  const { ctx, ambience } = audio!;
  const now = ctx.currentTime;
  ambience.gain.cancelScheduledValues(now);
  ambience.gain.setValueAtTime(ambience.gain.value, now);
  ambience.gain.linearRampToValueAtTime(amp(db), now + ms / 1000);
};

export function play(name: SoundName) {
  const files = urls[name];
  const bus = busOf(name);
  if (!audio || !files?.length || muted[groupOf(bus)]) return;
  const turn = played[name] ?? 0;
  played[name] = turn + 1;
  try {
    const voices = live[bus];
    const el = new Audio(files[turn % files.length]);
    const node = audio.ctx.createMediaElementSource(el);
    const level = audio.ctx.createGain(); // not el.volume: iOS Safari ignores it
    level.gain.value = amp(mix.tier[sound[name].tier as keyof typeof mix.tier]);
    node.connect(level);
    level.connect(audio.ctx.destination);
    if (voices.length >= mix.bus[bus]) voices[0]!(); // the oldest is stolen, once its heir exists
    const ducks = bus === 'sfx' && sound[name].tier === 'beat';
    const stop = () => {
      const at = voices.indexOf(stop);
      if (at < 0) return;
      voices.splice(at, 1);
      el.pause();
      node.disconnect();
      level.disconnect();
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
