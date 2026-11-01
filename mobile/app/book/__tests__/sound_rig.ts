// A fake browser for the browser sound module (the audio device is external).
type El = {
  url: string;
  paused: boolean;
  onended?: () => void;
  onerror?: () => void;
};

// A module instance and browser of its own for each test: the module's state is per page.
let page = 0;
export async function browser(opts: { refuse?: boolean; noAudio?: boolean } = {}) {
  const els: El[] = [];
  const ramps: [number, number][] = [];
  const levels: { value: number }[] = [];
  const wired: object[] = [];
  const gains: object[] = [];
  const filters: { type: string; frequency: { value: number } }[] = [];
  let resumes = 0;
  const listeners: Record<string, () => void> = {};
  Object.assign(globalThis, {
    addEventListener: (type: string, f: () => void) => (listeners[type] = f),
    AudioContext: class {
      constructor() {
        if (opts.noAudio) throw new Error('no audio');
      }
      currentTime = 10;
      destination = {};
      state = 'suspended';
      resume = async () => {
        resumes++;
      };
      createGain = () => {
        const gain = {
          value: 1,
          cancelScheduledValues: () => {},
          setValueAtTime: () => {},
          linearRampToValueAtTime: (v: number, t: number) => ramps.push([v, t]),
        };
        levels.push(gain);
        const node = { connect: (to: object) => wired.push(to), disconnect: () => {}, gain };
        gains.push(node);
        return node;
      };
      createMediaElementSource = () => ({ connect: () => {}, disconnect: () => {} });
      createBiquadFilter = () => {
        const filter = { type: '', frequency: { value: 0 }, connect: () => {} };
        filters.push(filter);
        return filter;
      };
    },
    Audio: class implements El {
      paused = false;
      loop = false;
      onended?: () => void;
      onerror?: () => void;
      url: string;
      constructor(url: string) {
        this.url = url;
        els.push(this);
      }
      pause() {
        this.paused = true;
      }
      play = () => (opts.refuse ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve());
    },
  });
  const mod: typeof import('../sound.web.ts') = await import(`../sound.web.ts?page=${page++}`);
  mod.sources(
    {
      blow: ['blow.m4a'],
      coin: ['coin.m4a'],
      pageTurn: ['turn.m4a', 'turn2.m4a'],
      pickup: ['flick.m4a'],
      tick: ['tick.m4a'],
      chapter: ['theme.m4a'],
      fightIn: ['in.m4a'],
      fightLoop: ['loop.m4a'],
      fightWon: ['won.m4a'],
      thunder: ['thunder.m4a'],
      weather: ['rain.m4a'],
    },
    {
      beds: { inn: 'inn.m4a', wild: 'wild.m4a', cave: 'cave.m4a' },
      pieces: { inn: 'p-inn.m4a', cave: 'p-cave.m4a' },
    },
  );
  return {
    ...mod,
    filters,
    els,
    ramps,
    levels,
    wired,
    gains,
    resumes: () => resumes,
    gesture: (kind = 'pointerup') => listeners[kind]!(),
  };
}
