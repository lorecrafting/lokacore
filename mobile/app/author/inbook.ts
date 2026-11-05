// E5, prose in the Book (docs/design/prose-in-the-book-rulings.md): a double-click turns a line
// into its field, Cmd-Z puts back, `]`/`[` walk the `~` lines. Drawn over the Book from here:
// panel.tsx requires this only in the author preview, so a player build never holds it.
import { size, space, type } from '../book/tokens.ts';
import type { Message } from './live.ts';
import {
  noFieldNote,
  oneLine,
  paletteNear,
  saving,
  step,
  textField,
  unwritten,
  walk,
} from './prose_rules.ts';

export { tagged } from './prose_rules.ts';
type Hooks = {
  seen: Map<string, string>;
  said: Map<string, string>;
  tell: (sent: object) => void;
  redraw: () => void;
};
type At = { file: string; line: number; was: string; words: string };
type Field = { el: HTMLElement; kept: Node[]; shown: string; key: string; at: At; busy?: boolean };

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const label = `${type.label.fontSize}px/${type.label.lineHeight}px ${type.label.fontFamily}`;
const CSS = `
[data-loka-todo]{position:relative}
[data-loka-todo]::before{content:"";position:absolute;left:-${space.lg}px;top:0;bottom:0;width:${size.speechBar}px;background:var(--loka-warning)}
[data-loka-landed]::before{background:var(--loka-action)}
[data-loka-landed],[data-loka-field]{outline:${size.focus}px solid var(--loka-action);outline-offset:${size.focus}px}
[data-loka-field]{background:var(--loka-card);color:var(--loka-fg);caret-color:var(--loka-action)}
[data-loka-unconfirmed]{text-decoration:underline wavy var(--loka-warning)}
[data-loka-a11y]::after{content:", " attr(data-loka-a11y);position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.loka-note{position:absolute;font:${label};letter-spacing:${type.label.letterSpacing}px;color:var(--loka-dim);z-index:10}
.loka-note[data-warn]{color:var(--loka-warning)}
.loka-note button{font:inherit;color:var(--loka-action);background:none;border:0;padding:0 ${space.md}px 0 0;cursor:pointer}`;

const enc = encodeURIComponent;
async function api(path: string, sent?: object): Promise<[number, any]> {
  const init = sent && { method: 'POST', body: JSON.stringify(sent) };
  const r = await fetch(`/__author${path}`, init);
  return [r.status, await r.json().catch(() => null)];
}
const typing = (t: EventTarget | null) => t instanceof HTMLElement && textField(t);

// One editor per page: its state lives here, set by start().
let hooks: Hooks = { seen: new Map(), said: new Map(), tell: () => {}, redraw: () => {} };
const edits: { id: number; at: string; file: string; key: string; words: string }[] = []; // this page's /edit answers
let unconfirmed = new Set<string>();
let field: Field | undefined;
let opening = false; // a /line in flight: a second double-click opens nothing
let landed: HTMLElement | undefined;
let counted = '';
let note: HTMLDivElement;
const observer =
  typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(reapply);
const watch = () =>
  observer?.observe(document.body, { childList: true, subtree: true, characterData: true });

const lines = () =>
  [...document.querySelectorAll<HTMLElement>('[dir="auto"]')].filter((el) =>
    hooks.seen.has(el.textContent ?? ''),
  );

/** Writes `text` (and any buttons) under `el`; empty hides it. */
function say(
  el: HTMLElement | undefined,
  text = '',
  warn = false,
  buttons: [string, () => void][] = [],
) {
  note.replaceChildren(text, ...buttons.map(([name, run]) => button(name, run)));
  note.toggleAttribute('data-warn', warn);
  note.hidden = !el || !text;
  if (!el) return;
  const r = el.getBoundingClientRect();
  Object.assign(note.style, { left: `${r.left + scrollX}px`, top: `${r.bottom + scrollY}px` });
}
const button = (name: string, run: () => void) => {
  const b = document.createElement('button');
  b.textContent = name;
  b.onmousedown = (e) => e.preventDefault(); // the field keeps the focus, so no blur saves
  b.onclick = run;
  return b;
};
const open = (key: string, words: string) => void api('/open', { key, words });

/** The marks, after every Book render: `~` bars, unconfirmed lines, the palette, the counts. */
function reapply() {
  const all = lines();
  const p = paletteNear(paper(all[0] ?? document.body));
  for (const [role, ink] of Object.entries(p))
    document.documentElement.style.setProperty(`--loka-${role}`, ink);
  const todo = all.filter((el) => unwritten(el.textContent!));
  for (const el of all) {
    const marks = [
      unconfirmed.has(hooks.seen.get(el.textContent!)!) && 'unconfirmed',
      todo.includes(el) && 'still to write',
    ].filter(Boolean);
    el.toggleAttribute('data-loka-todo', todo.includes(el));
    el.toggleAttribute('data-loka-unconfirmed', marks.includes('unconfirmed'));
    if (marks.length) el.setAttribute('data-loka-a11y', marks.join(', '));
    else el.removeAttribute('data-loka-a11y');
  }
  if (landed && !landed.isConnected) landed = undefined;
  const counts = JSON.stringify({ here: todo.length, at: landed ? todo.indexOf(landed) + 1 : 0 });
  if (counts !== counted) hooks.tell({ todoHere: JSON.parse((counted = counts)) });
}
async function openField(el: HTMLElement) {
  const key = hooks.seen.get(el.textContent ?? '');
  if (!key || field || opening) return say(el, key ? '' : noFieldNote(undefined));
  opening = true;
  const [status, at] = await api(
    `/line?key=${enc(key)}&words=${enc(hooks.said.get(key) ?? '')}`,
  ).finally(() => (opening = false));
  if (status !== 200) return say(el, noFieldNote(key, typeof at === 'string' ? at : undefined));
  field = { el, kept: [...el.childNodes], shown: el.textContent!, key, at }; // as drawn (a `~`'s marks too): React rewrites a change
  observer?.disconnect(); // the field is not a Book render
  el.replaceChildren(at.words);
  el.contentEditable = 'plaintext-only';
  el.setAttribute('data-loka-field', '');
  el.focus();
  getSelection()?.selectAllChildren(el);
  getSelection()?.collapseToEnd();
  el.addEventListener('keydown', onFieldKey);
  el.addEventListener('beforeinput', onInput);
  el.addEventListener('blur', onBlur);
  caption();
}
const caption = () =>
  field && say(field.el, `${field.at.file}:${field.at.line}  Enter saves · Esc cancels`);
function close() {
  const { el, kept } = field!; // every caller holds the open field
  const had = document.activeElement === el; // not when a blur saved: focus stays where it went
  field = undefined;
  el.removeEventListener('keydown', onFieldKey);
  el.removeEventListener('beforeinput', onInput);
  el.removeEventListener('blur', onBlur);
  el.replaceChildren(...kept); // React's own nodes, so its next render finds them
  el.removeAttribute('contenteditable');
  el.removeAttribute('data-loka-field');
  el.tabIndex = -1;
  if (had) el.focus();
  say(undefined);
  watch();
  reapply();
  hooks.redraw(); // the words it held back while open
}
function onFieldKey(e: KeyboardEvent) {
  e.stopPropagation(); // the Book's keys are not the field's
  if (e.key === 'Escape') close();
  if (e.key !== 'Enter') return;
  e.preventDefault(); // one line: Enter saves, Shift-Enter does nothing
  if (!e.shiftKey) void save();
}
function onInput(e: InputEvent) {
  if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') e.preventDefault();
  const text = e.dataTransfer?.getData('text/plain') ?? e.data;
  if (e.inputType === 'insertFromPaste' && text && oneLine(text) !== text) {
    e.preventDefault();
    document.execCommand('insertText', false, oneLine(text));
  }
}
const onBlur = () => void save();

async function save() {
  if (!field || field.busy) return;
  const f = field;
  const draft = oneLine(f.el.textContent ?? '');
  const choice = saving(draft, f.at.words);
  if (choice === 'unchanged') return close();
  if (choice === 'empty') return say(f.el, 'Empty. Write ~ to leave it unwritten.');
  f.busy = true;
  const { file, line, was } = f.at;
  const [status, answer] = await api('/edit', { file, line, was, words: draft, key: f.key });
  f.busy = false;
  if (status === 200)
    edits.push({ id: answer.id, at: `${file}:${line}`, file, key: f.key, words: draft });
  if (field !== f) return; // closed (Esc), or another line opened, while it saved
  if (status === 200) return close();
  if (status === 409) return conflict(f);
  say(f.el, typeof answer === 'string' ? answer : `Not saved (${status}).`, true);
}
/** The disk's line differs from the field's: theirs, Keep mine, Take theirs; or Open source. */
async function conflict(f: Field) {
  const [status, theirs] = await api(`/line?key=${enc(f.key)}&words=${enc(f.at.words)}`);
  if (field !== f) return;
  if (status !== 200)
    return say(f.el, 'Changed on disk since you opened it.', true, [
      ['Open source', () => open(f.key, f.at.words)],
    ]);
  say(f.el, `Changed on disk since you opened it. ${theirs.words}`, true, [
    ['Keep mine', () => ((f.at = { ...theirs, words: '' }), void save())],
    ['Take theirs', close],
  ]);
}

async function putBack() {
  const last = edits.pop();
  if (!last) return hooks.tell({ note: 'Nothing of yours to put back.' });
  const [status] = await api('/undo', { id: last.id });
  if (status === 200) return hooks.tell({ note: `put back ${last.at}` });
  hooks.tell({
    note: `${last.file} changed since; not put back.`,
    open: { key: last.key, words: last.words },
  });
}
/** A Book key outside any field: walk, Enter on the landed line, Cmd-Z. */
function onKey(e: KeyboardEvent, inField = typing(e.target), relayed = false) {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z' && !inField) {
    e.preventDefault?.();
    return void putBack();
  }
  const onLanded = relayed || e.target === document.body || e.target === landed; // not a choice's Enter
  if (e.key === 'Enter' && landed && !inField && onLanded) {
    e.preventDefault?.();
    return void openField(landed);
  }
  const asked = walk(e, inField);
  if (!asked) return;
  const [todoOnly, by] = asked;
  const list = lines().filter((el) => !todoOnly || unwritten(el.textContent!));
  landed?.removeAttribute('data-loka-landed');
  landed = list[step(list.length, landed ? list.indexOf(landed) : -1, by)];
  landed?.setAttribute('data-loka-landed', '');
  landed?.scrollIntoView({ block: 'nearest' });
  reapply();
}
const onDouble = (e: MouseEvent) => {
  if (field?.el.contains(e.target as Node)) return; // a word picked in the field
  let el = e.target as HTMLElement | null;
  while (el && el !== document.body && !hooks.seen.has(el.textContent ?? '')) el = el.parentElement;
  void openField(el && el !== document.body ? el : (e.target as HTMLElement));
};
const hush = () => field || say(undefined); // a note lasts until the next click or key
const onClick = () => {
  hush();
  if (!landed) return;
  landed.removeAttribute('data-loka-landed');
  landed = undefined; // Enter is the page's again
  reapply();
};
const onRelay = (e: MessageEvent) => {
  if (LOCAL.test(e.origin) && e.data?.op === 'key') onKey(e.data, !!field, true); // an open field holds the keys
};
/** The words a Book render shows for `key`: the open field's, held until it closes, else undefined. */
export const frozen = (key: string) => (field?.key === key ? field.shown : undefined);
/** Tells the counts again (a panel that just said hello missed them). */
export function recount() {
  counted = '';
  reapply();
}
/** A pushed message (panel.tsx's stream): unconfirmed lines, and a change under the field. */
export function heard(message: Message) {
  unconfirmed = new Set((message.unconfirmed ?? []).map((u) => u.key));
  const f = field;
  if (f && !f.busy && message.changed?.some((c) => c.file === f.at.file))
    void api(`/line?key=${enc(f.key)}&words=${enc(f.at.words)}`).then(([, now]) => {
      if (now?.was !== f.at.was) void conflict(f); // their line differs: the notice opens unasked
    });
  reapply();
}
const on: [EventTarget, string, EventListener][] = [
  [document, 'dblclick', onDouble as EventListener],
  [document, 'keydown', onKey as EventListener],
  [document, 'click', onClick],
  [document, 'keyup', hush],
  [window, 'message', onRelay as EventListener],
];

/** Starts the editor over the Book; the returned function stops it. */
export function start(given: Hooks) {
  hooks = given;
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = CSS;
  note = document.body.appendChild(document.createElement('div'));
  note.className = 'loka-note';
  note.setAttribute('role', 'status'); // polite
  for (const [target, name, run] of on) target.addEventListener(name, run, true);
  watch();
  reapply();
  return () => {
    for (const [target, name, run] of on) target.removeEventListener(name, run, true);
    observer?.disconnect();
    style.remove();
    note.remove();
  };
}

/** The computed paper under `el`: its first ancestor with a background. */
function paper(el: Element | null): string {
  for (; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) return bg;
  }
  return 'rgb(235, 230, 215)';
}
