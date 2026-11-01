// The sound module in the browser (book-ui.md, Effects, sound and haptics; tokens.ts `mix`). A sound
// with no sample, locked or failing audio is silence, never a throw.
import { mix, motion, sound } from './tokens.ts';

type SoundName = keyof typeof sound;
type Bus = keyof typeof mix.bus;
type RoomFiles = { beds?: Record<string, string>; pieces?: Record<string, string> };

let urls: Partial<Record<SoundName, string[]>> = {};
let rooms: RoomFiles = {};
const played: Partial<Record<SoundName, number>> = {};
/** Each name's samples, played round-robin, and each room tag's files (samples.web.ts). */
export const sources = (given: typeof urls, room: RoomFiles = {}) => {
  urls = given;
  rooms = room;
};

const busOf = (name: SoundName): Bus =>
  name === 'bed' || name === 'weather'
    ? 'ambience'
    : name === 'chapter' ||
        name === 'explore' ||
        name === 'fightIn' ||
        name === 'fightLoop' ||
        name === 'fightWon'
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
// suspends a running context. `ambience` and `music` are what ducking ramps.
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
      const cached = [...Object.values(urls).flat(), ...Object.values(rooms.beds ?? {})]; // no load at a press; pieces stream
      for (const file of cached) void globalThis.fetch?.(file).catch(() => {});
      if (inFight) loop(); // a fight reopened before the first gesture
      settleRoom(motion.bed.fade);
      if (room && !inFight) explore(room.tag);
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
// What the beds sit at now: under a blow or the chapter theme, else under an exploration piece.
const bedsAt = () =>
  amp(
    ducking || heard === 'chapter' ? mix.duck.db : heard === 'explore' ? mix.bedUnderMusic.db : 0,
  );
const duck = (on: boolean) => {
  const ms = on ? mix.duck.duration : mix.duck.out;
  ramp(audio!.ambience, bedsAt(), ms);
  ramp(audio!.music, amp(on ? mix.dip.db : 0), ms);
};

export const play = (name: SoundName) => start(name);

type Voice = { stop: () => void; level: GainNode };
type VoiceOpts = {
  loop?: boolean;
  then?: () => void;
  fadeIn?: number; // ms, from silence
  muffled?: boolean; // through mix.muffle
};

function start(name: SoundName, opts: VoiceOpts = {}) {
  const files = urls[name];
  if (!files?.length) return;
  const turn = played[name] ?? 0;
  played[name] = turn + 1;
  return voice(name, files[turn % files.length]!, opts);
}

/** A source's way out: an optional muffle, its own gain (not el.volume: iOS Safari ignores it), its bus. */
function wire(node: AudioNode, bus: Bus, muffled?: boolean) {
  const { ctx, music, ambience } = audio!;
  const level = ctx.createGain();
  let tail = node;
  if (muffled) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mix.muffle.hz;
    node.connect(filter);
    tail = filter;
  }
  tail.connect(level);
  level.connect(bus === 'music' ? music : bus === 'ambience' ? ambience : ctx.destination);
  if (bus === 'music') tune = level;
  return level;
}

const dbOf = (name: SoundName, muffled?: boolean) =>
  amp(mix.tier[sound[name].tier as keyof typeof mix.tier] + (muffled ? mix.muffle.db : 0));

function lowerBeds(name: 'chapter' | 'explore') {
  heard = name;
  ramp(audio!.ambience, bedsAt(), mix.duck.duration);
}

function raiseBeds() {
  heard = undefined;
  ramp(audio!.ambience, bedsAt(), mix.duck.out);
}

/** A cut plays into the next page and fades as it ends (book-ui.md, Chapters). */
function fadeOutLast(el: HTMLAudioElement, level: GainNode, alive: () => boolean) {
  el.onloadedmetadata = () => {
    const tail = motion.palette.duration;
    setTimeout(() => alive() && ramp(level, 0, tail), el.duration * 1000 - tail);
  };
}

/** A repeat is never the same take. */
function spread(el: HTMLAudioElement) {
  el.preservesPitch = false;
  el.playbackRate = 1 + (Math.random() * 2 - 1) * mix.spread;
}

function voice(name: SoundName, file: string, opts: VoiceOpts): Voice | undefined {
  const bus = busOf(name);
  if (!audio || muted[groupOf(bus)]) return;
  try {
    const voices = live[bus];
    const el = new Audio(file);
    const node = audio.ctx.createMediaElementSource(el);
    const db = dbOf(name, opts.muffled);
    const level = wire(node, bus, opts.muffled);
    level.gain.value = opts.fadeIn ? 0 : db;
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
      if (bus === 'music') raiseBeds();
    };
    voices.push(stop);
    if (ducks && ducking++ === 0) duck(true);
    if (opts.fadeIn) ramp(level, db, opts.fadeIn);
    if (name === 'chapter' || name === 'explore') lowerBeds(name);
    if (name === 'chapter') fadeOutLast(el, level, () => voices.includes(stop));
    if (bus !== 'music' && bus !== 'ambience') spread(el);
    el.loop = !!opts.loop;
    // Refused or failed, it still leads on; stolen, the thief owns the bus and nothing follows.
    const done = () => {
      if (!voices.includes(stop)) return;
      stop();
      opts.then?.();
    };
    el.onended = el.onerror = done;
    void el.play().catch(done);
    return { stop, level };
  } catch {} // a browser refusing the element is silence too
}

// A room's sound (book-ui.md, Beds; Storm): one bed by tag, one weather layer, each cross-fading on a
// change, and an exploration piece on entering a tag new since launch. Nothing while a fight plays,
// in the background, or with Sound off. A tag with no file plays `wild`; no `wild` is silence.
type Held = { key: string; voice: Voice };
type Room = { tag: string; weather?: string; exposed: boolean };
let room: Room | undefined;
let bed: Held | undefined;
let layer: Held | undefined;
const entered = new Set<string>();
let lastPiece = -Infinity;
let heard: 'chapter' | 'explore' | undefined;

function hold(
  was: Held | undefined,
  name: 'bed' | 'weather',
  file: string | undefined,
  muffled: boolean,
  ms: number,
): Held | undefined {
  const key = file && `${file}|${muffled}`;
  if (was?.key === key && was && live.ambience.includes(was.voice.stop)) return was;
  if (was) {
    ramp(was.voice.level, 0, ms);
    setTimeout(was.voice.stop, ms);
  }
  const voice_ = file ? voice(name, file, { loop: true, fadeIn: ms, muffled }) : undefined;
  return voice_ && { key: key!, voice: voice_ };
}

function settleRoom(ms: number) {
  if (!audio || !room) return;
  if (inFight || muted.sound || globalThis.document?.hidden) {
    stopAll('ambience');
    bed = layer = undefined;
    return;
  }
  const beds = rooms.beds ?? {};
  bed = hold(bed, 'bed', beds[room.tag] ?? beds.wild, false, ms);
  const rain = room.weather ? urls.weather?.[0] : undefined;
  layer = hold(layer, 'weather', rain, !room.exposed, ms);
}

function explore(tag: string) {
  const piece = rooms.pieces?.[tag];
  const now = performance.now();
  if (!audio || entered.has(tag)) return;
  entered.add(tag);
  if (!piece || live.music.length || now - lastPiece < sound.explore.gap) return;
  if (globalThis.document?.hidden) return;
  if (voice('explore', piece, {})) lastPiece = now;
}

const audible = ['rain', 'wind', 'storm'];
/** The room the Book is on: its bed tag, the weather phase that sounds (rain, wind, storm), exposed. */
export function ambience(tag: string | undefined, weather: string | undefined, exposed: boolean) {
  room = { tag: tag || 'wild', weather: audible.includes(weather!) ? weather : undefined, exposed };
  settleRoom(motion.bed.fade);
  if (!inFight) explore(room.tag);
}
globalThis.document?.addEventListener?.('visibilitychange', () => settleRoom(motion.bed.fade));

/** Storm's thunder, on the sfx bus; through mix.muffle when the room is not exposed. */
export const thunder = (muffled: boolean) => start('thunder', { muffled });

// A fight's music (book-ui.md, Fight music): one voice on the music bus, with a stinger into a loop.
// ponytail: a chapter card during a fight steals the loop for good; no chapter opens mid-fight today.
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
    if (live.music[0] !== stop) return; // a new voice took the bus: it keeps it (a chapter's theme)
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
    bed = layer = undefined;
    if (event === 'resume' || now - lastFight < sound.fightLoop.gap) loop();
    else start('fightIn', { then: () => inFight && loop() });
    return;
  }
  if (inFight) lastFight = now; // a close with no fight playing opens no gap
  inFight = false;
  if (event === 'won') fade(motion.quick.duration, () => play('fightWon'));
  else if (event === 'away') fade(motion.palette.duration);
  else {
    stopAll('music');
    stopAll('ambience');
    bed = layer = room = undefined; // nothing, not a return to the tab or Sound on, restarts it
    return;
  }
  settleRoom(motion.palette.duration);
}

/** Sound or Music off (book-ui.md, Settings): what plays stops and nothing new starts. */
export function setMuted(group: 'sound' | 'music', on: boolean) {
  muted[group] = on;
  if (!on && group === 'music' && inFight && !live.music.length) loop();
  if (!on && group === 'sound') settleRoom(motion.bed.fade);
  if (!on) return;
  for (const bus of Object.keys(live) as Bus[])
    if (groupOf(bus) === group) for (const stop of [...live[bus]]) stop();
}
