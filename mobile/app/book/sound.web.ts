// The sound module in the browser (book-ui.md, Effects, sound and haptics; tokens.ts `mix`). A sound
// with no sample, locked or failing audio is silence, never a throw.
import { mix, motion, sound } from './tokens.ts';

type SoundName = keyof typeof sound;
type Bus = keyof typeof mix.bus;

// ponytail: no pitch spread (mix.spread) and a new element per play, so a load at each press; pitch
// spread and preload move to loka-gj82.8.
let urls: Partial<Record<SoundName, string[]>> = {};
const played: Partial<Record<SoundName, number>> = {};
/** Each name's samples, played round-robin (samples.web.ts). */
export const sources = (given: typeof urls) => {
  urls = given;
};

const busOf = (name: SoundName): Bus =>
  name === 'chapter' || name === 'fightIn' || name === 'fightLoop' || name === 'fightWon'
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
// suspends a running context. `ambience` and `music` are what ducking ramps; no bed plays yet.
let audio: { ctx: AudioContext; ambience: GainNode; music: GainNode } | undefined;
const unlock = () => {
  try {
    if (!audio) {
      const ctx = new AudioContext();
      const ambience = ctx.createGain();
      ambience.connect(ctx.destination);
      const music = ctx.createGain();
      music.connect(ctx.destination);
      audio = { ctx, ambience, music };
      if (inFight) loop(); // a fight reopened before the first gesture
    }
    if (audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
  } catch {} // no audio in this browser
};
for (const gesture of ['pointerup', 'touchend', 'keydown'])
  globalThis.addEventListener?.(gesture, unlock);

let ducking = 0;
const ramp = (node: GainNode, to: number, ms: number) => {
  const now = audio!.ctx.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(to, now + ms / 1000);
};
const duck = (on: boolean) => {
  const ms = on ? mix.duck.duration : mix.duck.out;
  ramp(audio!.ambience, amp(on ? mix.duck.db : 0), ms);
  ramp(audio!.music, amp(on ? mix.dip.db : 0), ms);
};

export const play = (name: SoundName) => start(name);

function start(name: SoundName, opts: { loop?: boolean; then?: () => void } = {}) {
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
    level.connect(bus === 'music' ? audio.music : audio.ctx.destination);
    if (bus === 'music') tune = level;
    if (voices.length >= mix.bus[bus]) voices[0]!(); // the oldest is stolen, once its heir exists
    const ducks = bus === 'sfx' && sound[name].tier === 'beat';
    const stop = () => {
      const at = voices.indexOf(stop);
      if (at < 0) return;
      voices.splice(at, 1);
      el.pause();
      node.disconnect();
      level.disconnect();
      if (ducks && --ducking === 0) duck(false);
    };
    voices.push(stop);
    if (ducks && ducking++ === 0) duck(true);
    el.loop = !!opts.loop;
    el.onended = el.onerror = () => {
      stop();
      opts.then?.();
    };
    void el.play().catch(stop);
  } catch {} // a browser refusing the element is silence too
}

// A fight's music (book-ui.md, Fight music): one voice on the music bus, with a stinger into a loop.
// ponytail: a chapter card during a fight steals the loop for good; no chapter opens mid-fight today.
// Beds return here over motion.palette once a bed plays through `ambience` (no bed exists yet).
let inFight = false;
let lastFight = -Infinity;
let tune: GainNode | undefined; // the music voice's level, for its fade
let fading: ReturnType<typeof setTimeout> | undefined;
const loop = () => start('fightLoop', { loop: true });
const stopAll = (bus: Bus) => {
  for (const stop of [...live[bus]]) stop();
};
const fade = (ms: number, then?: () => void) => {
  const stop = live.music[0];
  if (!stop) return then?.();
  ramp(tune!, 0, ms);
  fading = setTimeout(() => {
    stop();
    then?.();
  }, ms);
};

/** `open`: a new fight. `resume`: one found on reopening. `won`, `away`, `cut`: how it ended. */
export function fight(event: 'open' | 'resume' | 'won' | 'away' | 'cut') {
  const now = performance.now();
  clearTimeout(fading);
  if (event === 'open' || event === 'resume') {
    inFight = true;
    stopAll('ambience');
    if (event === 'resume' || now - lastFight < sound.fightLoop.gap) loop();
    else start('fightIn', { then: () => inFight && loop() });
    return;
  }
  inFight = false;
  lastFight = now;
  if (event === 'won') fade(motion.quick.duration, () => play('fightWon'));
  else if (event === 'away') fade(motion.palette.duration);
  else {
    stopAll('music');
    stopAll('ambience');
  }
}

/** Sound or Music off (book-ui.md, Settings): what plays stops and nothing new starts. */
export function setMuted(group: 'sound' | 'music', on: boolean) {
  muted[group] = on;
  if (!on && group === 'music' && inFight && !live.music.length) loop();
  if (!on) return;
  for (const bus of Object.keys(live) as Bus[])
    if (groupOf(bus) === group) for (const stop of [...live[bus]]) stop();
}
