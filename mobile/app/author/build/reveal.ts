// Fields added with no least value (form.tsx), drawn empty until written. Kept in sessionStorage
// where there is one: web reloads the page on each compiled write (App.tsx), a turn-on among them.
const REVEALED = 'loka-build-revealed';
let memory = '[]'; // native: no reload, no sessionStorage

export const reveals = (): string[] =>
  JSON.parse(globalThis.sessionStorage?.getItem(REVEALED) ?? memory);

export const reveal = (k: string, on: boolean) => {
  const v = JSON.stringify([...reveals().filter((x) => x !== k), ...(on ? [k] : [])]);
  globalThis.sessionStorage ? globalThis.sessionStorage.setItem(REVEALED, v) : (memory = v);
};
