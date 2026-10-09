// Loka picker, the manager's state and actions (design input sections 1 to 3): the addon state
// holds Pick on/off, the pending picks and the polled feed, so the tool, the tab title and the
// panel share it; the preview (overlay.ts) only draws and reports.
import { PREVIEW_KEYDOWN, STORY_CHANGED } from 'storybook/internal/core-events';
import { addons, type API } from 'storybook/manager-api';
import {
  ADDON_ID,
  PANEL_ID,
  PICK,
  PIN,
  PINS,
  READY,
  ROUTE,
  SHOT,
  type Feed,
  type Picked,
} from './events.ts';

export type State = {
  on: boolean;
  pending: Picked[];
  feed: Feed | null;
  denied: boolean; // the queue answered 403: not a loopback request (storybook:lan on a phone)
  focus: number;
};
export const initial: State = { on: false, pending: [], feed: null, denied: false, focus: 0 };
let api: API;
const update = (f: (s: State) => Partial<State>) =>
  api.setAddonState<State>(ADDON_ID, (s = initial) => ({ ...s, ...f(s) }));
const channel = () => addons.getChannel();
const pins = (pending: Picked[]) => channel().emit(PINS, { keys: pending.map((p) => p.key) });

export const toggle = (on: boolean) => {
  void update(() => ({ on }));
  channel().emit(PICK, { on });
  if (on) {
    api.togglePanel(true);
    api.setSelectedPanel(PANEL_ID);
  }
};
// A key already pending unpins; shift adds up to four; a plain click replaces.
export const pin = ({ element, add }: { element: Picked; add: boolean }) =>
  update(({ pending, focus }) => {
    const rest = pending.filter((p) => p.key !== element.key);
    const next =
      rest.length < pending.length ? rest : add ? [...pending, element].slice(0, 4) : [element];
    pins(next);
    return { pending: next, focus: focus + 1 };
  });
export const clear = () => {
  pins([]);
  void update(() => ({ pending: [] }));
};

const post = (body: object) =>
  fetch(`${ROUTE}/picks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
export const poll = async () => {
  const r = await fetch(`${ROUTE}/status`).catch(() => null);
  const feed = r?.ok ? ((await r.json()) as Feed) : null;
  void update(() => ({ feed, denied: r?.status === 403 }));
};
// Null when the queue took it; else why not (the composer keeps the text and pins).
export const send = async (note: string, pending: Picked[]): Promise<string | null> => {
  const { id, title, name } = api.getCurrentStoryData() as {
    id: string;
    title: string;
    name: string;
  };
  const globals = api.getGlobals() as { palette?: string; viewport?: { value?: string } };
  const options = api.getCurrentParameter<{
    options?: Record<string, { name: string; styles: { width: string; height: string } }>;
  }>('viewport')?.options;
  const v = globals.viewport?.value ? options?.[globals.viewport.value] : undefined;
  const r = await post({
    note,
    story: { id, title: `${title}/${name}` },
    palette: globals.palette ?? null,
    viewport: v ? { name: v.name, ...v.styles } : null,
    elements: pending,
  }).catch((e: Error) => e);
  if (r instanceof Error) return r.message;
  if (!r.ok) return `${r.status} ${await r.text().catch(() => '')}`.trim();
  clear();
  await poll();
  return null;
};
export const event = async (type: 'close' | 'keep-going') => {
  await post({ type });
  await poll();
};

const key = (e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const { on, pending } = api.getAddonState<State>(ADDON_ID) ?? initial;
  if (e.key === 'p' || e.key === 'P') toggle(!on);
  else if (e.key === 'Escape' && pending.length)
    clear(); // a second Esc leaves Pick
  else if (e.key === 'Escape' && on) toggle(false);
};

// Once, from addons.register.
export const init = (a: API) => {
  api = a;
  channel().on(PIN, pin);
  channel().on(READY, () =>
    channel().emit(PICK, { on: (api.getAddonState<State>(ADDON_ID) ?? initial).on }),
  );
  channel().on(STORY_CHANGED, clear); // pinned nodes are gone with the story
  channel().on(SHOT, ({ key, png }: { key: string; png: string | null }) =>
    update(({ pending }) => ({ pending: pending.map((p) => (p.key === key ? { ...p, png } : p)) })),
  );
  // The preview forwards keys outside inputs; the manager's own document too (the panel's textarea
  // handles its own keys).
  channel().on(PREVIEW_KEYDOWN, ({ event }: { event: Parameters<typeof key>[0] }) => key(event));
  document.addEventListener('keydown', (e) => {
    if (!(e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) key(e);
  });
  void poll();
  setInterval(() => void poll(), 1500);
};
